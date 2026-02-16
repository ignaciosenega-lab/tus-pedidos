const express = require("express");
const { requireAuth, requireRole, requireBranchAccess } = require("../middleware/auth");

const router = express.Router();

/* ══════════════════════════════════════════════════
   BRANCHES (master only)
   ══════════════════════════════════════════════════ */

// GET /api/branches
router.get("/", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const branches = db.prepare("SELECT * FROM branches ORDER BY id").all();

  const result = branches.map((b) => ({
    ...b,
    banners: safeParseJson(b.banners, []),
    slider_images: safeParseJson(b.slider_images, []),
    social_links: safeParseJson(b.social_links, []),
    style_config: safeParseJson(b.style_config, {}),
    payment_config: safeParseJson(b.payment_config, {}),
  }));

  res.json(result);
});

// GET /api/branches/:id
router.get("/:id", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  const branch = db.prepare("SELECT * FROM branches WHERE id = ?").get(id);
  if (!branch) {
    return res.status(404).json({ error: "Sucursal no encontrada" });
  }

  res.json({
    ...branch,
    banners: safeParseJson(branch.banners, []),
    slider_images: safeParseJson(branch.slider_images, []),
    social_links: safeParseJson(branch.social_links, []),
    style_config: safeParseJson(branch.style_config, {}),
    payment_config: safeParseJson(branch.payment_config, {}),
  });
});

// POST /api/branches
router.post("/", requireAuth, requireRole("master"), (req, res) => {
  const {
    slug,
    name,
    address,
    address_url,
    whatsapp,
    phone,
    email,
    description,
    url,
    is_open,
    logo,
    favicon,
    banners,
    slider_images,
    social_links,
    style_config,
    payment_config,
  } = req.body;

  if (!slug || !name) {
    return res.status(400).json({ error: "Slug y nombre son requeridos" });
  }

  const db = req.app.locals.db;

  // Check slug uniqueness
  const existing = db.prepare("SELECT id FROM branches WHERE slug = ?").get(slug);
  if (existing) {
    return res.status(409).json({ error: "El slug ya existe" });
  }

  const result = db
    .prepare(`
      INSERT INTO branches (slug, name, address, address_url, whatsapp, phone, email, description, url, is_open, logo, favicon, banners, slider_images, social_links, style_config, payment_config)
      VALUES (@slug, @name, @address, @address_url, @whatsapp, @phone, @email, @description, @url, @is_open, @logo, @favicon, @banners, @slider_images, @social_links, @style_config, @payment_config)
    `)
    .run({
      slug,
      name,
      address: address || "",
      address_url: address_url || "",
      whatsapp: whatsapp || "",
      phone: phone || "",
      email: email || "",
      description: description || "",
      url: url || "",
      is_open: is_open !== false ? 1 : 0,
      logo: logo || "",
      favicon: favicon || "",
      banners: JSON.stringify(banners || []),
      slider_images: JSON.stringify(slider_images || []),
      social_links: JSON.stringify(social_links || []),
      style_config: JSON.stringify(style_config || {}),
      payment_config: JSON.stringify(payment_config || {}),
    });

  const created = db.prepare("SELECT * FROM branches WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({
    ...created,
    banners: safeParseJson(created.banners, []),
    slider_images: safeParseJson(created.slider_images, []),
    social_links: safeParseJson(created.social_links, []),
    style_config: safeParseJson(created.style_config, {}),
    payment_config: safeParseJson(created.payment_config, {}),
  });
});

