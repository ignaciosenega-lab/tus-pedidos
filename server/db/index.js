const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "tuspedidos.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");

    // Run schema (CREATE IF NOT EXISTS is idempotent)
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    db.exec(schema);

    // Migrations: add columns that can't be in CREATE IF NOT EXISTS
    const branchCols = db.prepare("PRAGMA table_info(branches)").all().map((c) => c.name);
    if (!branchCols.includes("menu_id")) {
      db.exec("ALTER TABLE branches ADD COLUMN menu_id INTEGER REFERENCES menus(id)");
    }

    // Migrations: add apply_all_branches to promotions/coupons
    const promoCols = db.prepare("PRAGMA table_info(promotions)").all().map((c) => c.name);
    if (!promoCols.includes("apply_all_branches")) {
      db.exec("ALTER TABLE promotions ADD COLUMN apply_all_branches INTEGER NOT NULL DEFAULT 0");
    }
    const couponCols = db.prepare("PRAGMA table_info(coupons)").all().map((c) => c.name);
    if (!couponCols.includes("apply_all_branches")) {
      db.exec("ALTER TABLE coupons ADD COLUMN apply_all_branches INTEGER NOT NULL DEFAULT 0");
    }

    // Migrations: add apply_scope, time_from, time_to to promotions
    if (!promoCols.includes("apply_scope")) {
      db.exec("ALTER TABLE promotions ADD COLUMN apply_scope TEXT NOT NULL DEFAULT 'all'");
      // Backfill: existing promos with apply_to_all=0 → scope='products'
      db.exec("UPDATE promotions SET apply_scope = 'products' WHERE apply_to_all = 0");
    }
    if (!promoCols.includes("time_from")) {
      db.exec("ALTER TABLE promotions ADD COLUMN time_from TEXT NOT NULL DEFAULT ''");
    }
    if (!promoCols.includes("time_to")) {
      db.exec("ALTER TABLE promotions ADD COLUMN time_to TEXT NOT NULL DEFAULT ''");
    }

    // Migration: add neighborhood to app_users
    const appUserCols = db.prepare("PRAGMA table_info(app_users)").all().map((c) => c.name);
    if (!appUserCols.includes("neighborhood")) {
      db.exec("ALTER TABLE app_users ADD COLUMN neighborhood TEXT NOT NULL DEFAULT ''");
    }

    // Backfill neighborhood from existing addresses
    const emptyNeighborhood = db.prepare("SELECT id, address FROM app_users WHERE neighborhood = '' AND address != ''").all();
    if (emptyNeighborhood.length > 0) {
      const updateStmt = db.prepare("UPDATE app_users SET neighborhood = ? WHERE id = ?");
      for (const row of emptyNeighborhood) {
        const parts = row.address.split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          const hood = parts[1].replace(/^[A-Z]\d{4}[A-Z]{0,3}\s*/i, "").trim();
          if (hood) updateStmt.run(hood, row.id);
        }
      }
    }

    // Migration: add first_purchase_only to coupons
    const couponCols2 = db.prepare("PRAGMA table_info(coupons)").all().map((c) => c.name);
    if (!couponCols2.includes("first_purchase_only")) {
      db.exec("ALTER TABLE coupons ADD COLUMN first_purchase_only INTEGER NOT NULL DEFAULT 0");
    }

    // Seed default menu if none exist
    const menuCount = db.prepare("SELECT COUNT(*) as count FROM menus").get();
    if (menuCount.count === 0) {
      db.prepare("INSERT INTO menus (name, price_rule, price_value, rounding) VALUES ('Menú Genérico', 'none', 0, 'none')").run();
    }

    // Seed master user if no users exist
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    if (userCount.count === 0) {
      const username = process.env.ADMIN_USER || "admin";
      const password = process.env.ADMIN_PASSWORD || "admin123";
      const hash = bcrypt.hashSync(password, 10);
      db.prepare(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'master', 'Administrador')"
      ).run(username, hash);
      console.log(`Master user "${username}" created`);
    }
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});
process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

module.exports = { getDb, closeDb, DB_PATH };
