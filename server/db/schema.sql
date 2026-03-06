-- ================================================================
-- TusPedidos Multi-Franchise Schema
-- ================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ================================================================
-- BRANCHES (sucursales)
-- ================================================================
CREATE TABLE IF NOT EXISTS branches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  address       TEXT    NOT NULL DEFAULT '',
  address_url   TEXT    NOT NULL DEFAULT '',
  whatsapp      TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  email         TEXT    NOT NULL DEFAULT '',
  description   TEXT    NOT NULL DEFAULT '',
  url           TEXT    NOT NULL DEFAULT '',
  schedule      TEXT    NOT NULL DEFAULT '{}',
  timezone      TEXT    NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  is_open       INTEGER NOT NULL DEFAULT 1,
  is_active     INTEGER NOT NULL DEFAULT 1,
  logo          TEXT    NOT NULL DEFAULT '',
  favicon       TEXT    NOT NULL DEFAULT '',
  banners       TEXT    NOT NULL DEFAULT '[]',
  slider_images TEXT    NOT NULL DEFAULT '[]',
  social_links  TEXT    NOT NULL DEFAULT '[]',
  style_config  TEXT    NOT NULL DEFAULT '{}',
  payment_config TEXT   NOT NULL DEFAULT '{}',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_branches_slug ON branches(slug);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(is_active);

