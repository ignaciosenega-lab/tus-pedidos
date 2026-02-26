const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/menus — list all menus (master only)
router.get("/", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const menus = db.prepare("SELECT * FROM menus ORDER BY id").all();

  // Count branches per menu
  const branchCounts = {};
  db.prepare("SELECT menu_id, COUNT(*) as count FROM branches WHERE menu_id IS NOT NULL GROUP BY menu_id")
    .all()
    .forEach((r) => { branchCounts[r.menu_id] = r.count; });

  res.json(menus.map((m) => ({
    ...m,
    branchCount: branchCounts[m.id] || 0,
  })));
});

// POST /api/menus — create menu
router.post("/", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const { name, price_rule, price_value, rounding } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Nombre es requerido" });
  }

  const result = db.prepare(
    "INSERT INTO menus (name, price_rule, price_value, rounding) VALUES (@name, @price_rule, @price_value, @rounding)"
  ).run({
    name: name.trim(),
    price_rule: price_rule || "none",
    price_value: price_value || 0,
    rounding: rounding || "none",
  });

  const created = db.prepare("SELECT * FROM menus WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ ...created, branchCount: 0 });
});

// PUT /api/menus/:id — update menu
router.put("/:id", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM menus WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Menú no encontrado" });

  const { name, price_rule, price_value, rounding } = req.body;

  db.prepare(`
    UPDATE menus SET
      name = @name, price_rule = @price_rule, price_value = @price_value, rounding = @rounding
    WHERE id = @id
  `).run({
    id,
    name: name !== undefined ? name.trim() : existing.name,
    price_rule: price_rule !== undefined ? price_rule : existing.price_rule,
    price_value: price_value !== undefined ? price_value : existing.price_value,
    rounding: rounding !== undefined ? rounding : existing.rounding,
  });

  const updated = db.prepare("SELECT * FROM menus WHERE id = ?").get(id);
  const branchCount = db.prepare("SELECT COUNT(*) as count FROM branches WHERE menu_id = ?").get(id).count;
  res.json({ ...updated, branchCount });
});

// DELETE /api/menus/:id — delete menu (only if no branches assigned)
router.delete("/:id", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  const branchCount = db.prepare("SELECT COUNT(*) as count FROM branches WHERE menu_id = ?").get(id).count;
  if (branchCount > 0) {
    return res.status(400).json({ error: `No se puede eliminar: ${branchCount} sucursal(es) usan este menú` });
  }

  const result = db.prepare("DELETE FROM menus WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Menú no encontrado" });
  res.json({ ok: true });
});

// POST /api/menus/:id/duplicate — duplicate menu
router.post("/:id/duplicate", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);

  const original = db.prepare("SELECT * FROM menus WHERE id = ?").get(id);
  if (!original) return res.status(404).json({ error: "Menú no encontrado" });

  const result = db.prepare(
    "INSERT INTO menus (name, price_rule, price_value, rounding) VALUES (@name, @price_rule, @price_value, @rounding)"
  ).run({
    name: `Copia de ${original.name}`,
    price_rule: original.price_rule,
    price_value: original.price_value,
    rounding: original.rounding,
  });

  const created = db.prepare("SELECT * FROM menus WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ ...created, branchCount: 0 });
});

module.exports = router;
