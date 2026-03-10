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
    schedule,
    menu_id,
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
      schedule = @schedule, menu_id = @menu_id, updated_at = datetime('now')
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
    schedule: schedule !== undefined ? JSON.stringify(schedule) : existing.schedule,
    menu_id: menu_id !== undefined ? menu_id : existing.menu_id,
  });

  const updated = db.prepare("SELECT * FROM branches WHERE id = ?").get(id);
  res.json({
    ...updated,
    banners: safeParseJson(updated.banners, []),
    slider_images: safeParseJson(updated.slider_images, []),
    social_links: safeParseJson(updated.social_links, []),
    style_config: safeParseJson(updated.style_config, {}),
    payment_config: safeParseJson(updated.payment_config, {}),
    schedule: safeParseJson(updated.schedule, {}),
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
   BRANCH CATALOG (read-only for branch_admin)
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/catalog — products list with overrides merged
router.get("/:id/catalog", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);

  const products = db.prepare("SELECT * FROM products ORDER BY id").all();
  const categories = db.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, id").all();

  // Load branch overrides
  const overrides = {};
  db.prepare("SELECT * FROM branch_product_overrides WHERE branch_id = ?")
    .all(branchId)
    .forEach((o) => { overrides[o.product_id] = o; });

  // Merge products with overrides
  const merged = products.map((p) => {
    const ov = overrides[p.product_id || p.id] || {};
    const variants = db.prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id").all(p.id);
    return {
      ...p,
      badges: safeParseJson(p.badges, []),
      gallery: safeParseJson(p.gallery, []),
      variants,
      is_available: ov.is_available !== undefined ? ov.is_available : 1,
      has_override: !!overrides[p.id],
    };
  });

  res.json({ products: merged, categories });
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
    VALUES (@branch_id, @product_id, @price_override, @is_available, @stock_override)
    ON CONFLICT(branch_id, product_id) DO UPDATE SET
      price_override = excluded.price_override,
      is_available = excluded.is_available,
      stock_override = excluded.stock_override
  `).run({
    branch_id: branchId,
    product_id,
    price_override: price_override !== undefined ? price_override : null,
    is_available: is_available !== undefined ? (is_available ? 1 : 0) : 1,
    stock_override: stock_override !== undefined ? stock_override : null,
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
    VALUES (@branch_id, @variant_id, @price_override, @is_available)
    ON CONFLICT(branch_id, variant_id) DO UPDATE SET
      price_override = excluded.price_override,
      is_available = excluded.is_available
  `).run({
    branch_id: branchId,
    variant_id,
    price_override: price_override !== undefined ? price_override : null,
    is_available: is_available !== undefined ? (is_available ? 1 : 0) : 1,
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

/* ══════════════════════════════════════════════════
   DELIVERY ZONES
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/zones
router.get("/:id/zones", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const zones = db.prepare("SELECT * FROM delivery_zones WHERE branch_id = ? ORDER BY id").all(branchId);
  res.json(zones.map((z) => ({
    ...z,
    polygon: safeParseJson(z.polygon, []),
  })));
});

// POST /api/branches/:id/zones
router.post("/:id/zones", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const { name, polygon, cost, is_active, color } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre es requerido" });

  const result = db.prepare(
    "INSERT INTO delivery_zones (branch_id, name, polygon, cost, is_active, color) VALUES (@branch_id, @name, @polygon, @cost, @is_active, @color)"
  ).run({
    branch_id: branchId,
    name,
    polygon: JSON.stringify(polygon || []),
    cost: cost || 0,
    is_active: is_active !== false ? 1 : 0,
    color: color || "#3B82F6",
  });

  const created = db.prepare("SELECT * FROM delivery_zones WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ ...created, polygon: safeParseJson(created.polygon, []) });
});

// PUT /api/branches/:id/zones/:zoneId
router.put("/:id/zones/:zoneId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const zoneId = Number(req.params.zoneId);

  const existing = db.prepare("SELECT * FROM delivery_zones WHERE id = ? AND branch_id = ?").get(zoneId, branchId);
  if (!existing) return res.status(404).json({ error: "Zona no encontrada" });

  const { name, polygon, cost, is_active, color } = req.body;
  db.prepare(`
    UPDATE delivery_zones SET
      name = @name, polygon = @polygon, cost = @cost, is_active = @is_active, color = @color
    WHERE id = @id
  `).run({
    id: zoneId,
    name: name !== undefined ? name : existing.name,
    polygon: polygon !== undefined ? JSON.stringify(polygon) : existing.polygon,
    cost: cost !== undefined ? cost : existing.cost,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    color: color !== undefined ? color : existing.color,
  });

  const updated = db.prepare("SELECT * FROM delivery_zones WHERE id = ?").get(zoneId);
  res.json({ ...updated, polygon: safeParseJson(updated.polygon, []) });
});

// DELETE /api/branches/:id/zones/:zoneId
router.delete("/:id/zones/:zoneId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const zoneId = Number(req.params.zoneId);

  const result = db.prepare("DELETE FROM delivery_zones WHERE id = ? AND branch_id = ?").run(zoneId, branchId);
  if (result.changes === 0) return res.status(404).json({ error: "Zona no encontrada" });
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   PROMOTIONS
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/promotions
router.get("/:id/promotions", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const promos = db.prepare("SELECT * FROM promotions WHERE branch_id = ? ORDER BY id DESC").all(branchId);
  res.json(promos.map((p) => {
    const products = db.prepare("SELECT product_id FROM promotion_products WHERE promotion_id = ?").all(p.id);
    const branchRows = db.prepare("SELECT branch_id FROM promotion_branches WHERE promotion_id = ?").all(p.id);
    const catRows = db.prepare("SELECT category_id FROM promotion_categories WHERE promotion_id = ?").all(p.id);
    return {
      ...p,
      productIds: products.map((r) => r.product_id),
      branch_ids: branchRows.map((r) => r.branch_id),
      categoryIds: catRows.map((r) => r.category_id),
    };
  }));
});

// POST /api/branches/:id/promotions
router.post("/:id/promotions", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const { name, percentage, apply_to_all, apply_scope, date_from, date_to, weekly_repeat, productIds, categoryIds, apply_all_branches, branch_ids, time_from, time_to } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre es requerido" });

  const effectiveScope = apply_scope || (apply_to_all ? "all" : "products");

  const result = db.prepare(`
    INSERT INTO promotions (branch_id, name, percentage, apply_to_all, apply_scope, date_from, date_to, weekly_repeat, apply_all_branches, time_from, time_to, is_active)
    VALUES (@branch_id, @name, @percentage, @apply_to_all, @apply_scope, @date_from, @date_to, @weekly_repeat, @apply_all_branches, @time_from, @time_to, 1)
  `).run({
    branch_id: branchId, name, percentage: percentage || 0,
    apply_to_all: effectiveScope === "all" ? 1 : 0,
    apply_scope: effectiveScope,
    date_from: date_from || "", date_to: date_to || "",
    weekly_repeat: weekly_repeat ? 1 : 0,
    apply_all_branches: apply_all_branches ? 1 : 0,
    time_from: time_from || "", time_to: time_to || "",
  });
  const promoId = Number(result.lastInsertRowid);

  if (productIds && productIds.length > 0) {
    const ins = db.prepare("INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)");
    productIds.forEach((pid) => ins.run(promoId, pid));
  }
  if (categoryIds && categoryIds.length > 0) {
    const insCat = db.prepare("INSERT INTO promotion_categories (promotion_id, category_id) VALUES (?, ?)");
    categoryIds.forEach((cid) => insCat.run(promoId, cid));
  }

  // Save branch targeting
  if (branch_ids && branch_ids.length > 0) {
    const insBranch = db.prepare("INSERT INTO promotion_branches (promotion_id, branch_id) VALUES (?, ?)");
    branch_ids.forEach((bid) => insBranch.run(promoId, bid));
  }

  const created = db.prepare("SELECT * FROM promotions WHERE id = ?").get(promoId);
  const prods = db.prepare("SELECT product_id FROM promotion_products WHERE promotion_id = ?").all(promoId);
  const branchRows = db.prepare("SELECT branch_id FROM promotion_branches WHERE promotion_id = ?").all(promoId);
  const catRows = db.prepare("SELECT category_id FROM promotion_categories WHERE promotion_id = ?").all(promoId);
  res.status(201).json({ ...created, productIds: prods.map((r) => r.product_id), branch_ids: branchRows.map((r) => r.branch_id), categoryIds: catRows.map((r) => r.category_id) });
});

// PUT /api/branches/:id/promotions/:promoId
router.put("/:id/promotions/:promoId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const promoId = Number(req.params.promoId);

  const existing = db.prepare("SELECT * FROM promotions WHERE id = ? AND branch_id = ?").get(promoId, branchId);
  if (!existing) return res.status(404).json({ error: "Promoción no encontrada" });

  const { name, percentage, apply_to_all, apply_scope, date_from, date_to, weekly_repeat, is_active, productIds, categoryIds, apply_all_branches, branch_ids, time_from, time_to } = req.body;

  const effectiveScope = apply_scope !== undefined ? apply_scope : (existing.apply_scope || "all");
  db.prepare(`
    UPDATE promotions SET name=@name, percentage=@percentage, apply_to_all=@apply_to_all, apply_scope=@apply_scope,
    date_from=@date_from, date_to=@date_to, weekly_repeat=@weekly_repeat, is_active=@is_active,
    apply_all_branches=@apply_all_branches, time_from=@time_from, time_to=@time_to WHERE id=@id
  `).run({
    id: promoId,
    name: name !== undefined ? name : existing.name,
    percentage: percentage !== undefined ? percentage : existing.percentage,
    apply_to_all: effectiveScope === "all" ? 1 : 0,
    apply_scope: effectiveScope,
    date_from: date_from !== undefined ? date_from : existing.date_from,
    date_to: date_to !== undefined ? date_to : existing.date_to,
    weekly_repeat: weekly_repeat !== undefined ? (weekly_repeat ? 1 : 0) : existing.weekly_repeat,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    apply_all_branches: apply_all_branches !== undefined ? (apply_all_branches ? 1 : 0) : (existing.apply_all_branches || 0),
    time_from: time_from !== undefined ? time_from : (existing.time_from || ""),
    time_to: time_to !== undefined ? time_to : (existing.time_to || ""),
  });

  if (productIds !== undefined) {
    db.prepare("DELETE FROM promotion_products WHERE promotion_id = ?").run(promoId);
    if (productIds.length > 0) {
      const ins = db.prepare("INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)");
      productIds.forEach((pid) => ins.run(promoId, pid));
    }
  }

  if (categoryIds !== undefined) {
    db.prepare("DELETE FROM promotion_categories WHERE promotion_id = ?").run(promoId);
    if (categoryIds.length > 0) {
      const insCat = db.prepare("INSERT INTO promotion_categories (promotion_id, category_id) VALUES (?, ?)");
      categoryIds.forEach((cid) => insCat.run(promoId, cid));
    }
  }

  if (branch_ids !== undefined) {
    db.prepare("DELETE FROM promotion_branches WHERE promotion_id = ?").run(promoId);
    if (branch_ids.length > 0) {
      const insBranch = db.prepare("INSERT INTO promotion_branches (promotion_id, branch_id) VALUES (?, ?)");
      branch_ids.forEach((bid) => insBranch.run(promoId, bid));
    }
  }

  const updated = db.prepare("SELECT * FROM promotions WHERE id = ?").get(promoId);
  const prods = db.prepare("SELECT product_id FROM promotion_products WHERE promotion_id = ?").all(promoId);
  const branchRows = db.prepare("SELECT branch_id FROM promotion_branches WHERE promotion_id = ?").all(promoId);
  const catRows = db.prepare("SELECT category_id FROM promotion_categories WHERE promotion_id = ?").all(promoId);
  res.json({ ...updated, productIds: prods.map((r) => r.product_id), branch_ids: branchRows.map((r) => r.branch_id), categoryIds: catRows.map((r) => r.category_id) });
});

// DELETE /api/branches/:id/promotions/:promoId
router.delete("/:id/promotions/:promoId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const promoId = Number(req.params.promoId);

  db.prepare("DELETE FROM promotion_products WHERE promotion_id = ?").run(promoId);
  db.prepare("DELETE FROM promotion_categories WHERE promotion_id = ?").run(promoId);
  db.prepare("DELETE FROM promotion_branches WHERE promotion_id = ?").run(promoId);
  const result = db.prepare("DELETE FROM promotions WHERE id = ? AND branch_id = ?").run(promoId, branchId);
  if (result.changes === 0) return res.status(404).json({ error: "Promoción no encontrada" });
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   COUPONS
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/coupons
router.get("/:id/coupons", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const coupons = db.prepare("SELECT * FROM coupons WHERE branch_id = ? ORDER BY id DESC").all(branchId);
  res.json(coupons.map((c) => {
    const branchRows = db.prepare("SELECT branch_id FROM coupon_branches WHERE coupon_id = ?").all(c.id);
    const targets = db.prepare("SELECT * FROM coupon_targets WHERE coupon_id = ?").all(c.id);
    return {
      ...c,
      active_days: safeParseJson(c.active_days, []),
      branch_ids: branchRows.map((r) => r.branch_id),
      categoryIds: targets.filter((t) => t.target_type === "category").map((t) => t.target_id),
      productIds: targets.filter((t) => t.target_type === "product").map((t) => t.target_id),
    };
  }));
});

// POST /api/branches/:id/coupons
router.post("/:id/coupons", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const { code, name, type, value, min_order, max_uses, apply_to, active_days, time_from, time_to, date_from, date_to, apply_all_branches, branch_ids, categoryIds, productIds, first_purchase_only } = req.body;
  if (!code) return res.status(400).json({ error: "Código es requerido" });

  const result = db.prepare(`
    INSERT INTO coupons (branch_id, code, name, type, value, min_order, max_uses, used_count, apply_to, active_days, time_from, time_to, date_from, date_to, apply_all_branches, first_purchase_only, is_active)
    VALUES (@branch_id, @code, @name, @type, @value, @min_order, @max_uses, 0, @apply_to, @active_days, @time_from, @time_to, @date_from, @date_to, @apply_all_branches, @first_purchase_only, 1)
  `).run({
    branch_id: branchId, code: code.toUpperCase(), name: name || "",
    type: type || "percentage", value: value || 0, min_order: min_order || 0,
    max_uses: max_uses || 0, apply_to: apply_to || "all",
    active_days: JSON.stringify(active_days || []),
    time_from: time_from || "", time_to: time_to || "",
    date_from: date_from || "", date_to: date_to || "",
    apply_all_branches: apply_all_branches ? 1 : 0,
    first_purchase_only: first_purchase_only ? 1 : 0,
  });

  const couponId = Number(result.lastInsertRowid);

  // Save coupon_targets
  const insTarget = db.prepare("INSERT INTO coupon_targets (coupon_id, target_type, target_id) VALUES (?, ?, ?)");
  if (apply_to === "categories" && categoryIds && categoryIds.length > 0) {
    categoryIds.forEach((cid) => insTarget.run(couponId, "category", cid));
  }
  if (apply_to === "products" && productIds && productIds.length > 0) {
    productIds.forEach((pid) => insTarget.run(couponId, "product", pid));
  }

  if (branch_ids && branch_ids.length > 0) {
    const insBranch = db.prepare("INSERT INTO coupon_branches (coupon_id, branch_id) VALUES (?, ?)");
    branch_ids.forEach((bid) => insBranch.run(couponId, bid));
  }

  const created = db.prepare("SELECT * FROM coupons WHERE id = ?").get(couponId);
  const branchRows = db.prepare("SELECT branch_id FROM coupon_branches WHERE coupon_id = ?").all(couponId);
  const targets = db.prepare("SELECT * FROM coupon_targets WHERE coupon_id = ?").all(couponId);
  res.status(201).json({
    ...created,
    active_days: safeParseJson(created.active_days, []),
    branch_ids: branchRows.map((r) => r.branch_id),
    categoryIds: targets.filter((t) => t.target_type === "category").map((t) => t.target_id),
    productIds: targets.filter((t) => t.target_type === "product").map((t) => t.target_id),
  });
});

// PUT /api/branches/:id/coupons/:couponId
router.put("/:id/coupons/:couponId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const couponId = Number(req.params.couponId);

  const existing = db.prepare("SELECT * FROM coupons WHERE id = ? AND branch_id = ?").get(couponId, branchId);
  if (!existing) return res.status(404).json({ error: "Cupón no encontrado" });

  const { code, name, type, value, min_order, max_uses, apply_to, active_days, time_from, time_to, date_from, date_to, is_active, apply_all_branches, branch_ids, categoryIds, productIds, first_purchase_only } = req.body;
  db.prepare(`
    UPDATE coupons SET code=@code, name=@name, type=@type, value=@value, min_order=@min_order,
    max_uses=@max_uses, apply_to=@apply_to, active_days=@active_days, time_from=@time_from,
    time_to=@time_to, date_from=@date_from, date_to=@date_to, is_active=@is_active,
    apply_all_branches=@apply_all_branches, first_purchase_only=@first_purchase_only WHERE id=@id
  `).run({
    id: couponId,
    code: code !== undefined ? code.toUpperCase() : existing.code,
    name: name !== undefined ? name : existing.name,
    type: type !== undefined ? type : existing.type,
    value: value !== undefined ? value : existing.value,
    min_order: min_order !== undefined ? min_order : existing.min_order,
    max_uses: max_uses !== undefined ? max_uses : existing.max_uses,
    apply_to: apply_to !== undefined ? apply_to : existing.apply_to,
    active_days: active_days !== undefined ? JSON.stringify(active_days) : existing.active_days,
    time_from: time_from !== undefined ? time_from : existing.time_from,
    time_to: time_to !== undefined ? time_to : existing.time_to,
    date_from: date_from !== undefined ? date_from : existing.date_from,
    date_to: date_to !== undefined ? date_to : existing.date_to,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    apply_all_branches: apply_all_branches !== undefined ? (apply_all_branches ? 1 : 0) : (existing.apply_all_branches || 0),
    first_purchase_only: first_purchase_only !== undefined ? (first_purchase_only ? 1 : 0) : (existing.first_purchase_only || 0),
  });

  // Update coupon_targets
  if (apply_to !== undefined) {
    db.prepare("DELETE FROM coupon_targets WHERE coupon_id = ?").run(couponId);
    const insTarget = db.prepare("INSERT INTO coupon_targets (coupon_id, target_type, target_id) VALUES (?, ?, ?)");
    const finalApplyTo = apply_to !== undefined ? apply_to : existing.apply_to;
    if (finalApplyTo === "categories" && categoryIds && categoryIds.length > 0) {
      categoryIds.forEach((cid) => insTarget.run(couponId, "category", cid));
    }
    if (finalApplyTo === "products" && productIds && productIds.length > 0) {
      productIds.forEach((pid) => insTarget.run(couponId, "product", pid));
    }
  }

  if (branch_ids !== undefined) {
    db.prepare("DELETE FROM coupon_branches WHERE coupon_id = ?").run(couponId);
    if (branch_ids.length > 0) {
      const insBranch = db.prepare("INSERT INTO coupon_branches (coupon_id, branch_id) VALUES (?, ?)");
      branch_ids.forEach((bid) => insBranch.run(couponId, bid));
    }
  }

  const updated = db.prepare("SELECT * FROM coupons WHERE id = ?").get(couponId);
  const branchRows = db.prepare("SELECT branch_id FROM coupon_branches WHERE coupon_id = ?").all(couponId);
  const targets = db.prepare("SELECT * FROM coupon_targets WHERE coupon_id = ?").all(couponId);
  res.json({
    ...updated,
    active_days: safeParseJson(updated.active_days, []),
    branch_ids: branchRows.map((r) => r.branch_id),
    categoryIds: targets.filter((t) => t.target_type === "category").map((t) => t.target_id),
    productIds: targets.filter((t) => t.target_type === "product").map((t) => t.target_id),
  });
});

// DELETE /api/branches/:id/coupons/:couponId
router.delete("/:id/coupons/:couponId", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const couponId = Number(req.params.couponId);

  db.prepare("DELETE FROM coupon_targets WHERE coupon_id = ?").run(couponId);
  db.prepare("DELETE FROM coupon_branches WHERE coupon_id = ?").run(couponId);
  const result = db.prepare("DELETE FROM coupons WHERE id = ? AND branch_id = ?").run(couponId, branchId);
  if (result.changes === 0) return res.status(404).json({ error: "Cupón no encontrado" });
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   METRICS
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/metrics/funnel?from=&to=
router.get("/:id/metrics/funnel", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const dateFrom = req.query.from || "";
  const dateTo = req.query.to || "";

  let dateFilter = "";
  const params = [branchId];
  if (dateFrom) {
    dateFilter += " AND created_at >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    dateFilter += " AND created_at < date(?, '+1 day')";
    params.push(dateTo);
  }

  const sessions = db.prepare(
    `SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE branch_id = ? AND event_type = 'session'${dateFilter}`
  ).get(...params).count;

  const productViews = db.prepare(
    `SELECT COUNT(*) as count FROM analytics_events WHERE branch_id = ? AND event_type = 'product_view'${dateFilter}`
  ).get(...params).count;

  const checkoutStarts = db.prepare(
    `SELECT COUNT(*) as count FROM analytics_events WHERE branch_id = ? AND event_type = 'checkout_start'${dateFilter}`
  ).get(...params).count;

  const orders = db.prepare(
    `SELECT COUNT(*) as count FROM orders WHERE branch_id = ?${dateFilter}`
  ).get(...params).count;

  res.json({ sessions, productViews, checkoutStarts, orders });
});

// GET /api/branches/:id/metrics/products?from=&to=
router.get("/:id/metrics/products", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const dateFrom = req.query.from || "";
  const dateTo = req.query.to || "";

  let dateFilter = "";
  const params = [branchId];
  if (dateFrom) {
    dateFilter += " AND created_at >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    dateFilter += " AND created_at < date(?, '+1 day')";
    params.push(dateTo);
  }

  // Product views from analytics
  const viewRows = db.prepare(
    `SELECT product_id, COUNT(*) as views FROM analytics_events WHERE branch_id = ? AND event_type = 'product_view' AND product_id IS NOT NULL${dateFilter} GROUP BY product_id`
  ).all(...params);
  const viewMap = {};
  viewRows.forEach((r) => { viewMap[String(r.product_id)] = r.views; });

  // Product sales from orders
  const orderRows = db.prepare(
    `SELECT items FROM orders WHERE branch_id = ?${dateFilter}`
  ).all(...params);

  // Aggregate sales per product
  const salesMap = {};
  for (const row of orderRows) {
    const items = safeParseJson(row.items, []);
    for (const item of items) {
      const key = item.productId || item.productName;
      if (!salesMap[key]) {
        salesMap[key] = { productId: item.productId || null, productName: item.productName, unitsSold: 0, purchases: 0, revenue: 0 };
      }
      salesMap[key].unitsSold += item.quantity || 0;
      salesMap[key].purchases += 1;
      salesMap[key].revenue += (item.price || 0) * (item.quantity || 0);
    }
  }

  // Merge views + sales, and enrich with product names from DB
  const allProducts = db.prepare("SELECT id, name FROM products").all();
  const productNameMap = {};
  allProducts.forEach((p) => { productNameMap[String(p.id)] = p.name; });

  // Build result set from all products that have either views or sales
  const allKeys = new Set([...Object.keys(viewMap), ...Object.keys(salesMap)]);
  const result = [];
  for (const key of allKeys) {
    const sale = salesMap[key] || { productId: null, productName: key, unitsSold: 0, purchases: 0, revenue: 0 };
    const views = viewMap[key] || 0;
    const productName = productNameMap[key] || sale.productName || `Producto ${key}`;
    result.push({
      productId: key,
      productName,
      views,
      unitsSold: sale.unitsSold,
      purchases: sale.purchases,
      revenue: Math.round(sale.revenue),
    });
  }

  // Sort by revenue descending
  result.sort((a, b) => b.revenue - a.revenue);
  res.json(result);
});

// GET /api/branches/:id/metrics/patterns?from=&to=
router.get("/:id/metrics/patterns", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const dateFrom = req.query.from || "";
  const dateTo = req.query.to || "";

  let dateFilter = "";
  const params = [branchId];
  if (dateFrom) {
    dateFilter += " AND created_at >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    dateFilter += " AND created_at < date(?, '+1 day')";
    params.push(dateTo);
  }

  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  // Orders by day of week
  const dayRows = db.prepare(
    `SELECT CAST(strftime('%w', created_at) AS INTEGER) as dow, COUNT(*) as count FROM orders WHERE branch_id = ?${dateFilter} GROUP BY dow ORDER BY dow`
  ).all(...params);
  const dayMap = {};
  dayRows.forEach((r) => { dayMap[r.dow] = r.count; });
  const byDay = dayNames.map((label, i) => ({ day: i, label, count: dayMap[i] || 0 }));

  // Orders by hour
  const hourRows = db.prepare(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count FROM orders WHERE branch_id = ?${dateFilter} GROUP BY hour ORDER BY hour`
  ).all(...params);
  const hourMap = {};
  hourRows.forEach((r) => { hourMap[r.hour] = r.count; });
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap[h] || 0 }));

  res.json({ byDay, byHour });
});

/* ══════════════════════════════════════════════════
   ORDERS
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/orders
router.get("/:id/orders", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const orders = db.prepare("SELECT * FROM orders WHERE branch_id = ? ORDER BY created_at DESC").all(branchId);
  res.json(orders.map((o) => ({ ...o, items: safeParseJson(o.items, []) })));
});

// PATCH /api/branches/:id/orders/:orderId/status
router.patch("/:id/orders/:orderId/status", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);
  const orderId = Number(req.params.orderId);
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Estado inválido" });

  const existing = db.prepare("SELECT * FROM orders WHERE id = ? AND branch_id = ?").get(orderId, branchId);
  if (!existing) return res.status(404).json({ error: "Pedido no encontrado" });

  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  res.json({ ...updated, items: safeParseJson(updated.items, []) });
});

/* ══════════════════════════════════════════════════
   APP USERS (Customers)
   ══════════════════════════════════════════════════ */

// GET /api/branches/:id/customers (customers who ordered from this branch)
router.get("/:id/customers", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);

  // If ?all=1 and user is master, return all customers
  if (req.query.all === "1" && req.user?.role === "master") {
    const users = db.prepare(`
      SELECT u.*, COALESCE(s.order_count, 0) as order_count
      FROM app_users u
      LEFT JOIN (SELECT customer_phone, COUNT(*) as order_count FROM orders GROUP BY customer_phone) s
        ON u.phone = s.customer_phone
      ORDER BY u.id DESC
    `).all();
    return res.json(users);
  }

  // Return only customers who have placed orders in this branch
  const users = db.prepare(`
    SELECT u.*, SUM(o.total) as branch_spent, COUNT(o.id) as order_count, MAX(o.created_at) as last_branch_order
    FROM app_users u
    INNER JOIN orders o ON u.phone = o.customer_phone AND o.branch_id = ?
    GROUP BY u.id
    ORDER BY last_branch_order DESC
  `).all(branchId);

  // Override total_spent with branch-specific total
  const result = users.map((u) => ({
    ...u,
    total_spent: u.branch_spent || 0,
  }));

  res.json(result);
});

// GET /api/branches/:id/customers/map (customer coordinates for map)
router.get("/:id/customers/map", requireAuth, requireBranchAccess("id"), (req, res) => {
  const db = req.app.locals.db;
  const branchId = Number(req.params.id);

  // If ?all=1 and user is master, return customers from ALL branches
  if (req.query.all === "1" && req.user?.role === "master") {
    const customers = db.prepare(`
      SELECT o.customer_name as name, o.customer_phone as phone, o.lat, o.lng,
             sub.order_count as orderCount, sub.total_spent as totalSpent
      FROM orders o
      INNER JOIN (
        SELECT customer_phone, COUNT(*) as order_count,
               ROUND(SUM(total), 2) as total_spent, MAX(id) as last_order_id
        FROM orders
        WHERE lat IS NOT NULL AND lat != 0
        GROUP BY customer_phone
      ) sub ON o.id = sub.last_order_id
    `).all();

    const branch = db.prepare("SELECT address FROM branches WHERE id = ?").get(branchId);
    return res.json({ customers, branchAddress: branch?.address || "" });
  }

  // Get latest coordinates per customer from orders
  const customers = db.prepare(`
    SELECT o.customer_name as name, o.customer_phone as phone, o.lat, o.lng,
           sub.order_count as orderCount, sub.total_spent as totalSpent
    FROM orders o
    INNER JOIN (
      SELECT customer_phone, COUNT(*) as order_count,
             ROUND(SUM(total), 2) as total_spent, MAX(id) as last_order_id
      FROM orders
      WHERE branch_id = ? AND lat IS NOT NULL AND lat != 0
      GROUP BY customer_phone
    ) sub ON o.id = sub.last_order_id
  `).all(branchId);

  const branch = db.prepare("SELECT address FROM branches WHERE id = ?").get(branchId);

  res.json({
    customers,
    branchAddress: branch?.address || "",
  });
});

/* ── Helper ──────────────────────────────────── */

function applyMenuRule(basePrice, menu) {
  if (!menu || menu.price_rule === "none") return basePrice;
  let price = basePrice;
  if (menu.price_rule === "percentage") {
    price = basePrice * (1 + menu.price_value / 100);
  }
  switch (menu.rounding) {
    case "round_10":  price = Math.round(price / 10) * 10; break;
    case "round_50":  price = Math.round(price / 50) * 50; break;
    case "round_100": price = Math.round(price / 100) * 100; break;
  }
  return price;
}

function isPromotionActiveToday(promo) {
  if (!promo.is_active) return false;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (promo.weekly_repeat) {
    if (promo.date_from) {
      const fromDate = new Date(promo.date_from + "T12:00:00");
      if (fromDate.getDay() !== now.getDay()) return false;
    }
    if (promo.date_from && todayStr < promo.date_from) return false;
    if (promo.date_to && todayStr > promo.date_to) return false;
  } else {
    if (promo.date_from && todayStr < promo.date_from) return false;
    if (promo.date_to && todayStr > promo.date_to) return false;
  }

  // Time-of-day check
  if (promo.time_from || promo.time_to) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (promo.time_from) {
      const [h, m] = promo.time_from.split(":").map(Number);
      if (nowMinutes < h * 60 + (m || 0)) return false;
    }
    if (promo.time_to) {
      const [h, m] = promo.time_to.split(":").map(Number);
      if (nowMinutes >= h * 60 + (m || 0)) return false;
    }
  }

  return true;
}

