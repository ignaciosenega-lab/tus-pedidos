const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { getDb } = require("./db");
const os = require("os");
const { execSync } = require("child_process");
const { requireAuth, requireRole } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const catalogRoutes = require("./routes/catalog");
const branchesRoutes = require("./routes/branches");
const menusRoutes = require("./routes/menus");
const campaignsRoutes = require("./routes/campaigns");
const { processCampaignQueue } = require("./services/campaignWorker");

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

  // Check if branch is temporarily paused
  if (branch.paused_until) {
    const pausedUntil = new Date(branch.paused_until);
    if (pausedUntil > new Date()) {
      return { open: false, reason: "paused", nextOpen: branch.paused_until, holidayReason: null };
    }
  }

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
   Menu price rule helpers
   ══════════════════════════════════════════════════ */

function applyMenuRule(basePrice, menu) {
  if (!menu || menu.price_rule === "none") return basePrice;
  let price = basePrice;
  if (menu.price_rule === "percentage") {
    price = basePrice * (1 + menu.price_value / 100);
  }
  // Rounding
  switch (menu.rounding) {
    case "round_10":  price = Math.round(price / 10) * 10; break;
    case "round_50":  price = Math.round(price / 50) * 50; break;
    case "round_100": price = Math.round(price / 100) * 100; break;
  }
  return price;
}

/* ══════════════════════════════════════════════════
   Promotion helpers
   ══════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════
   DB → AdminState (GET /api/state)
   ══════════════════════════════════════════════════ */

