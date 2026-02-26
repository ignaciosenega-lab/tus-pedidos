const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { getDb } = require("./db");
const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const catalogRoutes = require("./routes/catalog");
const branchesRoutes = require("./routes/branches");

const app = express();
const PORT = process.env.PORT || 3000;

/* ── Paths ────────────────────────────────────── */
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Initialize database on startup and share via app.locals
const db = getDb();
app.locals.db = db;
console.log("SQLite database initialized");

/* ── Middleware ────────────────────────────────── */
app.set("trust proxy", true); // Required behind EasyPanel reverse proxy
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Subdomain detection: extracts branch slug from Host header
// e.g. canning.pedidos.jirosushi.com.ar → slug "canning"
const BRANCH_DOMAIN = process.env.BRANCH_DOMAIN || ""; // e.g. "pedidos.jirosushi.com.ar"
console.log("BRANCH_DOMAIN configured as:", BRANCH_DOMAIN || "(not set)");
app.use((req, _res, next) => {
  req.branchSlug = null;
  const host = (req.hostname || req.headers.host || "").split(":")[0];
  if (BRANCH_DOMAIN && host.endsWith(BRANCH_DOMAIN)) {
    const prefix = host.slice(0, -(BRANCH_DOMAIN.length + 1)); // +1 for the dot
    if (prefix && prefix !== "master" && prefix !== "www") {
      req.branchSlug = prefix;
    }
  }
  next();
});

/* ══════════════════════════════════════════════════
   Schedule helpers
   ══════════════════════════════════════════════════ */

const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function isCurrentlyOpen(branch) {
  // Manual override: if admin toggled off, always closed
  if (!branch.is_open) return { open: false, reason: "manual", nextOpen: null, holidayReason: null };

  const schedule = safeParseJson(branch.schedule, {});
  const hours = schedule.hours;
  const holidays = schedule.holidays || [];

  // If no schedule configured, use manual toggle only
  if (!hours || Object.keys(hours).length === 0) {
    return { open: !!branch.is_open, reason: "manual", nextOpen: null, holidayReason: null };
  }

  const tz = branch.timezone || "America/Argentina/Buenos_Aires";
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const todayStr = formatter.format(now); // "YYYY-MM-DD"

  // Check holidays
  const holiday = holidays.find((h) => h.date === todayStr);
  if (holiday) {
    // Find next open day after today
    const nextOpen = findNextOpenTime(hours, holidays, tz, now);
    return { open: false, reason: "holiday", nextOpen, holidayReason: holiday.reason };
  }

  // Get current time in branch timezone
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  const currentTime = timeFmt.format(now).replace(/^24:/, "00:");
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" });
  const dayIndex = now.toLocaleDateString("en-US", { timeZone: tz, weekday: "narrow" });
  // Use getDay() equivalent via timezone
  const dayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: tz })).getDay();
  const dayName = DAY_NAMES[dayOfWeek];

  const daySchedule = hours[dayName];
  if (!daySchedule) {
    // Closed today by schedule
    const nextOpen = findNextOpenTime(hours, holidays, tz, now);
    return { open: false, reason: "schedule", nextOpen, holidayReason: null };
  }

  // Check if current time is within open hours
  const { open: openTime, close: closeTime } = daySchedule;
  let isWithinHours = false;

  if (closeTime > openTime) {
    // Same day: e.g. 19:00 - 23:30
    isWithinHours = currentTime >= openTime && currentTime < closeTime;
  } else {
    // Crosses midnight: e.g. 19:00 - 00:30
    isWithinHours = currentTime >= openTime || currentTime < closeTime;
  }

  if (isWithinHours) {
    return { open: true, reason: "schedule", nextOpen: null, holidayReason: null };
  }

  // Currently closed, find when it opens
  let nextOpen = null;
  if (currentTime < openTime) {
    // Opens later today
    nextOpen = openTime;
  } else {
    nextOpen = findNextOpenTime(hours, holidays, tz, now);
  }

  return { open: false, reason: "schedule", nextOpen, holidayReason: null };
}

function findNextOpenTime(hours, holidays, tz, now) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  for (let i = 1; i <= 7; i++) {
    const future = new Date(now.getTime() + i * 86400000);
    const futureStr = formatter.format(future);
    // Skip holidays
    if (holidays.some((h) => h.date === futureStr)) continue;
    const futureDow = new Date(future.toLocaleString("en-US", { timeZone: tz })).getDay();
    const dayName = DAY_NAMES[futureDow];
    const daySchedule = hours[dayName];
    if (daySchedule) return daySchedule.open;
  }
  return null;
}