function applyPromotionsToProducts(products, promoRows, db) {
  const activePromos = promoRows.filter(isPromotionActiveToday);
  if (activePromos.length === 0) return;

  const promoProductSets = {};
  const promoCategorySets = {};
  for (const promo of activePromos) {
    const scope = promo.apply_scope || (promo.apply_to_all ? "all" : "products");
    if (scope === "products") {
      const ppRows = db.prepare("SELECT product_id FROM promotion_products WHERE promotion_id = ?").all(promo.id);
      promoProductSets[promo.id] = new Set(ppRows.map((r) => String(r.product_id)));
    } else if (scope === "categories") {
      const pcRows = db.prepare("SELECT category_id FROM promotion_categories WHERE promotion_id = ?").all(promo.id);
      promoCategorySets[promo.id] = new Set(pcRows.map((r) => String(r.category_id)));
    }
  }

  for (const product of products) {
    let bestDiscount = 0;
    let bestPromoName = "";
    for (const promo of activePromos) {
      const scope = promo.apply_scope || (promo.apply_to_all ? "all" : "products");
      let applies = false;
      if (scope === "all") {
        applies = true;
      } else if (scope === "products") {
        applies = promoProductSets[promo.id]?.has(product.id) || false;
      } else if (scope === "categories") {
        applies = promoCategorySets[promo.id]?.has(product.categoryId) || false;
      }
      if (applies && promo.percentage > bestDiscount) {
        bestDiscount = promo.percentage;
        bestPromoName = promo.name;
      }
    }
    if (bestDiscount > 0) {
      if (product.basePrice != null) {
        product.originalPrice = product.basePrice;
        product.basePrice = Math.round(product.basePrice * (1 - bestDiscount / 100));
      }
      if (product.variants) {
        for (const v of product.variants) {
          v.originalPrice = v.price;
          v.price = Math.round(v.price * (1 - bestDiscount / 100));
        }
      }
      product.activePromotion = bestPromoName;
    }
  }
}

