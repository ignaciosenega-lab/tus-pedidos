const express = require("express");
const bcrypt = require("bcryptjs");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// All routes require master role
router.use(requireAuth, requireRole("master"));

// GET /api/users — list admin users
router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const users = db
    .prepare("SELECT id, username, role, branch_id, display_name, is_active, created_at FROM users ORDER BY id")
    .all();
  res.json(users);
});

// POST /api/users — create admin user
router.post("/", (req, res) => {
  const { username, password, role, branch_id, display_name } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }
  if (!["master", "branch_admin", "staff"].includes(role)) {
    return res.status(400).json({ error: "Rol inválido" });
  }
  if (role !== "master" && !branch_id) {
    return res.status(400).json({ error: "branch_admin y staff necesitan una sucursal asignada" });
  }

  const db = req.app.locals.db;

  // Check username uniqueness
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ error: "El nombre de usuario ya existe" });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, branch_id, display_name)
    VALUES (@username, @password_hash, @role, @branch_id, @display_name)
  `).run({
    username,
    password_hash,
    role,
    branch_id: role === "master" ? null : branch_id,
    display_name: display_name || username,
  });

  res.status(201).json({
    id: Number(result.lastInsertRowid),
    username,
    role,
    branch_id: role === "master" ? null : branch_id,
    display_name: display_name || username,
  });
});

// PUT /api/users/:id — update admin user
router.put("/:id", (req, res) => {
  const db = req.app.locals.db;
  const userId = Number(req.params.id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const { username, password, role, branch_id, display_name, is_active } = req.body;

  if (role && !["master", "branch_admin", "staff"].includes(role)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  // Don't allow deactivating the last master
  if (is_active === false || is_active === 0) {
    if (user.role === "master") {
      const masterCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'master' AND is_active = 1").get();
      if (masterCount.count <= 1) {
        return res.status(400).json({ error: "No se puede desactivar el único usuario master" });
      }
    }
  }

  // Check username uniqueness if changing
  if (username && username !== user.username) {
    const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, userId);
    if (existing) {
      return res.status(409).json({ error: "El nombre de usuario ya existe" });
    }
  }

  const newRole = role || user.role;
  const newBranchId = newRole === "master" ? null : (branch_id !== undefined ? branch_id : user.branch_id);

  db.prepare(`
    UPDATE users SET
      username = @username,
      role = @role,
      branch_id = @branch_id,
      display_name = @display_name,
      is_active = @is_active
    WHERE id = @id
  `).run({
    id: userId,
    username: username || user.username,
    role: newRole,
    branch_id: newBranchId,
    display_name: display_name !== undefined ? display_name : user.display_name,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
  });

  // Update password if provided
  if (password) {
    const password_hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, userId);
  }

  const updated = db
    .prepare("SELECT id, username, role, branch_id, display_name, is_active, created_at FROM users WHERE id = ?")
    .get(userId);
  res.json(updated);
});

/* ══════════════════════════════════════════════════
   Generar una contraseña nueva
   ══════════════════════════════════════════════════ */
// Las contraseñas se guardan con bcrypt, que es de una sola dirección: no hay
// forma de leer la que tiene puesta una sucursal, ni acá ni en ningún lado.
// Cuando se la olvidan, la salida no es mostrarla sino fabricar una nueva.
//
// El texto plano se devuelve UNA sola vez, en esta respuesta. No se guarda en la
// base, no se escribe en los logs, no se puede volver a pedir.

// Palabras cortas, comunes y fáciles de dictar por teléfono. Sin acentos ni ñ,
// que se transcriben mal cuando se las pasan por WhatsApp.
const PALABRAS = [
  "sushi", "verde", "rojo", "salmon", "arroz", "fuego", "luna", "rio", "campo",
  "pizza", "mesa", "silla", "puerta", "cielo", "tigre", "puma", "zorro", "gato",
  "playa", "monte", "norte", "suave", "rapido", "fresco", "dulce", "limon",
];

function generarContrasena() {
  const crypto = require("crypto");
  const a = PALABRAS[crypto.randomInt(PALABRAS.length)];
  let b = PALABRAS[crypto.randomInt(PALABRAS.length)];
  while (b === a) b = PALABRAS[crypto.randomInt(PALABRAS.length)];
  // 4 dígitos, sin ceros a la izquierda perdidos.
  const num = String(crypto.randomInt(1000, 10000));
  return `${a}-${b}-${num}`;
}

// POST /api/users/:id/generate-password
router.post("/:id/generate-password", (req, res) => {
  const db = req.app.locals.db;
  const userId = Number(req.params.id);
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const password = generarContrasena();
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(bcrypt.hashSync(password, 10), userId);

  // Ojo: nada de console.log con la contraseña adentro.
  console.log(`[auth] contraseña regenerada para ${user.username}`);

  res.json({ username: user.username, password });
});

// DELETE /api/users/:id — delete admin user
router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  const userId = Number(req.params.id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  // Don't allow deleting the last master
  if (user.role === "master") {
    const masterCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'master' AND is_active = 1").get();
    if (masterCount.count <= 1) {
      return res.status(400).json({ error: "No se puede eliminar el único usuario master" });
    }
  }

  // Prevent self-deletion
  if (userId === req.user.id) {
    return res.status(400).json({ error: "No podés eliminar tu propio usuario" });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  res.json({ ok: true });
});

module.exports = router;
