/**
 * Migration script: state.json → SQLite
 *
 * Reads the legacy state.json file and inserts all data into the SQLite database.
 * Safe to run multiple times — it clears tables before inserting.
 *
 * Usage: node server/db/migrate-from-json.js [path-to-state.json]
 */
const path = require("path");
const fs = require("fs");
const { getDb, closeDb } = require("./index");

const STATE_FILE =
  process.argv[2] || path.join(__dirname, "..", "data", "state.json");

if (!fs.existsSync(STATE_FILE)) {
  console.log("No state.json found at:", STATE_FILE);
  console.log("Nothing to migrate. The database has been initialized with an empty schema.");
  // Still initialize DB (getDb runs schema)
  getDb();
  closeDb();
  process.exit(0);
}

console.log("Reading state.json from:", STATE_FILE);
const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));

const db = getDb();

// Run everything in a transaction
const migrate = db.transaction(() => {
  // ── 1. Create a default branch from businessConfig ──
  const biz = state.businessConfig || {};
  const pay = state.paymentConfig || {};
  const style = state.styleConfig || {};

  const branchSlug = "principal";
  const insertBranch = db.prepare(`
    INSERT INTO branches (slug, name, address, address_url, whatsapp, phone, email, description, url, is_open, logo, favicon, banners, slider_images, social_links, style_config, payment_config)
    VALUES (@slug, @name, @address, @address_url, @whatsapp, @phone, @email, @description, @url, @is_open, @logo, @favicon, @banners, @slider_images, @social_links, @style_config, @payment_config)
  `);

  const branchResult = insertBranch.run({
    slug: branchSlug,
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
  const branchId = branchResult.lastInsertRowid;
  console.log(`  Branch "${branchSlug}" created (id=${branchId})`);

  // ── 2. Categories ──
  const cats = state.categories || [];
  const catIdMap = {}; // old string id → new integer id
  const insertCat = db.prepare(`
    INSERT INTO categories (name, sort_order, is_active) VALUES (@name, @sort_order, 1)
  `);
  cats.forEach((cat, idx) => {
    if (cat.id === "all") return; // skip the virtual "Todos" category
    const result = insertCat.run({ name: cat.name, sort_order: idx });
    catIdMap[cat.id] = result.lastInsertRowid;
  });
  console.log(`  ${Object.keys(catIdMap).length} categories migrated`);

  // ── 3. Products + Variants + Toppings ──
  const products = state.products || [];
  const prodIdMap = {}; // old string id → new integer id
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, category_id, image_url, type, base_price, stock, badges, is_active, is_featured, is_private, gallery)
    VALUES (@name, @description, @category_id, @image_url, @type, @base_price, @stock, @badges, @is_active, @is_featured, @is_private, @gallery)
  `);
  const insertVariant = db.prepare(`
    INSERT INTO product_variants (product_id, label, price, stock, sort_order)
    VALUES (@product_id, @label, @price, @stock, @sort_order)
  `);
  const insertTopping = db.prepare(`
    INSERT INTO product_toppings (product_id, name, price, sort_order)
    VALUES (@product_id, @name, @price, @sort_order)
  `);

  let variantCount = 0;
  let toppingCount = 0;

  products.forEach((p) => {
    const categoryId = catIdMap[p.categoryId];
    if (!categoryId) {
      console.warn(`  WARNING: Product "${p.name}" has unknown category "${p.categoryId}", skipping`);
      return;
    }

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
    const productId = result.lastInsertRowid;
    prodIdMap[p.id] = productId;

    // Variants
    if (p.variants && p.variants.length > 0) {
      p.variants.forEach((v, idx) => {
        insertVariant.run({
          product_id: productId,
          label: v.label,
          price: v.price,
          stock: v.stock != null ? v.stock : null,
          sort_order: idx,
        });
        variantCount++;
      });
    }

    // Toppings
    if (p.toppings && p.toppings.length > 0) {
      p.toppings.forEach((t, idx) => {
        insertTopping.run({
          product_id: productId,
          name: t.name,
          price: t.price,
          sort_order: idx,
        });
        toppingCount++;
      });
    }
  });
  console.log(`  ${Object.keys(prodIdMap).length} products migrated`);
  console.log(`  ${variantCount} variants migrated`);
  console.log(`  ${toppingCount} toppings migrated`);

  // ── 4. Promotions ──
  const promos = state.promotions || [];
  const insertPromo = db.prepare(`
    INSERT INTO promotions (branch_id, name, percentage, apply_to_all, date_from, date_to, weekly_repeat, is_active)
    VALUES (@branch_id, @name, @percentage, @apply_to_all, @date_from, @date_to, @weekly_repeat, @is_active)
  `);
  const insertPromoProduct = db.prepare(`
    INSERT INTO promotion_products (promotion_id, product_id) VALUES (@promotion_id, @product_id)
  `);

  promos.forEach((promo) => {
    const result = insertPromo.run({
      branch_id: branchId,
      name: promo.name,
      percentage: promo.percentage || 0,
      apply_to_all: promo.applyToAll ? 1 : 0,
      date_from: promo.dateFrom || "",
      date_to: promo.dateTo || "",
      weekly_repeat: promo.weeklyRepeat ? 1 : 0,
      is_active: 1,
    });
    const promoId = result.lastInsertRowid;

    if (!promo.applyToAll && promo.productIds) {
      promo.productIds.forEach((pid) => {
        const newPid = prodIdMap[pid];
        if (newPid) {
          insertPromoProduct.run({ promotion_id: promoId, product_id: newPid });
        }
      });
    }
  });
  console.log(`  ${promos.length} promotions migrated`);

  // ── 5. Coupons ──
  const coupons = state.coupons || [];
  const insertCoupon = db.prepare(`
    INSERT INTO coupons (branch_id, code, name, type, value, min_order, max_uses, used_count, apply_to, active_days, time_from, time_to, date_from, date_to, is_active)
    VALUES (@branch_id, @code, @name, @type, @value, @min_order, @max_uses, @used_count, @apply_to, @active_days, @time_from, @time_to, @date_from, @date_to, @is_active)
  `);
  const insertCouponTarget = db.prepare(`
    INSERT INTO coupon_targets (coupon_id, target_type, target_id) VALUES (@coupon_id, @target_type, @target_id)
  `);

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
    const couponId = result.lastInsertRowid;

    // Category targets
    if (c.applyTo === "categories" && c.categoryIds) {
      c.categoryIds.forEach((catStr) => {
        const newCatId = catIdMap[catStr];
        if (newCatId) {
          insertCouponTarget.run({ coupon_id: couponId, target_type: "category", target_id: newCatId });
        }
      });
    }
    // Product targets
    if (c.applyTo === "products" && c.productIds) {
      c.productIds.forEach((pid) => {
        const newPid = prodIdMap[pid];
        if (newPid) {
          insertCouponTarget.run({ coupon_id: couponId, target_type: "product", target_id: newPid });
        }
      });
    }
  });
  console.log(`  ${coupons.length} coupons migrated`);

  // ── 6. Delivery Zones ──
  const zones = state.deliveryZones || [];
  const insertZone = db.prepare(`
    INSERT INTO delivery_zones (branch_id, name, polygon, cost, is_active, color)
    VALUES (@branch_id, @name, @polygon, @cost, @is_active, @color)
  `);
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
  console.log(`  ${zones.length} delivery zones migrated`);

  // ── 7. App Users (customers) ──
  const users = state.users || [];
  const insertAppUser = db.prepare(`
    INSERT INTO app_users (name, email, phone, address, status, total_spent, last_order_date, registered_at)
    VALUES (@name, @email, @phone, @address, @status, @total_spent, @last_order_date, @registered_at)
  `);
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
  console.log(`  ${users.length} app users migrated`);

  console.log("\nMigration complete!");
});

try {
  migrate();
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  closeDb();
}
