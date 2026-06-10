// Snapshots de configuración: serializa y restaura las tablas que el admin
// edita (productos, promos, cupones, menús, etc.). NO toca orders, app_users,
// users, audit_logs ni analytics_events.
//
// El "payload" se guarda como JSON en config_snapshots.payload.

const SNAPSHOT_VERSION = 1;

// Orden importante: padres antes que hijos al INSERT (al revés al DELETE).
// Las FK constraints se difieren al commit para que el orden interno no rompa.
const RESTORE_ORDER = [
  "branches",
  "menus",
  "categories",
  "products",
  "product_variants",
  "product_toppings",
  "branch_product_overrides",
  "branch_variant_overrides",
  "branch_category_visibility",
  "product_exclusive_menus",
  "promotions",
  "promotion_products",
  "promotion_categories",
  "promotion_branches",
  "coupons",
  "coupon_targets",
  "coupon_branches",
  "delivery_zones",
];

// Cuántos auto-snapshots conservar antes de empezar a borrar los más viejos.
const AUTO_RETENTION = 7;

/** Construye el payload completo a partir del estado actual de la DB. */
function buildSnapshotPayload(db) {
  const payload = { version: SNAPSHOT_VERSION };
  RESTORE_ORDER.forEach((t) => {
    payload[t] = db.prepare(`SELECT * FROM ${t}`).all();
  });
  return payload;
}

/** Crea y persiste un snapshot. Retorna { id, name, size_bytes }. */
function createSnapshot(db, { name, createdBy, source = "manual", reason = null }) {
  const payload = buildSnapshotPayload(db);
  const json = JSON.stringify(payload);
  const safeName = (name && String(name).trim()) ||
    (source === "auto"
      ? `Automático — ${new Date().toLocaleString("es-AR")}`
      : `Sin nombre — ${new Date().toLocaleString("es-AR")}`);
  const result = db.prepare(`
    INSERT INTO config_snapshots (name, created_by, source, reason, size_bytes, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(safeName, createdBy || null, source, reason, json.length, json);
  return { id: Number(result.lastInsertRowid), name: safeName, size_bytes: json.length };
}

/** Conserva los últimos AUTO_RETENTION auto-snapshots, borra el resto. */
function pruneAutoSnapshots(db) {
  const ids = db.prepare(`
    SELECT id FROM config_snapshots
    WHERE source = 'auto'
    ORDER BY created_at DESC, id DESC
  `).all().map((r) => r.id);
  const toDelete = ids.slice(AUTO_RETENTION);
  if (toDelete.length === 0) return 0;
  const stmt = db.prepare("DELETE FROM config_snapshots WHERE id = ?");
  toDelete.forEach((id) => stmt.run(id));
  return toDelete.length;
}

/**
 * Toma un auto-snapshot etiquetado y aplica retención.
 * `reason` es libre: 'csv-import', 'price-scan', '24h', etc.
 * `minIntervalMs` opcional: si el último auto-snapshot es más reciente que
 * eso, no toma uno nuevo (evita ruido si se llama muchas veces seguidas).
 */
function takeAutoSnapshot(db, { reason, minIntervalMs = 0 } = {}) {
  if (minIntervalMs > 0) {
    const last = db.prepare(`
      SELECT created_at FROM config_snapshots
      WHERE source = 'auto'
      ORDER BY created_at DESC, id DESC LIMIT 1
    `).get();
    if (last) {
      const lastTs = new Date(last.created_at.replace(" ", "T")).getTime();
      if (Date.now() - lastTs < minIntervalMs) {
        return null; // saltado, hubo uno reciente
      }
    }
  }
  const created = createSnapshot(db, {
    name: null,
    createdBy: null,
    source: "auto",
    reason: reason || "auto",
  });
  pruneAutoSnapshots(db);
  return created;
}

/**
 * Restaura un payload completo. Usa una transacción con FKs diferidas para
 * que el orden parcial de INSERT no rompa constraints.
 */
function restoreSnapshotPayload(db, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido");
  }
  const tx = db.transaction(() => {
    db.exec("PRAGMA defer_foreign_keys = 1");
    // Vaciar en orden inverso (hijos primero) para reducir cascadas inútiles.
    [...RESTORE_ORDER].reverse().forEach((t) => {
      db.exec(`DELETE FROM ${t}`);
    });
    // Re-insertar respetando los IDs originales.
    RESTORE_ORDER.forEach((t) => {
      const rows = payload[t];
      if (!Array.isArray(rows) || rows.length === 0) return;
      const cols = Object.keys(rows[0]);
      const stmt = db.prepare(
        `INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`
      );
      for (const row of rows) {
        stmt.run(...cols.map((c) => row[c]));
      }
    });
  });
  tx();
}

module.exports = {
  SNAPSHOT_VERSION,
  RESTORE_ORDER,
  AUTO_RETENTION,
  buildSnapshotPayload,
  createSnapshot,
  takeAutoSnapshot,
  pruneAutoSnapshots,
  restoreSnapshotPayload,
};