-- ================================================================
-- MENUS (pricing templates)
-- ================================================================
CREATE TABLE IF NOT EXISTS menus (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  price_rule  TEXT    NOT NULL DEFAULT 'none' CHECK (price_rule IN ('none', 'percentage')),
  price_value REAL    NOT NULL DEFAULT 0,
  rounding    TEXT    NOT NULL DEFAULT 'none' CHECK (rounding IN ('none', 'round_10', 'round_50', 'round_100')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ================================================================
-- CATEGORIES (global catalog)
-- ================================================================
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ================================================================
-- PRODUCTS (global catalog)
-- ================================================================
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  image_url   TEXT    NOT NULL DEFAULT '',
  type        TEXT    NOT NULL DEFAULT 'simple' CHECK (type IN ('simple', 'options')),
  base_price  REAL    NOT NULL DEFAULT 0,
  stock       INTEGER,
  badges      TEXT    NOT NULL DEFAULT '[]',
  is_active   INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_private  INTEGER NOT NULL DEFAULT 0,
  gallery     TEXT    NOT NULL DEFAULT '[]',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ================================================================
-- PRODUCT_VARIANTS
-- ================================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  price       REAL    NOT NULL DEFAULT 0,
  stock       INTEGER,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- ================================================================
-- PRODUCT_TOPPINGS
-- ================================================================
CREATE TABLE IF NOT EXISTS product_toppings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  price       REAL    NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_toppings_product ON product_toppings(product_id);

-- ================================================================
-- BRANCH_PRODUCT_OVERRIDES
-- ================================================================
CREATE TABLE IF NOT EXISTS branch_product_overrides (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id       INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_override  REAL,
  is_available    INTEGER NOT NULL DEFAULT 1,
  stock_override  INTEGER,
  UNIQUE(branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bpo_branch ON branch_product_overrides(branch_id);
CREATE INDEX IF NOT EXISTS idx_bpo_product ON branch_product_overrides(product_id);

-- ================================================================
-- BRANCH_VARIANT_OVERRIDES
-- ================================================================
CREATE TABLE IF NOT EXISTS branch_variant_overrides (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id       INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  variant_id      INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  price_override  REAL,
  is_available    INTEGER NOT NULL DEFAULT 1,
  stock_override  INTEGER,
  UNIQUE(branch_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_bvo_branch ON branch_variant_overrides(branch_id);

-- ================================================================
-- BRANCH_CATEGORY_VISIBILITY
-- ================================================================
CREATE TABLE IF NOT EXISTS branch_category_visibility (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id           INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category_id         INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_visible          INTEGER NOT NULL DEFAULT 1,
  sort_order_override INTEGER,
  UNIQUE(branch_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_bcv_branch ON branch_category_visibility(branch_id);

-- ================================================================
-- PROMOTIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS promotions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id     INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  percentage    REAL    NOT NULL DEFAULT 0,
  apply_to_all  INTEGER NOT NULL DEFAULT 1,
  date_from     TEXT    NOT NULL DEFAULT '',
  date_to       TEXT    NOT NULL DEFAULT '',
  weekly_repeat INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promotions_branch ON promotions(branch_id);

-- ================================================================
-- PROMOTION_PRODUCTS
-- ================================================================
CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

-- ================================================================
-- PROMOTION_CATEGORIES
-- ================================================================
CREATE TABLE IF NOT EXISTS promotion_categories (
  promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, category_id)
);

-- ================================================================
-- PROMOTION_BRANCHES (cross-branch targeting)
-- ================================================================
CREATE TABLE IF NOT EXISTS promotion_branches (
  promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  branch_id    INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, branch_id)
);

-- ================================================================
-- COUPONS
-- ================================================================
CREATE TABLE IF NOT EXISTS coupons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  code        TEXT    NOT NULL,
  name        TEXT    NOT NULL DEFAULT '',
  type        TEXT    NOT NULL DEFAULT 'percentage' CHECK (type IN ('percentage', 'fixed')),
  value       REAL    NOT NULL DEFAULT 0,
  min_order   REAL    NOT NULL DEFAULT 0,
  max_uses    INTEGER NOT NULL DEFAULT 0,
  used_count  INTEGER NOT NULL DEFAULT 0,
  apply_to    TEXT    NOT NULL DEFAULT 'all' CHECK (apply_to IN ('all', 'categories', 'products')),
  active_days TEXT    NOT NULL DEFAULT '[]',
  time_from   TEXT    NOT NULL DEFAULT '',
  time_to     TEXT    NOT NULL DEFAULT '',
  date_from   TEXT    NOT NULL DEFAULT '',
  date_to     TEXT    NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coupons_branch ON coupons(branch_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ================================================================
-- COUPON_TARGETS
-- ================================================================
CREATE TABLE IF NOT EXISTS coupon_targets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id   INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  target_type TEXT    NOT NULL CHECK (target_type IN ('category', 'product')),
  target_id   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coupon_targets_coupon ON coupon_targets(coupon_id);

-- ================================================================
-- COUPON_BRANCHES (cross-branch targeting)
-- ================================================================
CREATE TABLE IF NOT EXISTS coupon_branches (
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, branch_id)
);

-- ================================================================
-- DELIVERY_ZONES
-- ================================================================
CREATE TABLE IF NOT EXISTS delivery_zones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id   INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  polygon     TEXT    NOT NULL DEFAULT '[]',
  cost        REAL    NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  color       TEXT    NOT NULL DEFAULT '#3B82F6'
);

CREATE INDEX IF NOT EXISTS idx_zones_branch ON delivery_zones(branch_id);

-- ================================================================
-- ORDERS
-- ================================================================
CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id       INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  customer_name   TEXT    NOT NULL,
  customer_phone  TEXT    NOT NULL,
  delivery_type   TEXT    NOT NULL DEFAULT 'delivery' CHECK (delivery_type IN ('pickup', 'delivery')),
  address         TEXT    NOT NULL DEFAULT '',
  lat             REAL,
  lng             REAL,
  floor           TEXT    NOT NULL DEFAULT '',
  date            TEXT    NOT NULL DEFAULT '',
  time            TEXT    NOT NULL DEFAULT '',
  instructions    TEXT    NOT NULL DEFAULT '',
  payment_method  TEXT    NOT NULL DEFAULT 'Efectivo',
  items           TEXT    NOT NULL DEFAULT '[]',
  subtotal        REAL    NOT NULL DEFAULT 0,
  delivery_cost   REAL    NOT NULL DEFAULT 0,
  discount        REAL    NOT NULL DEFAULT 0,
  total           REAL    NOT NULL DEFAULT 0,
  coupon_code     TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','preparing','ready','delivering','delivered','cancelled')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(branch_id, created_at);

-- ================================================================
-- USERS (admin users)
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'staff'
                CHECK (role IN ('master', 'branch_admin', 'staff')),
  branch_id     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  display_name  TEXT    NOT NULL DEFAULT '',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ================================================================
-- APP_USERS (storefront customers)
-- ================================================================
CREATE TABLE IF NOT EXISTS app_users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL DEFAULT '',
  phone           TEXT    NOT NULL DEFAULT '',
  address         TEXT    NOT NULL DEFAULT '',
  neighborhood    TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'activo'
                  CHECK (status IN ('activo', 'inactivo', 'bloqueado')),
  total_spent     REAL    NOT NULL DEFAULT 0,
  last_order_date TEXT,
  registered_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ================================================================
-- AUDIT_LOGS
-- ================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  action      TEXT    NOT NULL,
  entity_type TEXT    NOT NULL,
  entity_id   TEXT,
  old_value   TEXT,
  new_value   TEXT,
  ip_address  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- ================================================================
-- ANALYTICS_EVENTS (storefront tracking)
-- ================================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id  INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  event_type TEXT    NOT NULL,
  product_id INTEGER,
  session_id TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ae_branch_type ON analytics_events(branch_id, event_type);
CREATE INDEX IF NOT EXISTS idx_ae_branch_date ON analytics_events(branch_id, created_at);