/* ══════════════════════════════════════════════════
   DB → AdminState (GET /api/state)
   ══════════════════════════════════════════════════ */

function readStateFromDb(branchSlug) {
  // If a slug is provided, find that specific branch; otherwise use the first one
  const branch = branchSlug
    ? db.prepare("SELECT * FROM branches WHERE slug = ? AND is_active = 1").get(branchSlug)
    : db.prepare("SELECT * FROM branches WHERE is_active = 1 ORDER BY id LIMIT 1").get();
  if (!branch) return null;

  const branchId = branch.id;

  // ── Categories (with branch visibility filter) ──
  const catRows = db.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, id").all();
  const visibilityMap = {};
  db.prepare("SELECT category_id, is_visible FROM branch_category_visibility WHERE branch_id = ?")
    .all(branchId)
    .forEach((r) => { visibilityMap[r.category_id] = r.is_visible; });

  const categories = catRows
    .filter((c) => (visibilityMap[c.id] !== undefined ? visibilityMap[c.id] : true))
    .map((c) => ({ id: String(c.id), name: c.name }));

  // ── Branch overrides ──
  const productOverrides = {};
  db.prepare("SELECT * FROM branch_product_overrides WHERE branch_id = ?")
    .all(branchId)
    .forEach((o) => { productOverrides[o.product_id] = o; });

  const variantOverrides = {};
  db.prepare("SELECT * FROM branch_variant_overrides WHERE branch_id = ?")
    .all(branchId)
    .forEach((o) => { variantOverrides[o.variant_id] = o; });

  // ── Products + Variants + Toppings (with overrides applied) ──
  const prodRows = db.prepare("SELECT * FROM products ORDER BY id").all();
  const products = prodRows.map((p) => {
    const override = productOverrides[p.id];
    const isAvailable = override?.is_available !== null && override?.is_available !== undefined
      ? override.is_available : 1;
    if (!isAvailable || !p.is_active) return null;

    const variants = db
      .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id")
      .all(p.id)
      .map((v) => {
        const vOverride = variantOverrides[v.id];
        const vAvailable = vOverride?.is_available !== null && vOverride?.is_available !== undefined
          ? vOverride.is_available : 1;
        if (!vAvailable) return null;
        return {
          id: String(v.id),
          label: v.label,
          price: vOverride?.price_override != null ? vOverride.price_override : v.price,
          stock: v.stock != null ? v.stock : 0,
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

    const basePrice = override?.price_override != null ? override.price_override : p.base_price;

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
      product.stock = p.stock != null ? p.stock : 0;
    }
    if (variants.length > 0) {
      product.variants = variants;
    }

    return product;
  }).filter(Boolean);

  // ── Promotions ──
  const promoRows = db.prepare("SELECT * FROM promotions WHERE branch_id = ? ORDER BY id").all(branch.id);
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

  // ── Coupons ──
  const couponRows = db.prepare("SELECT * FROM coupons WHERE branch_id = ? ORDER BY id").all(branch.id);
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

  // ── Delivery Zones ──
  const zoneRows = db.prepare("SELECT * FROM delivery_zones WHERE branch_id = ? ORDER BY id").all(branch.id);
  const deliveryZones = zoneRows.map((z) => ({
    id: String(z.id),
    name: z.name,
    polygon: safeParseJson(z.polygon, []),
    cost: z.cost,
    active: !!z.is_active,
    color: z.color,
  }));

  // ── App Users ──
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

  // ── Business Config (from branch) ──
  const openStatus = isCurrentlyOpen(branch);
  const schedule = safeParseJson(branch.schedule, {});
  const businessConfig = {
    title: branch.name,
    email: branch.email,
    address: branch.address,
    addressUrl: branch.address_url,
    url: branch.url,
    description: branch.description,
    phone: branch.phone,
    isOpen: openStatus.open,
    closedReason: openStatus.open ? null : openStatus.reason,
    nextOpenTime: openStatus.nextOpen,
    holidayReason: openStatus.holidayReason,
    schedule,
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
    branchId: branch.id,
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

/* ══════════════════════════════════════════════════
   AdminState → DB (POST /api/state)
   ══════════════════════════════════════════════════ */

const writeStateToDb = db.transaction((state, branchSlug) => {
  // Find the target branch by slug, or default to the first one
  let branch = branchSlug
    ? db.prepare("SELECT * FROM branches WHERE slug = ?").get(branchSlug)
    : db.prepare("SELECT * FROM branches ORDER BY id LIMIT 1").get();
  if (!branch) {
    db.prepare("INSERT INTO branches (slug, name) VALUES ('principal', 'Sucursal Principal')").run();
    branch = db.prepare("SELECT * FROM branches ORDER BY id LIMIT 1").get();
  }
  const branchId = branch.id;

  // ── Update branch config ──
  const biz = state.businessConfig || {};
  const pay = state.paymentConfig || {};
  const style = state.styleConfig || {};

  db.prepare(`
    UPDATE branches SET
      name = @name, address = @address, address_url = @address_url,
      whatsapp = @whatsapp, phone = @phone, email = @email,
      description = @description, url = @url, is_open = @is_open,
      logo = @logo, favicon = @favicon, banners = @banners,
      slider_images = @slider_images, social_links = @social_links,
      style_config = @style_config, payment_config = @payment_config,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: branchId,
    name: biz.title || "Sucursal Principal",
    address: biz.address || "",
    address_url: biz.addressUrl || "",
    whatsapp: biz.whatsapp || "",
    phone: biz.phone || "",
    email: biz.email || "",
    description: biz.description || "",
    url: biz.url || "",
    is_open: biz.isOpen !== false ? 1 : 0,
    logo: biz.logo || "",
    favicon: biz.favicon || "",
    banners: JSON.stringify(biz.banners || []),
    slider_images: JSON.stringify(biz.sliderImages || []),
    social_links: JSON.stringify(biz.socialLinks || []),
    style_config: JSON.stringify(style),
    payment_config: JSON.stringify(pay),
  });

  // ── Clear existing data (order matters for FK constraints) ──
  db.prepare("DELETE FROM promotion_products").run();
  db.prepare("DELETE FROM promotions WHERE branch_id = ?").run(branchId);
  db.prepare("DELETE FROM coupon_targets").run();
  db.prepare("DELETE FROM coupons WHERE branch_id = ?").run(branchId);
  db.prepare("DELETE FROM delivery_zones WHERE branch_id = ?").run(branchId);
  db.prepare("DELETE FROM product_toppings").run();
  db.prepare("DELETE FROM product_variants").run();
  db.prepare("DELETE FROM branch_product_overrides").run();
  db.prepare("DELETE FROM branch_variant_overrides").run();
  db.prepare("DELETE FROM branch_category_visibility").run();
  db.prepare("DELETE FROM products").run();
  db.prepare("DELETE FROM categories").run();
  db.prepare("DELETE FROM app_users").run();

  // ── Categories ──
  const cats = state.categories || [];
  const catIdMap = {}; // old string id → new integer id
  const insertCat = db.prepare(
    "INSERT INTO categories (name, sort_order, is_active) VALUES (@name, @sort_order, 1)"
  );
  cats.forEach((cat, idx) => {
    if (cat.id === "all") {
      catIdMap[cat.id] = null;
      return;
    }
    const result = insertCat.run({ name: cat.name, sort_order: idx });
    catIdMap[cat.id] = Number(result.lastInsertRowid);
  });

  // ── Products + Variants + Toppings ──
  const products = state.products || [];
  const prodIdMap = {};
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, category_id, image_url, type, base_price, stock, badges, is_active, is_featured, is_private, gallery)
    VALUES (@name, @description, @category_id, @image_url, @type, @base_price, @stock, @badges, @is_active, @is_featured, @is_private, @gallery)
  `);
  const insertVariant = db.prepare(
    "INSERT INTO product_variants (product_id, label, price, stock, sort_order) VALUES (@product_id, @label, @price, @stock, @sort_order)"
  );
  const insertTopping = db.prepare(
    "INSERT INTO product_toppings (product_id, name, price, sort_order) VALUES (@product_id, @name, @price, @sort_order)"
  );

  products.forEach((p) => {
    const categoryId = catIdMap[p.categoryId];
    if (!categoryId) return;

    const result = insertProduct.run({
      name: p.name,
      description: p.description || "",
      category_id: categoryId,
      image_url: p.imageUrl || "",
      type: p.type || "simple",
      base_price: p.basePrice || 0,
      stock: p.stock != null ? p.stock : null,
      badges: JSON.stringify(p.badges || []),
      is_active: p.status !== "baja" ? 1 : 0,
      is_featured: p.featured ? 1 : 0,
      is_private: p.private ? 1 : 0,
      gallery: JSON.stringify(p.gallery || []),
    });
    const productId = Number(result.lastInsertRowid);
    prodIdMap[p.id] = productId;

    if (p.variants) {
      p.variants.forEach((v, idx) => {
        insertVariant.run({
          product_id: productId,
          label: v.label,
          price: v.price,
          stock: v.stock != null ? v.stock : null,
          sort_order: idx,
        });
      });
    }

    if (p.toppings) {
      p.toppings.forEach((t, idx) => {
        insertTopping.run({
          product_id: productId,
          name: t.name,
          price: t.price,
          sort_order: idx,
        });
      });
    }
  });

  // ── Promotions ──
  const promos = state.promotions || [];
  const insertPromo = db.prepare(`
    INSERT INTO promotions (branch_id, name, percentage, apply_to_all, date_from, date_to, weekly_repeat, is_active)
    VALUES (@branch_id, @name, @percentage, @apply_to_all, @date_from, @date_to, @weekly_repeat, 1)
  `);
  const insertPromoProduct = db.prepare(
    "INSERT INTO promotion_products (promotion_id, product_id) VALUES (@promotion_id, @product_id)"
  );
  promos.forEach((promo) => {
    const result = insertPromo.run({
      branch_id: branchId,
      name: promo.name,
      percentage: promo.percentage || 0,
      apply_to_all: promo.applyToAll ? 1 : 0,
      date_from: promo.dateFrom || "",
      date_to: promo.dateTo || "",
      weekly_repeat: promo.weeklyRepeat ? 1 : 0,
    });
    const promoId = Number(result.lastInsertRowid);

    if (!promo.applyToAll && promo.productIds) {
      promo.productIds.forEach((pid) => {
        const newPid = prodIdMap[pid];
        if (newPid) {
          insertPromoProduct.run({ promotion_id: promoId, product_id: newPid });
        }
      });
    }
  });

  // ── Coupons ──
  const coupons = state.coupons || [];
  const insertCoupon = db.prepare(`
    INSERT INTO coupons (branch_id, code, name, type, value, min_order, max_uses, used_count, apply_to, active_days, time_from, time_to, date_from, date_to, is_active)
    VALUES (@branch_id, @code, @name, @type, @value, @min_order, @max_uses, @used_count, @apply_to, @active_days, @time_from, @time_to, @date_from, @date_to, @is_active)
  `);
  const insertCouponTarget = db.prepare(
    "INSERT INTO coupon_targets (coupon_id, target_type, target_id) VALUES (@coupon_id, @target_type, @target_id)"
  );
  coupons.forEach((c) => {
    const result = insertCoupon.run({
      branch_id: branchId,
      code: c.code,
      name: c.name || "",
      type: c.type || "percentage",
      value: c.value || 0,
      min_order: c.minOrder || 0,
      max_uses: c.maxUses || 0,
      used_count: c.usedCount || 0,
      apply_to: c.applyTo || "all",
      active_days: JSON.stringify(c.activeDays || []),
      time_from: c.timeFrom || "",
      time_to: c.timeTo || "",
      date_from: c.dateFrom || "",
      date_to: c.dateTo || "",
      is_active: c.active !== false ? 1 : 0,
    });
    const couponId = Number(result.lastInsertRowid);

    if (c.applyTo === "categories" && c.categoryIds) {
      c.categoryIds.forEach((catStr) => {
        const newCatId = catIdMap[catStr];
        if (newCatId) {
          insertCouponTarget.run({ coupon_id: couponId, target_type: "category", target_id: newCatId });
        }
      });
    }
    if (c.applyTo === "products" && c.productIds) {
      c.productIds.forEach((pid) => {
        const newPid = prodIdMap[pid];
        if (newPid) {
          insertCouponTarget.run({ coupon_id: couponId, target_type: "product", target_id: newPid });
        }
      });
    }
  });

  // ── Delivery Zones ──
  const zones = state.deliveryZones || [];
  const insertZone = db.prepare(
    "INSERT INTO delivery_zones (branch_id, name, polygon, cost, is_active, color) VALUES (@branch_id, @name, @polygon, @cost, @is_active, @color)"
  );
  zones.forEach((z) => {
    insertZone.run({
      branch_id: branchId,
      name: z.name,
      polygon: JSON.stringify(z.polygon || []),
      cost: z.cost || 0,
      is_active: z.active !== false ? 1 : 0,
      color: z.color || "#3B82F6",
    });
  });

  // ── App Users ──
  const users = state.users || [];
  const insertAppUser = db.prepare(
    "INSERT INTO app_users (name, email, phone, address, status, total_spent, last_order_date, registered_at) VALUES (@name, @email, @phone, @address, @status, @total_spent, @last_order_date, @registered_at)"
  );
  users.forEach((u) => {
    insertAppUser.run({
      name: u.name,
      email: u.email || "",
      phone: u.phone || "",
      address: u.address || "",
      status: u.status || "activo",
      total_spent: u.totalSpent || 0,
      last_order_date: u.lastOrderDate || null,
      registered_at: u.registeredAt || new Date().toISOString(),
    });
  });
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

/* ── API Routes ──────────────────────────────── */

// Auth & Users
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

// Global Catalog (master only)
app.use("/api/catalog", catalogRoutes);

// Branches & Overrides
app.use("/api/branches", branchesRoutes);

// Get state (public — storefront needs to read products)
// Uses subdomain detection: canning.pedidos.jirosushi.com.ar → branchSlug "canning"
app.get("/api/state", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  try {
    const state = readStateFromDb(req.branchSlug);
    if (!state) {
      return res.json(null);
    }
    res.json(state);
  } catch (e) {
    console.error("Error reading state from DB:", e.message);
    res.status(500).json({ error: "Error leyendo datos" });
  }
});

// Save state (admin only)
// Branch admins save to their own branch; master saves to the branch from subdomain or default
app.post("/api/state", requireAuth, (req, res) => {
  try {
    const branchSlug = req.branchSlug || (req.user?.branch_id
      ? db.prepare("SELECT slug FROM branches WHERE id = ?").get(req.user.branch_id)?.slug
      : null);
    writeStateToDb(req.body, branchSlug);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error saving state to DB:", e.message);
    res.status(500).json({ error: "Error guardando datos" });
  }
});

/* ══════════════════════════════════════════════════
   Public order creation (POST /api/orders)
   Called from the storefront when a customer sends via WhatsApp
   ══════════════════════════════════════════════════ */
app.post("/api/orders", (req, res) => {
  try {
    const {
      branchId, customerName, customerPhone, customerEmail,
      deliveryType, address, lat, lng, floor,
      date, time, instructions, paymentMethod,
      items, subtotal, deliveryCost, discount, total, couponCode,
    } = req.body;

    if (!branchId || !customerName || !customerPhone) {
      return res.status(400).json({ error: "branchId, customerName y customerPhone son requeridos" });
    }

    // Upsert customer in app_users by phone
    const cleanPhone = customerPhone.replace(/\D/g, "");
    let customer = db.prepare("SELECT * FROM app_users WHERE phone = ?").get(cleanPhone);
    if (!customer) {
      db.prepare(
        "INSERT INTO app_users (name, phone, email, address) VALUES (?, ?, ?, ?)"
      ).run(customerName, cleanPhone, customerEmail || "", address || "");
      customer = db.prepare("SELECT * FROM app_users WHERE phone = ?").get(cleanPhone);
    } else {
      // Update name/address if they changed
      db.prepare("UPDATE app_users SET name = ?, address = ? WHERE id = ?")
        .run(customerName, address || customer.address, customer.id);
    }

    // Insert order
    const orderTotal = total || 0;
    const result = db.prepare(`
      INSERT INTO orders (
        branch_id, customer_name, customer_phone,
        delivery_type, address, lat, lng, floor,
        date, time, instructions, payment_method,
        items, subtotal, delivery_cost, discount, total, coupon_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      branchId, customerName, cleanPhone,
      deliveryType || "delivery", address || "", lat || null, lng || null, floor || "",
      date || "", time || "", instructions || "", paymentMethod || "Efectivo",
      JSON.stringify(items || []), subtotal || 0, deliveryCost || 0, discount || 0, orderTotal, couponCode || null,
    );

    // Update total_spent and last_order_date on customer
    db.prepare(
      "UPDATE app_users SET total_spent = total_spent + ?, last_order_date = datetime('now') WHERE id = ?"
    ).run(orderTotal, customer.id);

    res.status(201).json({ ok: true, orderId: result.lastInsertRowid });
  } catch (e) {
    console.error("Error creating order:", e.message);
    res.status(500).json({ error: "Error creando pedido" });
  }
});

// Upload image (admin only)
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten imágenes"));
  },
});

app.post("/api/upload", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibió imagen" });
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
});

// Serve uploaded images
app.use("/api/uploads", express.static(UPLOADS_DIR));

/* ── Serve frontend (production) ─────────────── */
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  // Branch-specific storefront
  app.get("/s/:slug", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

/* ── Start ────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`TusPedidos API running on port ${PORT}`);
});
