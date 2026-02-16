const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// All catalog routes require master role (global catalog management)
router.use(requireAuth, requireRole("master"));

/* ══════════════════════════════════════════════════
   CATEGORIES
   ══════════════════════════════════════════════════ */

// GET /api/catalog/categories
router.get("/categories", (req, res) => {
  const db = req.app.locals.db;
  const categories = db
    .prepare("SELECT * FROM categories ORDER BY sort_order, id")
    .all();
  res.json(categories);
});

// POST /api/catalog/categories
router.post("/categories", (req, res) => {
  const { name, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ error: "El nombre es requerido" });
  }

  const db = req.app.locals.db;
  const result = db
    .prepare("INSERT INTO categories (name, sort_order, is_active) VALUES (@name, @sort_order, 1)")
    .run({ name, sort_order: sort_order || 0 });

  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(category);
});

// PUT /api/catalog/categories/:id
router.put("/categories/:id", (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const { name, sort_order, is_active } = req.body;

  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Categoría no encontrada" });
  }

  db.prepare("UPDATE categories SET name = @name, sort_order = @sort_order, is_active = @is_active WHERE id = @id").run({
    id,
    name: name !== undefined ? name : existing.name,
    sort_order: sort_order !== undefined ? sort_order : existing.sort_order,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
  });

  const updated = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  res.json(updated);
});

// DELETE /api/catalog/categories/:id
router.delete("/categories/:id", (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  // Check if category has products
  const productCount = db.prepare("SELECT COUNT(*) as count FROM products WHERE category_id = ?").get(id);
  if (productCount.count > 0) {
    return res.status(400).json({ error: "No se puede eliminar una categoría con productos" });
  }

  const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Categoría no encontrada" });
  }

  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   PRODUCTS
   ══════════════════════════════════════════════════ */

// GET /api/catalog/products
router.get("/products", (req, res) => {
  const db = req.app.locals.db;
  const products = db.prepare("SELECT * FROM products ORDER BY id").all();

  const result = products.map((p) => {
    const variants = db
      .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
      .all(p.id);
    const toppings = db
      .prepare("SELECT * FROM product_toppings WHERE product_id = ? ORDER BY sort_order, id")
      .all(p.id);

    return {
      ...p,
      badges: safeParseJson(p.badges, []),
      gallery: safeParseJson(p.gallery, []),
      variants,
      toppings,
    };
  });

  res.json(result);
});

// GET /api/catalog/products/:id
router.get("/products/:id", (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!product) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  const variants = db
    .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
    .all(id);
  const toppings = db
    .prepare("SELECT * FROM product_toppings WHERE product_id = ? ORDER BY sort_order, id")
    .all(id);

  res.json({
    ...product,
    badges: safeParseJson(product.badges, []),
    gallery: safeParseJson(product.gallery, []),
    variants,
    toppings,
  });
});