function readStateFromDb(branchSlug) {
  // If a slug is provided, find that specific branch; otherwise use the first one
  let branch = null;
  if (branchSlug) {
    branch = db.prepare("SELECT * FROM branches WHERE slug = ? AND is_active = 1").get(branchSlug);
    // Fallback: match slug ignoring hyphens (e.g. "laplata" matches "la-plata")
    if (!branch) {
      const normalized = branchSlug.replace(/-/g, "");
      const all = db.prepare("SELECT * FROM branches WHERE is_active = 1").all();
      branch = all.find((b) => b.slug.replace(/-/g, "") === normalized) || null;
    }
  } else {
    branch = db.prepare("SELECT * FROM branches WHERE is_active = 1 ORDER BY id LIMIT 1").get();
  }
  if (!branch) return null;

  const branchId = branch.id;

  // ── Load menu for this branch (if any) ──
  const menu = branch.menu_id
    ? db.prepare("SELECT * FROM menus WHERE id = ?").get(branch.menu_id)
    : null;

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
        const vPrice = vOverride?.price_override != null
          ? vOverride.price_override
          : applyMenuRule(v.price, menu);
        return {
          id: String(v.id),
          label: v.label,
          price: vPrice,
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

    const basePrice = override?.price_override != null
      ? override.price_override
      : applyMenuRule(p.base_price, menu);

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

  // ── Promotions (own + cross-branch) ──
  const promoRows = db.prepare(`
    SELECT DISTINCT p.* FROM promotions p
    LEFT JOIN promotion_branches pb ON p.id = pb.promotion_id
    WHERE p.branch_id = ? OR p.apply_all_branches = 1 OR pb.branch_id = ?
    ORDER BY p.id
  `).all(branch.id, branch.id);
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

  // ── Active promotions (for storefront banner) ──
  const activePromotions = promoRows
    .filter(isPromotionActiveToday)
    .map((pr) => ({
      id: String(pr.id),
      name: pr.name,
      percentage: pr.percentage,
      timeTo: pr.time_to || null,
    }));

  // ── Apply active promotions to product prices ──
  applyPromotionsToProducts(products, promoRows, db);

  // ── Coupons (own + cross-branch) ──
  const couponRows = db.prepare(`
    SELECT DISTINCT c.* FROM coupons c
    LEFT JOIN coupon_branches cb ON c.id = cb.coupon_id
    WHERE c.branch_id = ? OR c.apply_all_branches = 1 OR cb.branch_id = ?
    ORDER BY c.id
  `).all(branch.id, branch.id);
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
      firstPurchaseOnly: !!(c.first_purchase_only),
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
  // Inherit logo/favicon from master branch if not set
  let logo = branch.logo;
  let favicon = branch.favicon;
  if (!logo || !favicon) {
    const master = db.prepare("SELECT logo, favicon FROM branches WHERE is_active = 1 ORDER BY id LIMIT 1").get();
    if (master) {
      if (!logo) logo = master.logo;
      if (!favicon) favicon = master.favicon;
    }
  }
  // Direct pause check (redundant safety — also checked in isCurrentlyOpen)
  const rawPausedUntil = branch.paused_until || null;
  const isPausedNow = rawPausedUntil && new Date(rawPausedUntil) > new Date();
  const finalIsOpen = isPausedNow ? false : openStatus.open;
  const finalReason = isPausedNow ? "paused" : (openStatus.open ? null : openStatus.reason);

  const businessConfig = {
    title: branch.name,
    email: branch.email,
    address: branch.address,
    addressUrl: branch.address_url,
    url: branch.url,
    description: branch.description,
    phone: branch.phone,
    isOpen: finalIsOpen,
    closedReason: finalReason,
    nextOpenTime: isPausedNow ? rawPausedUntil : openStatus.nextOpen,
    holidayReason: openStatus.holidayReason,
    isPaused: !!isPausedNow,
    pausedUntil: rawPausedUntil,
    schedule,
    logo,
    favicon,
    banners: safeParseJson(branch.banners, []),
    whatsapp: branch.whatsapp,
    socialLinks: safeParseJson(branch.social_links, []),
    sliderImages: safeParseJson(branch.slider_images, []),
  };

  const paymentConfig = safeParseJson(branch.payment_config, {});
  let styleConfig = safeParseJson(branch.style_config, {});
  // Inherit style from master branch if this branch has no custom styles
  if (Object.keys(styleConfig).length === 0) {
    const masterBranch = db.prepare("SELECT style_config FROM branches WHERE is_active = 1 ORDER BY id LIMIT 1").get();
    if (masterBranch) {
      styleConfig = safeParseJson(masterBranch.style_config, {});
    }
  }

  return {
    branchId: branch.id,
    products,
    categories,
    promotions,
    activePromotions,
    coupons,
    deliveryZones,
    users,
    businessConfig,
    paymentConfig,
    styleConfig,
    delayMinutes: branch.delay_minutes || 30,
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
      updated_at = datetime('now', 'localtime')
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

// Menus (pricing templates)
app.use("/api/menus", menusRoutes);

// System resources (master only)
let prevNetRx = null;
let prevNetTx = null;
let prevNetTime = null;

app.get("/api/system/resources", requireAuth, requireRole("master"), (req, res) => {
  try {
    // CPU
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const loadAvg = os.loadavg();
    const cpuUsage = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100 * 10) / 10);

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 1000) / 10;

    // Disk
    let diskTotal = 0, diskUsed = 0, diskPercent = 0;
    try {
      const dfOut = execSync("df -B1 / 2>/dev/null | tail -1", { encoding: "utf-8" }).trim();
      const parts = dfOut.split(/\s+/);
      if (parts.length >= 4) {
        diskTotal = parseInt(parts[1], 10) || 0;
        diskUsed = parseInt(parts[2], 10) || 0;
        diskPercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 1000) / 10 : 0;
      }
    } catch { /* ignore on non-linux */ }

    // Network (bytes since last call)
    let netRxSpeed = 0, netTxSpeed = 0;
    try {
      const netOut = execSync("cat /proc/net/dev 2>/dev/null", { encoding: "utf-8" });
      let totalRx = 0, totalTx = 0;
      for (const line of netOut.split("\n")) {
        const match = line.match(/^\s*(\w+):\s+(\d+)(?:\s+\d+){7}\s+(\d+)/);
        if (match && match[1] !== "lo") {
          totalRx += parseInt(match[2], 10);
          totalTx += parseInt(match[3], 10);
        }
      }
      const now = Date.now();
      if (prevNetRx !== null && prevNetTime !== null) {
        const elapsed = (now - prevNetTime) / 1000;
        if (elapsed > 0) {
          netRxSpeed = Math.max(0, (totalRx - prevNetRx) / elapsed);
          netTxSpeed = Math.max(0, (totalTx - prevNetTx) / elapsed);
        }
      }
      prevNetRx = totalRx;
      prevNetTx = totalTx;
      prevNetTime = now;
    } catch { /* ignore on non-linux */ }

    // Uptime
    const uptimeSecs = os.uptime();

    res.json({
      cpu: { percent: cpuUsage, cores: cpuCount, loadAvg: loadAvg.map((l) => Math.round(l * 100) / 100) },
      memory: { percent: memPercent, used: usedMem, total: totalMem },
      disk: { percent: diskPercent, used: diskUsed, total: diskTotal },
      network: { rxBytesPerSec: Math.round(netRxSpeed), txBytesPerSec: Math.round(netTxSpeed) },
      uptime: uptimeSecs,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener recursos" });
  }
});

// Public branch listing for branch selector (master domain)
// Must be BEFORE the branches router so /:id doesn't capture "public"
app.get("/api/branches/public", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const branches = db.prepare("SELECT * FROM branches WHERE is_active = 1 AND slug != 'master' ORDER BY name").all();
    const result = branches.map((b) => {
      const openStatus = isCurrentlyOpen(b);
      return {
        id: b.id,
        slug: b.slug,
        name: b.name,
        address: b.address,
        addressUrl: b.address_url,
        phone: b.phone,
        whatsapp: b.whatsapp,
        logo: b.logo,
        isOpen: openStatus.open,
        nextOpenTime: openStatus.nextOpen,
        holidayReason: openStatus.holidayReason,
      };
    });
    res.json({ branches: result, branchDomain: BRANCH_DOMAIN });
  } catch (e) {
    console.error("Error listing public branches:", e.message);
    res.status(500).json({ error: "Error listando sucursales" });
  }
});

