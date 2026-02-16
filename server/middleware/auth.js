const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "tuspedidos_dev_secret_change_me";

/**
 * Verify JWT and load user from DB.
 * Sets req.user = { id, username, role, branch_id, display_name }
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    const db = req.app.locals.db;
    const user = db
      .prepare("SELECT id, username, role, branch_id, display_name FROM users WHERE id = ? AND is_active = 1")
      .get(decoded.sub);

    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado o desactivado" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/**
 * Check that user has one of the allowed roles.
 * Usage: requireRole("master", "branch_admin")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tenés permisos para esta acción" });
    }
    next();
  };
}

/**
 * Check that user has access to the branch specified by :branchId param.
 * Master can access any branch. Branch_admin/staff only their own.
 */
function requireBranchAccess(paramName = "branchId") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (req.user.role === "master") {
      return next(); // master accesses all
    }
    const branchId = Number(req.params[paramName]);
    if (req.user.branch_id !== branchId) {
      return res.status(403).json({ error: "No tenés acceso a esta sucursal" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireBranchAccess, JWT_SECRET };
