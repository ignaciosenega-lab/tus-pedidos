const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const jiroScraper = require("../lib/jiro-scraper");

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
  try {
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
            label: v.label || "",
            price: v.price || 0,
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
            name: t.name || "",
            price: t.price || 0,
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
  } catch (e) {
    console.error("Error creating product:", e.message);
    res.status(500).json({ error: "Error al crear: " + e.message });
  }
});

// PUT /api/catalog/products/:id
router.put("/products/:id", (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);

    const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const existingVariants = db
      .prepare("SELECT id, label, price FROM product_variants WHERE product_id = ?")
      .all(id);

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
      _audit, // { batch_id, source } — metadata opcional para agrupar cambios
    } = req.body;

    // Coerce type legacy ('variable', null, otros) a un valor válido del CHECK.
    const rawType = type !== undefined ? type : existing.type;
    const safeType = rawType === "simple" || rawType === "options" ? rawType : "options";

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
        type: safeType,
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
              label: v.label || "",
              price: v.price || 0,
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
              name: t.name || "",
              price: t.price || 0,
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

    // Registrar diff de precios en audit_logs
    recordPriceChanges(db, {
      user_id: req.user?.id,
      product_id: id,
      product_name: existing.name,
      before: {
        base_price: existing.base_price,
        variants: existingVariants,
      },
      after: {
        base_price: updated.base_price,
        variants: updatedVariants.map((v) => ({ id: v.id, label: v.label, price: v.price })),
      },
      audit: _audit || null,
    });

    res.json({
      ...updated,
      badges: safeParseJson(updated.badges, []),
      gallery: safeParseJson(updated.gallery, []),
      variants: updatedVariants,
      toppings: updatedToppings,
    });
  } catch (e) {
    console.error("Error updating product:", e.message);
    res.status(500).json({ error: "Error al actualizar: " + e.message });
  }
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

/* ══════════════════════════════════════════════════
   PRICE SCAN / APPLY (jirosushi.com.ar)
   ══════════════════════════════════════════════════ */

// POST /api/catalog/price-scan
// body: { urls: string[] }
// Scrapea las URLs, matchea contra el catálogo y devuelve los 3 buckets.
// No hace ningún cambio en DB.
router.post("/price-scan", async (req, res) => {
  try {
    const { urls } = req.body || {};
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "Pasá al menos una URL" });
    }
    for (const u of urls) {
      if (typeof u !== "string" || !/^https?:\/\//i.test(u)) {
        return res.status(400).json({ error: `URL inválida: ${u}` });
      }
    }

    const db = req.app.locals.db;
    const products = db.prepare("SELECT * FROM products").all();
    const existing = products.map((p) => ({
      ...p,
      variants: db
        .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
        .all(p.id),
    }));

    const { products: scraped, errors: scrapeErrors } = await jiroScraper.scrapeUrls(urls);
    const result = jiroScraper.matchProducts(scraped, existing);

    res.json({
      scraped_count: scraped.length,
      scrape_errors: scrapeErrors,
      ...result,
    });
  } catch (e) {
    console.error("price-scan error:", e.message);
    res.status(500).json({ error: "Error al escanear: " + e.message });
  }
});

// POST /api/catalog/price-apply
// body: { changes: [{ product_id, changes: [{ kind, variant_id?, to }] }] }
// Aplica los cambios en DB y los registra en audit_logs bajo un batch_id nuevo.
router.post("/price-apply", (req, res) => {
  try {
    const { changes } = req.body || {};
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: "Nada para aplicar" });
    }

    const db = req.app.locals.db;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const batchId = `jiro-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    let ok = 0;
    let failed = 0;
    const errors = [];

    for (const item of changes) {
      try {
        const productId = Number(item.product_id);
        const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
        if (!existing) {
          failed++;
          errors.push({ product_id: productId, error: "Producto no encontrado" });
          continue;
        }
        const existingVariants = db
          .prepare("SELECT id, label, price FROM product_variants WHERE product_id = ?")
          .all(productId);

        const apply = db.transaction(() => {
          const baseChange = item.changes.find((c) => c.kind === "base_price");
          if (baseChange) {
            db.prepare("UPDATE products SET base_price = ? WHERE id = ?").run(
              baseChange.to,
              productId
            );
          }
          for (const c of item.changes.filter((c) => c.kind === "variant")) {
            db.prepare(
              "UPDATE product_variants SET price = ? WHERE id = ? AND product_id = ?"
            ).run(c.to, c.variant_id, productId);
          }
        });
        apply();

        const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
        const updatedVariants = db
          .prepare("SELECT id, label, price FROM product_variants WHERE product_id = ?")
          .all(productId);

        recordPriceChanges(db, {
          user_id: req.user?.id,
          product_id: productId,
          product_name: existing.name,
          before: { base_price: existing.base_price, variants: existingVariants },
          after: { base_price: updated.base_price, variants: updatedVariants },
          audit: { batch_id: batchId, source: "jiro-admin" },
        });

        ok++;
      } catch (e) {
        failed++;
        errors.push({ product_id: item.product_id, error: e.message });
      }
    }

    res.json({ batch_id: batchId, ok, failed, errors });
  } catch (e) {
    console.error("price-apply error:", e.message);
    res.status(500).json({ error: "Error al aplicar: " + e.message });
  }
});

/* ══════════════════════════════════════════════════
   PRICE HISTORY
   ══════════════════════════════════════════════════ */

// GET /api/catalog/price-history — lista los cambios agrupados por batch
router.get("/price-history", (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const rows = db
    .prepare(
      `SELECT a.*, u.display_name AS user_display, u.username AS username
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.entity_type = 'product' AND a.action = 'price_update'
       ORDER BY a.id DESC
       LIMIT ?`
    )
    .all(limit);

  const batches = new Map();
  for (const row of rows) {
    const newVal = safeParseJson(row.new_value, {});
    const oldVal = safeParseJson(row.old_value, {});
    const batchId = newVal.batch_id || `single-${row.id}`;

    if (!batches.has(batchId)) {
      batches.set(batchId, {
        batch_id: batchId,
        source: newVal.source || "manual",
        created_at: row.created_at,
        user_display: row.user_display || row.username || "—",
        changes: [],
        reverted: false,
      });
    }
    const batch = batches.get(batchId);
    batch.changes.push({
      audit_id: row.id,
      product_id: Number(row.entity_id),
      product_name: newVal.product_name || oldVal.product_name || `#${row.entity_id}`,
      diffs: newVal.diffs || [],
      reverted_at: newVal.reverted_at || null,
    });
    if (newVal.reverted_at) batch.reverted = true;
  }

  res.json(Array.from(batches.values()));
});

