const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  const db = req.app.locals.db;
  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND is_active = 1")
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
      display_name: user.display_name,
    },
  });
});

// GET /api/auth/verify
router.get("/verify", requireAuth, (req, res) => {
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/* ══════════════════════════════════════════════════
   Cambiar la propia contraseña
   ══════════════════════════════════════════════════ */
// La pide el encargado de sucursal desde su panel. El personal (staff) no: el
// usuario de la sucursal suele estar compartido entre varias personas del local
// y cualquiera de ellas podría dejar afuera al resto sin querer.
router.post("/change-password", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { current, next } = req.body || {};

  if (!["master", "branch_admin"].includes(req.user?.role)) {
    return res.status(403).json({ error: "No tenés permiso para cambiar la contraseña" });
  }
  if (!current || !next) {
    return res.status(400).json({ error: "Faltan la contraseña actual y la nueva" });
  }
  if (String(next).length < 8) {
    return res.status(400).json({ error: "La nueva tiene que tener al menos 8 caracteres" });
  }
  if (String(next) === String(current)) {
    return res.status(400).json({ error: "La nueva tiene que ser distinta de la actual" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  // Verificar la actual antes que nada: sin esto, cualquiera que se siente
  // frente a una sesión abierta se queda con la cuenta.
  if (!bcrypt.compareSync(String(current), user.password_hash)) {
    return res.status(400).json({ error: "La contraseña actual no es correcta" });
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(bcrypt.hashSync(String(next), 10), user.id);

  console.log(`[auth] ${user.username} cambió su contraseña`);
  res.json({ ok: true });
});

module.exports = router;
