const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createSnapshot,
  restoreSnapshotPayload,
  takeAutoSnapshot,
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