// POST /api/catalog/price-history/revert — revierte un batch entero o filas sueltas
router.post("/price-history/revert", (req, res) => {
  const db = req.app.locals.db;
  const { batch_id, audit_ids } = req.body;

  let rows;
  if (batch_id) {
    rows = db
      .prepare(
        `SELECT * FROM audit_logs
         WHERE entity_type = 'product' AND action = 'price_update'
         ORDER BY id DESC`
      )
      .all()
      .filter((r) => {
        const v = safeParseJson(r.new_value, {});
        return v.batch_id === batch_id && !v.reverted_at;
      });
  } else if (Array.isArray(audit_ids) && audit_ids.length > 0) {
    const placeholders = audit_ids.map(() => "?").join(",");
    rows = db
      .prepare(
        `SELECT * FROM audit_logs
         WHERE entity_type = 'product' AND action = 'price_update'
         AND id IN (${placeholders})`
      )
      .all(...audit_ids)
      .filter((r) => {
        const v = safeParseJson(r.new_value, {});
        return !v.reverted_at;
      });
  } else {
    return res.status(400).json({ error: "Falta batch_id o audit_ids" });
  }

  if (rows.length === 0) {
    return res.status(404).json({ error: "No hay cambios para revertir" });
  }

  const results = [];
  const revertTx = db.transaction(() => {
    for (const row of rows) {
      const oldVal = safeParseJson(row.old_value, {});
      const productId = Number(row.entity_id);

      // Aplicar precios del old_value
      if (oldVal.base_price != null) {
        db.prepare("UPDATE products SET base_price = ? WHERE id = ?").run(
          oldVal.base_price,
          productId
        );
      }
      if (Array.isArray(oldVal.variants)) {
        for (const v of oldVal.variants) {
          db.prepare(
            "UPDATE product_variants SET price = ? WHERE id = ? AND product_id = ?"
          ).run(v.price, v.id, productId);
        }
      }

      // Marcar el log como revertido (dentro del JSON new_value)
      const newVal = safeParseJson(row.new_value, {});
      newVal.reverted_at = new Date().toISOString();
      newVal.reverted_by = req.user?.id || null;
      db.prepare("UPDATE audit_logs SET new_value = ? WHERE id = ?").run(
        JSON.stringify(newVal),
        row.id
      );

      // Log nuevo del revert
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES (?, 'price_revert', 'product', ?, ?, ?)`
      ).run(
        req.user?.id || null,
        String(productId),
        row.new_value,
        JSON.stringify({
          reverted_audit_id: row.id,
          product_name: oldVal.product_name || newVal.product_name,
        })
      );

      results.push({ audit_id: row.id, product_id: productId });
    }
  });

  try {
    revertTx();
    res.json({ ok: true, reverted: results.length, items: results });
  } catch (e) {
    console.error("Error reverting price history:", e.message);
    res.status(500).json({ error: "Error al revertir: " + e.message });
  }
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

// Detecta cambios de precio entre before/after y los registra en audit_logs.
// diffs: [{ kind: 'base_price' | 'variant_price', variant_id?, label?, from, to }]
function recordPriceChanges(db, { user_id, product_id, product_name, before, after, audit }) {
  const diffs = [];

  if (Number(before.base_price) !== Number(after.base_price)) {
    diffs.push({
      kind: "base_price",
      from: Number(before.base_price),
      to: Number(after.base_price),
    });
  }

  const beforeVariantsById = new Map(before.variants.map((v) => [v.id, v]));
  for (const va of after.variants) {
    const vb = beforeVariantsById.get(va.id);
    if (vb && Number(vb.price) !== Number(va.price)) {
      diffs.push({
        kind: "variant_price",
        variant_id: va.id,
        label: va.label,
        from: Number(vb.price),
        to: Number(va.price),
      });
    }
  }

  if (diffs.length === 0) return;

  const oldValue = {
    product_name,
    base_price: Number(before.base_price),
    variants: before.variants.map((v) => ({ id: v.id, label: v.label, price: Number(v.price) })),
  };
  const newValue = {
    product_name,
    base_price: Number(after.base_price),
    variants: after.variants.map((v) => ({ id: v.id, label: v.label, price: Number(v.price) })),
    diffs,
    batch_id: audit?.batch_id || null,
    source: audit?.source || "manual",
  };

  db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, 'price_update', 'product', ?, ?, ?)`
  ).run(
    user_id || null,
    String(product_id),
    JSON.stringify(oldValue),
    JSON.stringify(newValue)
  );
}

module.exports = router;