// Branches & Overrides
app.use("/api/branches", branchesRoutes);

// Campaigns
app.use("/api/campaigns", campaignsRoutes);

// Get state (public — storefront needs to read products)
// Uses subdomain detection: canning.pedidos.jirosushi.com.ar → branchSlug "canning"
app.get("/api/state", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  try {
    // If on master domain (no branchSlug), return isMaster flag instead of first branch
    if (!req.branchSlug) {
      // Get first branch's style for theming the master page
      const firstBranch = db.prepare("SELECT * FROM branches WHERE is_active = 1 ORDER BY id LIMIT 1").get();
      const styleConfig = firstBranch ? safeParseJson(firstBranch.style_config, {}) : {};
      const businessConfig = firstBranch ? {
        title: firstBranch.name,
        logo: firstBranch.logo,
        favicon: firstBranch.favicon,
      } : {};
      return res.json({ isMaster: true, branchDomain: BRANCH_DOMAIN, styleConfig, businessConfig });
    }

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
   Public coupon validation (POST /api/coupons/validate)
   ══════════════════════════════════════════════════ */
app.post("/api/coupons/validate", (req, res) => {
  try {
    const { branchId, code, subtotal, items } = req.body;
    if (!branchId || !code) {
      return res.status(400).json({ valid: false, message: "Código requerido" });
    }

    const coupon = db.prepare(`
      SELECT DISTINCT c.* FROM coupons c
      LEFT JOIN coupon_branches cb ON c.id = cb.coupon_id
      WHERE UPPER(c.code) = UPPER(?) AND c.is_active = 1
        AND (c.branch_id = ? OR c.apply_all_branches = 1 OR cb.branch_id = ?)
    `).get(code.trim(), branchId, branchId);

    if (!coupon) {
      return res.json({ valid: false, message: "Cupón no encontrado o inactivo" });
    }

    // Check date range
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (coupon.date_from && todayStr < coupon.date_from) {
      return res.json({ valid: false, message: "Este cupón aún no está vigente" });
    }
    if (coupon.date_to && todayStr > coupon.date_to) {
      return res.json({ valid: false, message: "Este cupón ya venció" });
    }

    // Check active days
    const activeDays = safeParseJson(coupon.active_days, []);
    if (activeDays.length > 0 && !activeDays.includes(now.getDay())) {
      return res.json({ valid: false, message: "Este cupón no aplica hoy" });
    }

    // Check time range
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (coupon.time_from && hhmm < coupon.time_from) {
      return res.json({ valid: false, message: "Este cupón aún no está activo en este horario" });
    }
    if (coupon.time_to && hhmm > coupon.time_to) {
      return res.json({ valid: false, message: "Este cupón ya no está activo en este horario" });
    }

    // Check max uses
    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
      return res.json({ valid: false, message: "Este cupón ya alcanzó el límite de usos" });
    }

    // Check min order
    if (coupon.min_order > 0 && (subtotal || 0) < coupon.min_order) {
      return res.json({ valid: false, message: `Pedido mínimo de $${coupon.min_order} para este cupón` });
    }

    // Calculate discount based on apply_to
    let applicableTotal = subtotal || 0;
    if (coupon.apply_to !== "all" && items && items.length > 0) {
      const targets = db.prepare("SELECT * FROM coupon_targets WHERE coupon_id = ?").all(coupon.id);
      const targetCatIds = targets.filter((t) => t.target_type === "category").map((t) => String(t.target_id));
      const targetProdIds = targets.filter((t) => t.target_type === "product").map((t) => String(t.target_id));

      applicableTotal = items.reduce((sum, item) => {
        const matchesCat = coupon.apply_to === "categories" && targetCatIds.includes(String(item.categoryId));
        const matchesProd = coupon.apply_to === "products" && targetProdIds.includes(String(item.productId));
        if (matchesCat || matchesProd) {
          return sum + (item.price || 0) * (item.quantity || 1);
        }
        return sum;
      }, 0);

      if (applicableTotal === 0) {
        return res.json({ valid: false, message: "Este cupón no aplica a los productos de tu pedido" });
      }
    }

    let discount = 0;
    if (coupon.type === "percentage") {
      discount = Math.round(applicableTotal * coupon.value / 100);
    } else {
      discount = Math.min(coupon.value, applicableTotal);
    }

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value,
        discount,
      },
      message: coupon.type === "percentage"
        ? `${coupon.name} — ${coupon.value}% de descuento`
        : `${coupon.name} — $${coupon.value} de descuento`,
    });
  } catch (e) {
    console.error("Error validating coupon:", e.message);
    res.status(500).json({ valid: false, message: "Error validando cupón" });
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
    // Extract neighborhood from address (second comma part, strip postal code like "B1842")
    const addrParts = (address || "").split(",").map((s) => s.trim());
    const rawNeighborhood = addrParts.length >= 2 ? addrParts[1] : "";
    const neighborhood = rawNeighborhood.replace(/^[A-Z]\d{4}[A-Z]{0,3}\s*/i, "").trim();
    let customer = db.prepare("SELECT * FROM app_users WHERE phone = ?").get(cleanPhone);
    if (!customer) {
      db.prepare(
        "INSERT INTO app_users (name, phone, email, address, neighborhood) VALUES (?, ?, ?, ?, ?)"
      ).run(customerName, cleanPhone, customerEmail || "", address || "", neighborhood);
      customer = db.prepare("SELECT * FROM app_users WHERE phone = ?").get(cleanPhone);
    } else {
      // Update name/address/neighborhood if they changed
      db.prepare("UPDATE app_users SET name = ?, address = ?, neighborhood = ? WHERE id = ?")
        .run(customerName, address || customer.address, neighborhood || customer.neighborhood, customer.id);
    }

    // Validate first_purchase_only coupon
    if (couponCode) {
      const coupon = db.prepare("SELECT * FROM coupons WHERE code = ? AND is_active = 1").get(couponCode.toUpperCase());
      if (coupon && coupon.first_purchase_only) {
        const alreadyUsed = db.prepare(
          "SELECT COUNT(*) as count FROM orders WHERE customer_phone = ? AND coupon_code = ?"
        ).get(cleanPhone, couponCode.toUpperCase());
        if (alreadyUsed.count > 0) {
          return res.status(400).json({ error: "Este cupón es solo para primera compra y ya fue utilizado" });
        }
      }
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
      "UPDATE app_users SET total_spent = total_spent + ?, last_order_date = datetime('now', 'localtime') WHERE id = ?"
    ).run(orderTotal, customer.id);

    res.status(201).json({ ok: true, orderId: result.lastInsertRowid });
  } catch (e) {
    console.error("Error creating order:", e.message);
    res.status(500).json({ error: "Error creando pedido" });
  }
});