// POST /api/catalog/products
router.post("/products", (req, res) => {
  const {
    name,
    description,
    category_id,
    image_url,
    type,
    base_price,
    stock,
    badges,
    is_active,
    is_featured,
    is_private,
    gallery,
    variants,
    toppings,
  } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ error: "Nombre y categoría son requeridos" });
  }

  const db = req.app.locals.db;

  // Check category exists
  const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(category_id);
  if (!category) {
    return res.status(400).json({ error: "La categoría no existe" });
  }

  const insertProduct = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO products (name, description, category_id, image_url, type, base_price, stock, badges, is_active, is_featured, is_private, gallery)
        VALUES (@name, @description, @category_id, @image_url, @type, @base_price, @stock, @badges, @is_active, @is_featured, @is_private, @gallery)
      `)
      .run({
        name,
        description: description || "",
        category_id,
        image_url: image_url || "",
        type: type || "simple",
        base_price: base_price || 0,
        stock: stock != null ? stock : null,
        badges: JSON.stringify(badges || []),
        is_active: is_active !== false ? 1 : 0,
        is_featured: is_featured ? 1 : 0,
        is_private: is_private ? 1 : 0,
        gallery: JSON.stringify(gallery || []),
      });

    const productId = Number(result.lastInsertRowid);

    // Insert variants
    if (variants && variants.length > 0) {
      const insertVariant = db.prepare(
        "INSERT INTO product_variants (product_id, label, price, stock, sort_order) VALUES (@product_id, @label, @price, @stock, @sort_order)"
      );
      variants.forEach((v, idx) => {
        insertVariant.run({
          product_id: productId,
          label: v.label,
          price: v.price,
          stock: v.stock != null ? v.stock : null,
          sort_order: v.sort_order !== undefined ? v.sort_order : idx,
        });
      });
    }

    // Insert toppings
    if (toppings && toppings.length > 0) {
      const insertTopping = db.prepare(
        "INSERT INTO product_toppings (product_id, name, price, sort_order) VALUES (@product_id, @name, @price, @sort_order)"
      );
      toppings.forEach((t, idx) => {
        insertTopping.run({
          product_id: productId,
          name: t.name,
          price: t.price,
          sort_order: t.sort_order !== undefined ? t.sort_order : idx,
        });
      });
    }

    return productId;
  });

  const productId = insertProduct();
  const created = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  const createdVariants = db
    .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
    .all(productId);
  const createdToppings = db
    .prepare("SELECT * FROM product_toppings WHERE product_id = ? ORDER BY sort_order, id")
    .all(productId);

  res.status(201).json({
    ...created,
    badges: safeParseJson(created.badges, []),
    gallery: safeParseJson(created.gallery, []),
    variants: createdVariants,
    toppings: createdToppings,
  });
});

// PUT /api/catalog/products/:id
router.put("/products/:id", (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  const {
    name,
    description,
    category_id,
    image_url,
    type,
    base_price,
    stock,
    badges,
    is_active,
    is_featured,
    is_private,
    gallery,
    variants,
    toppings,
  } = req.body;

  const updateProduct = db.transaction(() => {
    // Update product
    db.prepare(`
      UPDATE products SET
        name = @name, description = @description, category_id = @category_id,
        image_url = @image_url, type = @type, base_price = @base_price, stock = @stock,
        badges = @badges, is_active = @is_active, is_featured = @is_featured,
        is_private = @is_private, gallery = @gallery
      WHERE id = @id
    `).run({
      id,
      name: name !== undefined ? name : existing.name,
      description: description !== undefined ? description : existing.description,
      category_id: category_id !== undefined ? category_id : existing.category_id,
      image_url: image_url !== undefined ? image_url : existing.image_url,
      type: type !== undefined ? type : existing.type,
      base_price: base_price !== undefined ? base_price : existing.base_price,
      stock: stock !== undefined ? stock : existing.stock,
      badges: badges !== undefined ? JSON.stringify(badges) : existing.badges,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      is_featured: is_featured !== undefined ? (is_featured ? 1 : 0) : existing.is_featured,
      is_private: is_private !== undefined ? (is_private ? 1 : 0) : existing.is_private,
      gallery: gallery !== undefined ? JSON.stringify(gallery) : existing.gallery,
    });

    // Replace variants if provided
    if (variants !== undefined) {
      db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(id);
      if (variants.length > 0) {
        const insertVariant = db.prepare(
          "INSERT INTO product_variants (product_id, label, price, stock, sort_order) VALUES (@product_id, @label, @price, @stock, @sort_order)"
        );
        variants.forEach((v, idx) => {
          insertVariant.run({
            product_id: id,
            label: v.label,
            price: v.price,
            stock: v.stock != null ? v.stock : null,
            sort_order: v.sort_order !== undefined ? v.sort_order : idx,
          });
        });
      }
    }

    // Replace toppings if provided
    if (toppings !== undefined) {
      db.prepare("DELETE FROM product_toppings WHERE product_id = ?").run(id);
      if (toppings.length > 0) {
        const insertTopping = db.prepare(
          "INSERT INTO product_toppings (product_id, name, price, sort_order) VALUES (@product_id, @name, @price, @sort_order)"
        );
        toppings.forEach((t, idx) => {
          insertTopping.run({
            product_id: id,
            name: t.name,
            price: t.price,
            sort_order: t.sort_order !== undefined ? t.sort_order : idx,
          });
        });
      }
    }
  });

  updateProduct();

  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  const updatedVariants = db
    .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
    .all(id);
  const updatedToppings = db
    .prepare("SELECT * FROM product_toppings WHERE product_id = ? ORDER BY sort_order, id")
    .all(id);

  res.json({
    ...updated,
    badges: safeParseJson(updated.badges, []),
    gallery: safeParseJson(updated.gallery, []),
    variants: updatedVariants,
    toppings: updatedToppings,
  });
});

// DELETE /api/catalog/products/:id
router.delete("/products/:id", (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  const deleteProduct = db.transaction(() => {
    db.prepare("DELETE FROM product_toppings WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM branch_product_overrides WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM branch_variant_overrides WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)").run(id);
    const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
    return result.changes;
  });

  const changes = deleteProduct();
  if (changes === 0) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  res.json({ ok: true });
});

/* ── Utility ─────────────────────────────────── */

function safeParseJson(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = router;
