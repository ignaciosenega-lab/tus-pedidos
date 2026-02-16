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

module.exports = router;