function readBranchState(db, branchId) {
  const branch = db.prepare("SELECT * FROM branches WHERE id = ?").get(branchId);
  if (!branch) return null;

  // Load menu for this branch (if any)
  const menu = branch.menu_id
    ? db.prepare("SELECT * FROM menus WHERE id = ?").get(branch.menu_id)
    : null;

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
      const isAvailable = override?.is_available !== null && override?.is_available !== undefined ? override.is_available : 1;
      const basePrice = override?.price_override !== null && override?.price_override !== undefined
        ? override.price_override
        : applyMenuRule(p.base_price, menu);

      if (!isAvailable) return null; // Skip unavailable products
      if (!p.is_active) return null; // Skip globally inactive products

      const variants = db
        .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
        .all(p.id)
        .map((v) => {
          const vOverride = variantOverrides[v.id];
          const vIsAvailable = vOverride?.is_available !== null && vOverride?.is_available !== undefined ? vOverride.is_available : 1;
          if (!vIsAvailable) return null; // Skip unavailable variants

          return {
            id: String(v.id),
            label: v.label,
            price: vOverride?.price_override !== null && vOverride?.price_override !== undefined
              ? vOverride.price_override
              : applyMenuRule(v.price, menu),
            stock: v.stock,
          };
        })
        .filter(Boolean);

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
        featured: !!p.is_featured,
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

  // Branch-specific data + cross-branch promotions
  const promoRows = db.prepare(`
    SELECT DISTINCT p.* FROM promotions p
    LEFT JOIN promotion_branches pb ON p.id = pb.promotion_id
    WHERE p.branch_id = ? OR p.apply_all_branches = 1 OR pb.branch_id = ?
    ORDER BY p.id
  `).all(branchId, branchId);
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

  // Apply active promotions to product prices
  applyPromotionsToProducts(products, promoRows, db);

  // Branch-specific data + cross-branch coupons
  const couponRows = db.prepare(`
    SELECT DISTINCT c.* FROM coupons c
    LEFT JOIN coupon_branches cb ON c.id = cb.coupon_id
    WHERE c.branch_id = ? OR c.apply_all_branches = 1 OR cb.branch_id = ?
    ORDER BY c.id
  `).all(branchId, branchId);
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
