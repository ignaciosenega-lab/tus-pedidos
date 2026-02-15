const Database = require("better-sqlite3");
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
