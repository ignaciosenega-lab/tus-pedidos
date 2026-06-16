const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createSnapshot,
  restoreSnapshotPayload,
  takeAutoSnapshot,
  categoryProductsInPayload,
  restoreCategoryFromPayload,
} = require("../lib/snapshots");

// GET /api/snapshots — lista sin payload (no pesa)
router.get("/", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare(`
    SELECT id, name, created_at, created_by, source, reason, size_bytes
    FROM config_snapshots
    ORDER BY created_at DESC, id DESC
  `).all();
  res.json(rows);
});

// POST /api/snapshots — crea un snapshot manual con nombre opcional
router.post("/", requireAuth, requireRole("master"), (req, res) => {
  try {
    const db = req.app.locals.db;
    const created = createSnapshot(db, {
      name: req.body?.name,
      createdBy: req.user?.username || null,
      source: "manual",
    });
    res.status(201).json(created);
  } catch (e) {
    console.error("Error creating snapshot:", e.message);
    res.status(500).json({ error: "Error al crear punto: " + e.message });
  }
});

// POST /api/snapshots/auto — auto-snapshot disparado por el cliente antes
// de un bulk-op (ej. CSV import). Etiqueta el motivo via ?reason= o body.
router.post("/auto", requireAuth, requireRole("master"), (req, res) => {
  try {
    const db = req.app.locals.db;
    const reason = req.query.reason || req.body?.reason || "manual-trigger";
    const created = takeAutoSnapshot(db, {
      reason: String(reason).slice(0, 80),
      // Evita ruido si el cliente lo llama 2 veces seguidas por error.
      minIntervalMs: 60 * 1000,
    });
    if (!created) {
      return res.json({ skipped: true, reason: "ya hay un auto-snapshot reciente" });
    }
    res.status(201).json(created);
  } catch (e) {
    console.error("Error creating auto-snapshot:", e.message);
    res.status(500).json({ error: "Error al crear auto-snapshot: " + e.message });
  }
});

// GET /api/snapshots/recover-category?category=Bebidas  (o ?categoryId=352)
// Preview: en qué snapshots aparecen productos de esa categoría y cuáles.
// DEBE ir antes de "/:id" para que no lo capture como id.
router.get("/recover-category", requireAuth, requireRole("master"), (req, res) => {
  try {
    const db = req.app.locals.db;
    let categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const categoryName = req.query.category ? String(req.query.category).trim() : null;
    if (!categoryId && categoryName) {
      const cat = db.prepare("SELECT id FROM categories WHERE lower(name) = lower(?)").get(categoryName);
      if (!cat) return res.status(404).json({ error: `No existe la categoría "${categoryName}"` });
      categoryId = cat.id;
    }
    if (!categoryId) return res.status(400).json({ error: "Falta categoryId o category" });
    const cat = db.prepare("SELECT id, name FROM categories WHERE id = ?").get(categoryId);

    const snaps = db.prepare(
      "SELECT id, name, created_at, reason, payload FROM config_snapshots ORDER BY created_at DESC, id DESC"
    ).all();
    const found = [];
    for (const s of snaps) {
      let payload;
      try { payload = JSON.parse(s.payload); } catch { continue; }
      const products = categoryProductsInPayload(payload, categoryId);
      if (products.length) {
        found.push({ snapshotId: s.id, name: s.name, created_at: s.created_at, reason: s.reason, count: products.length, products });
      }
    }
    res.json({ categoryId, categoryName: (cat && cat.name) || categoryName, found });
  } catch (e) {
    console.error("Error en recover-category preview:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/snapshots/:id/recover-category  body { categoryId }
// Recupera SOLO los productos de esa categoría desde el snapshot, sin tocar
// nada más (no es un rollback). Toma un auto-snapshot previo por las dudas.
router.post("/:id/recover-category", requireAuth, requireRole("master"), (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    const categoryId = Number(req.body && req.body.categoryId);
    if (!categoryId) return res.status(400).json({ error: "Falta categoryId" });
    const row = db.prepare("SELECT payload FROM config_snapshots WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Snapshot no encontrado" });

    takeAutoSnapshot(db, { reason: `pre-recover-cat-${categoryId}`, minIntervalMs: 0 });
    const payload = JSON.parse(row.payload);
    const result = restoreCategoryFromPayload(db, payload, categoryId);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("Error en recover-category:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/snapshots/:id — metadata + payload (para inspección/debug)
router.get("/:id", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM config_snapshots WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Snapshot no encontrado" });
  // Devolvemos el payload parseado para facilitar inspección desde tools.
  let payload = null;
  try { payload = JSON.parse(row.payload); } catch { /* dejar null */ }
  res.json({ ...row, payload });
});

// POST /api/snapshots/:id/restore — aplica el snapshot a la DB actual
router.post("/:id/restore", requireAuth, requireRole("master"), (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    const row = db.prepare("SELECT payload FROM config_snapshots WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Snapshot no encontrado" });

    // Antes de restaurar, sacamos un auto-snapshot del estado ACTUAL para que
    // sea reversible en un click si el usuario se arrepiente.
    takeAutoSnapshot(db, { reason: `pre-restore-${id}`, minIntervalMs: 0 });

    const payload = JSON.parse(row.payload);
    restoreSnapshotPayload(db, payload);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error restoring snapshot:", e.message);
    res.status(500).json({ error: "Error al restaurar: " + e.message });
  }
});

// DELETE /api/snapshots/:id
router.delete("/:id", requireAuth, requireRole("master"), (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    const result = db.prepare("DELETE FROM config_snapshots WHERE id = ?").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Snapshot no encontrado" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Error deleting snapshot:", e.message);
    res.status(500).json({ error: "Error al eliminar: " + e.message });
  }
});

module.exports = router;
