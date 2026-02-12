const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "tuspedidos_dev_secret_change_me";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS_HASH = bcrypt.hashSync(
  process.env.ADMIN_PASSWORD || "admin123",
  10
);

/* ── Paths ────────────────────────────────────── */
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ── Middleware ────────────────────────────────── */
app.use(cors());
app.use(express.json({ limit: "50mb" }));

/* ── Auth middleware ──────────────────────────── */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/* ── Helpers ──────────────────────────────────── */
function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading state:", e.message);
  }
  return null;
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

/* ── API Routes ──────────────────────────────── */

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || !bcrypt.compareSync(password, ADMIN_PASS_HASH)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const token = jwt.sign({ sub: username, role: "admin" }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token });
});

// Verify token
app.get("/api/auth/verify", requireAuth, (_req, res) => {
  res.json({ ok: true });
});

// Get state (public — storefront needs to read products)
app.get("/api/state", (_req, res) => {
  const state = readState();
  if (!state) {
    return res.json(null);
  }
  res.json(state);
});

// Save state (admin only)
app.post("/api/state", requireAuth, (req, res) => {
  try {
    writeState(req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error saving state:", e.message);
    res.status(500).json({ error: "Error guardando datos" });
  }
});

// Upload image (admin only)
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten imágenes"));
  },
});

app.post("/api/upload", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibió imagen" });
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
});

// Serve uploaded images
app.use("/api/uploads", express.static(UPLOADS_DIR));

/* ── Serve frontend (production) ─────────────── */
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

/* ── Start ────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`TusPedidos API running on port ${PORT}`);
});