/* ══════════════════════════════════════════════════
   Analytics event tracking (public, called from storefront)
   ══════════════════════════════════════════════════ */
app.post("/api/analytics/event", (req, res) => {
  try {
    const { branchId, eventType, productId, sessionId } = req.body;
    const validTypes = ["session", "product_view", "checkout_start", "order_placed"];
    if (!branchId || !validTypes.includes(eventType)) {
      return res.status(400).json({ error: "Invalid event" });
    }
    db.prepare(
      "INSERT INTO analytics_events (branch_id, event_type, product_id, session_id) VALUES (?, ?, ?, ?)"
    ).run(branchId, eventType, productId || null, sessionId || "");
    res.json({ ok: true });
  } catch (e) {
    console.error("Error tracking event:", e.message);
    res.status(500).json({ error: "Error" });
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

/* ══════════════════════════════════════════════════
   Twilio Webhooks (public, no auth)
   ══════════════════════════════════════════════════ */

// Message status updates (sent/delivered/read/failed)
app.post("/api/webhooks/twilio/status", (req, res) => {
  const { MessageSid, MessageStatus } = req.body;
  if (!MessageSid || !MessageStatus) return res.sendStatus(200);

  const msg = db.prepare("SELECT * FROM campaign_messages WHERE twilio_sid = ?").get(MessageSid);
  if (!msg) return res.sendStatus(200);

  const statusMap = { sent: "sent", delivered: "delivered", read: "read", failed: "failed", undelivered: "undelivered" };
  const newStatus = statusMap[MessageStatus];
  if (!newStatus) return res.sendStatus(200);

  db.prepare("UPDATE campaign_messages SET status = ? WHERE id = ?").run(newStatus, msg.id);

  if (newStatus === "delivered") {
    db.prepare("UPDATE campaign_messages SET delivered_at = datetime('now', 'localtime') WHERE id = ?").run(msg.id);
    db.prepare("UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = ?").run(msg.campaign_id);
  } else if (newStatus === "read") {
    db.prepare("UPDATE campaign_messages SET read_at = datetime('now', 'localtime') WHERE id = ?").run(msg.id);
    db.prepare("UPDATE campaigns SET read_count = read_count + 1 WHERE id = ?").run(msg.campaign_id);
  } else if (newStatus === "failed" || newStatus === "undelivered") {
    db.prepare("UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?").run(msg.campaign_id);
  }

  res.sendStatus(200);
});

// Incoming messages (opt-out handling)
app.post("/api/webhooks/twilio/incoming", (req, res) => {
  const { From, Body } = req.body;
  if (!From || !Body) return res.sendStatus(200);

  const phone = From.replace("whatsapp:", "").replace(/\D/g, "");
  const bodyLower = Body.trim().toLowerCase();

  // Check for opt-out keywords
  if (["stop", "parar", "no", "baja", "cancelar"].includes(bodyLower)) {
    db.prepare("UPDATE campaign_contacts SET opted_out = 1, opted_out_at = datetime('now', 'localtime') WHERE phone = ?").run(phone);
  }

  // Increment replied_count on latest campaign for this contact
  const contact = db.prepare("SELECT id FROM campaign_contacts WHERE phone = ?").get(phone);
  if (contact) {
    const latestMsg = db.prepare(
      "SELECT campaign_id FROM campaign_messages WHERE contact_id = ? ORDER BY id DESC LIMIT 1"
    ).get(contact.id);
    if (latestMsg) {
      db.prepare("UPDATE campaigns SET replied_count = replied_count + 1 WHERE id = ?").run(latestMsg.campaign_id);
    }
  }

  res.sendStatus(200);
});

/* ── Campaign Worker ─────────────────────────── */
setInterval(() => {
  try {
    processCampaignQueue(db);
  } catch (err) {
    console.error("Campaign worker error:", err.message);
  }
}, 5000);

/* ── Start ────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`TusPedidos API running on port ${PORT}`);
});