// PUT /api/branches/:id
router.put("/:id", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  const existing = db.prepare("SELECT * FROM branches WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Sucursal no encontrada" });
  }

  const {
    slug,
    name,
    address,
    address_url,
    whatsapp,
    phone,
    email,
    description,
    url,
    is_open,
    logo,
    favicon,
    banners,
    slider_images,
    social_links,
    style_config,
    payment_config,
  } = req.body;

  // Check slug uniqueness if changing
  if (slug && slug !== existing.slug) {
    const duplicate = db.prepare("SELECT id FROM branches WHERE slug = ? AND id != ?").get(slug, id);
    if (duplicate) {
      return res.status(409).json({ error: "El slug ya existe" });
    }
  }

  db.prepare(`
    UPDATE branches SET
      slug = @slug, name = @name, address = @address, address_url = @address_url,
      whatsapp = @whatsapp, phone = @phone, email = @email, description = @description,
      url = @url, is_open = @is_open, logo = @logo, favicon = @favicon,
      banners = @banners, slider_images = @slider_images, social_links = @social_links,
      style_config = @style_config, payment_config = @payment_config,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    slug: slug !== undefined ? slug : existing.slug,
    name: name !== undefined ? name : existing.name,
    address: address !== undefined ? address : existing.address,
    address_url: address_url !== undefined ? address_url : existing.address_url,
    whatsapp: whatsapp !== undefined ? whatsapp : existing.whatsapp,
    phone: phone !== undefined ? phone : existing.phone,
    email: email !== undefined ? email : existing.email,
    description: description !== undefined ? description : existing.description,
    url: url !== undefined ? url : existing.url,
    is_open: is_open !== undefined ? (is_open ? 1 : 0) : existing.is_open,
    logo: logo !== undefined ? logo : existing.logo,
    favicon: favicon !== undefined ? favicon : existing.favicon,
    banners: banners !== undefined ? JSON.stringify(banners) : existing.banners,
    slider_images: slider_images !== undefined ? JSON.stringify(slider_images) : existing.slider_images,
    social_links: social_links !== undefined ? JSON.stringify(social_links) : existing.social_links,
    style_config: style_config !== undefined ? JSON.stringify(style_config) : existing.style_config,
    payment_config: payment_config !== undefined ? JSON.stringify(payment_config) : existing.payment_config,
  });

  const updated = db.prepare("SELECT * FROM branches WHERE id = ?").get(id);
  res.json({
    ...updated,
    banners: safeParseJson(updated.banners, []),
    slider_images: safeParseJson(updated.slider_images, []),
    social_links: safeParseJson(updated.social_links, []),
    style_config: safeParseJson(updated.style_config, {}),
    payment_config: safeParseJson(updated.payment_config, {}),
  });
});

// DELETE /api/branches/:id
router.delete("/:id", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  // Check if branch has users
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE branch_id = ?").get(id);
  if (userCount.count > 0) {
    return res.status(400).json({ error: "No se puede eliminar una sucursal con usuarios asignados" });
  }

  const deleteBranch = db.transaction(() => {
    db.prepare("DELETE FROM branch_product_overrides WHERE branch_id = ?").run(id);
    db.prepare("DELETE FROM branch_variant_overrides WHERE branch_id = ?").run(id);
    db.prepare("DELETE FROM branch_category_visibility WHERE branch_id = ?").run(id);
    db.prepare("DELETE FROM promotions WHERE branch_id = ?").run(id);
    db.prepare("DELETE FROM coupons WHERE branch_id = ?").run(id);
    db.prepare("DELETE FROM delivery_zones WHERE branch_id = ?").run(id);
    const result = db.prepare("DELETE FROM branches WHERE id = ?").run(id);
    return result.changes;
  });

  const changes = deleteBranch();
  if (changes === 0) {
    return res.status(404).json({ error: "Sucursal no encontrada" });
  }

  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   BRANCH STATE (with overrides applied)
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/state
router.get("/:id/state", (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);

  const branch = db.prepare("SELECT * FROM branches WHERE id = ?").get(branchId);
  if (!branch) {
    return res.status(404).json({ error: "Sucursal no encontrada" });
  }

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");

  try {
    const state = readBranchState(db, branchId);
    res.json(state);
  } catch (e) {
    console.error("Error reading branch state:", e.message);
    res.status(500).json({ error: "Error leyendo datos de la sucursal" });
  }
});

/* ══════════════════════════════════════════════════
   BRANCH OVERRIDES
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/overrides/products
router.get("/:id/overrides/products", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);

  const overrides = db
    .prepare("SELECT * FROM branch_product_overrides WHERE branch_id = ? ORDER BY product_id")
    .all(branchId);
  res.json(overrides);
});

// POST /api/branches/:id/overrides/products
router.post("/:id/overrides/products", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const { product_id, price_override, is_available, stock_override } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: "product_id es requerido" });
  }

  // Check product exists
  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(product_id);
  if (!product) {
    return res.status(400).json({ error: "El producto no existe" });
  }

  // Upsert override
  db.prepare(`
    INSERT INTO branch_product_overrides (branch_id, product_id, price_override, is_available, stock_override)
    VALUES (@branch_id, @product_id, @is_active, @is_featured, @base_price)
    ON CONFLICT(branch_id, product_id) DO UPDATE SET
      is_active = excluded.is_active,
      is_featured = excluded.is_featured,
      base_price = excluded.base_price
  `).run({
    branch_id: branchId,
    product_id,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : null,
    is_featured: is_featured !== undefined ? (is_featured ? 1 : 0) : null,
    base_price: base_price !== undefined ? base_price : null,
  });

  const created = db
    .prepare("SELECT * FROM branch_product_overrides WHERE branch_id = ? AND product_id = ?")
    .get(branchId, product_id);
  res.json(created);
});

// DELETE /api/branches/:id/overrides/products/:productId
router.delete("/:id/overrides/products/:productId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const productId = Number(req.params.productId);

  const result = db
    .prepare("DELETE FROM branch_product_overrides WHERE branch_id = ? AND product_id = ?")
    .run(branchId, productId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Override no encontrado" });
  }

  res.json({ ok: true });
});

// GET /api/branches/:id/overrides/variants
router.get("/:id/overrides/variants", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);

  const overrides = db
    .prepare("SELECT * FROM branch_variant_overrides WHERE branch_id = ? ORDER BY variant_id")
    .all(branchId);
  res.json(overrides);
});

// POST /api/branches/:id/overrides/variants
router.post("/:id/overrides/variants", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const { variant_id, price_override, is_available } = req.body;

  if (!variant_id) {
    return res.status(400).json({ error: "variant_id es requerido" });
  }

  // Upsert override
  db.prepare(`
    INSERT INTO branch_variant_overrides (branch_id, variant_id, price_override, is_available)
    VALUES (@branch_id, @variant_id, @price, @stock)
    ON CONFLICT(branch_id, variant_id) DO UPDATE SET
      price = excluded.price,
      stock = excluded.stock
  `).run({
    branch_id: branchId,
    variant_id,
    price: price !== undefined ? price : null,
    stock: stock !== undefined ? stock : null,
  });

  const created = db
    .prepare("SELECT * FROM branch_variant_overrides WHERE branch_id = ? AND variant_id = ?")
    .get(branchId, variant_id);
  res.json(created);
});

// DELETE /api/branches/:id/overrides/variants/:variantId
router.delete("/:id/overrides/variants/:variantId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const variantId = Number(req.params.variantId);

  const result = db
    .prepare("DELETE FROM branch_variant_overrides WHERE branch_id = ? AND variant_id = ?")
    .run(branchId, variantId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Override no encontrado" });
  }

  res.json({ ok: true });
});

/* ── Helper ──────────────────────────────────── */

function readBranchState(db, branchId) {
  const branch = db.prepare("SELECT * FROM branches WHERE id = ?").get(branchId);
  if (!branch) return null;

  // Categories (global, with visibility filter)
  const catRows = db.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, id").all();
  const visibilityMap = {};
  db.prepare("SELECT category_id, is_visible FROM branch_category_visibility WHERE branch_id = ?")
    .all(branchId)
    .forEach((r) => {
      visibilityMap[r.category_id] = r.is_visible;
    });

  const categories = catRows
    .filter((c) => (visibilityMap[c.id] !== undefined ? visibilityMap[c.id] : true))
    .map((c) => ({ id: String(c.id), name: c.name }));

  // Products with branch overrides
  const prodRows = db.prepare("SELECT * FROM products ORDER BY id").all();
  const productOverrides = {};
  db.prepare("SELECT * FROM branch_product_overrides WHERE branch_id = ?")
    .all(branchId)
    .forEach((o) => {
      productOverrides[o.product_id] = o;
    });

  const variantOverrides = {};
  db.prepare("SELECT * FROM branch_variant_overrides WHERE branch_id = ?")
    .all(branchId)
    .forEach((o) => {
      variantOverrides[o.variant_id] = o;
    });

  const products = prodRows
    .map((p) => {
      const override = productOverrides[p.id];
      const isActive = override?.is_active !== null ? override.is_active : p.is_active;
      const isFeatured = override?.is_featured !== null ? override.is_featured : p.is_featured;
      const basePrice = override?.base_price !== null ? override.base_price : p.base_price;

      if (!isActive) return null; // Skip inactive products

      const variants = db
        .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
        .all(p.id)
        .map((v) => {
          const vOverride = variantOverrides[v.id];
          return {
            id: String(v.id),
            label: v.label,
            price: vOverride?.price !== null ? vOverride.price : v.price,
            stock: vOverride?.stock !== null ? vOverride.stock : v.stock,
          };
        });

      const toppings = db
        .prepare("SELECT * FROM product_toppings WHERE product_id = ? ORDER BY sort_order, id")
        .all(p.id)
        .map((t) => ({
          id: String(t.id),
          name: t.name,
          price: t.price,
        }));

      const product = {
        id: String(p.id),
        name: p.name,
        description: p.description,
        categoryId: String(p.category_id),
        imageUrl: p.image_url,
        type: p.type,
        badges: safeParseJson(p.badges, []),
        status: "alta",
        featured: !!isFeatured,
        private: !!p.is_private,
        gallery: safeParseJson(p.gallery, []),
        toppings,
      };

      if (p.type === "simple") {
        product.basePrice = basePrice;
        product.stock = p.stock;
      }
      if (variants.length > 0) {
        product.variants = variants;
      }

      return product;
    })
    .filter(Boolean);

  // Branch-specific data
  const promoRows = db.prepare("SELECT * FROM promotions WHERE branch_id = ? ORDER BY id").all(branchId);
  const promotions = promoRows.map((pr) => {
    const ppRows = db.prepare("SELECT product_id FROM promotion_products WHERE promotion_id = ?").all(pr.id);
    return {
      id: String(pr.id),
      name: pr.name,
      percentage: pr.percentage,
      applyToAll: !!pr.apply_to_all,
      productIds: ppRows.map((r) => String(r.product_id)),
      dateFrom: pr.date_from,
      dateTo: pr.date_to,
      weeklyRepeat: !!pr.weekly_repeat,
    };
  });

  const couponRows = db.prepare("SELECT * FROM coupons WHERE branch_id = ? ORDER BY id").all(branchId);
  const coupons = couponRows.map((c) => {
    const targets = db.prepare("SELECT * FROM coupon_targets WHERE coupon_id = ?").all(c.id);
    const categoryIds = targets.filter((t) => t.target_type === "category").map((t) => String(t.target_id));
    const productIds = targets.filter((t) => t.target_type === "product").map((t) => String(t.target_id));
    return {
      id: String(c.id),
      code: c.code,
      name: c.name,
      type: c.type,
      value: c.value,
      minOrder: c.min_order,
      maxUses: c.max_uses,
      usedCount: c.used_count,
      applyTo: c.apply_to,
      categoryIds,
      productIds,
      activeDays: safeParseJson(c.active_days, []),
      timeFrom: c.time_from,
      timeTo: c.time_to,
      dateFrom: c.date_from,
      dateTo: c.date_to,
      active: !!c.is_active,
    };
  });

  const zoneRows = db.prepare("SELECT * FROM delivery_zones WHERE branch_id = ? ORDER BY id").all(branchId);
  const deliveryZones = zoneRows.map((z) => ({
    id: String(z.id),
    name: z.name,
    polygon: safeParseJson(z.polygon, []),
    cost: z.cost,
    active: !!z.is_active,
    color: z.color,
  }));

  const userRows = db.prepare("SELECT * FROM app_users ORDER BY id").all();
  const users = userRows.map((u) => ({
    id: String(u.id),
    name: u.name,
    email: u.email,
    phone: u.phone,
    address: u.address,
    status: u.status,
    totalSpent: u.total_spent,
    lastOrderDate: u.last_order_date,
    registeredAt: u.registered_at,
  }));

  const businessConfig = {
    title: branch.name,
    email: branch.email,
    address: branch.address,
    addressUrl: branch.address_url,
    url: branch.url,
    description: branch.description,
    phone: branch.phone,
    isOpen: !!branch.is_open,
    logo: branch.logo,
    favicon: branch.favicon,
    banners: safeParseJson(branch.banners, []),
    whatsapp: branch.whatsapp,
    socialLinks: safeParseJson(branch.social_links, []),
    sliderImages: safeParseJson(branch.slider_images, []),
  };

  const paymentConfig = safeParseJson(branch.payment_config, {});
  const styleConfig = safeParseJson(branch.style_config, {});

  return {
    products,
    categories,
    promotions,
    coupons,
    deliveryZones,
    users,
    businessConfig,
    paymentConfig,
    styleConfig,
  };
}

function safeParseJson(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = router;
