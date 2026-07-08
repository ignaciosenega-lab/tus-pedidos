const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/* ══════════════════════════════════════════════════
   GLOBAL (cross-branch, master only)
   ══════════════════════════════════════════════════ */

// All endpoints in this router are master-only.
router.use(requireAuth, requireRole("master"));

function parseDateFilter(from, to) {
  let sql = "";
  const params = [];
  if (from) {
    sql += " AND o.created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND o.created_at < date(?, '+1 day')";
    params.push(to);
  }
  return { sql, params };
}

function parseBranchIds(raw) {
  if (!raw) return null;
  const ids = String(raw)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : null;
}

// GET /api/global/orders?from=&to=&branchIds=1,2,3&categoryId=X&productId=Y
router.get("/orders", (req, res) => {
  const db = req.app.locals.db;
  const from = req.query.from || "";
  const to = req.query.to || "";
  const branchIds = parseBranchIds(req.query.branchIds);
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : "";
  const productId = req.query.productId ? String(req.query.productId) : "";

  const { sql: dateSql, params: dateParams } = parseDateFilter(from, to);

  let branchSql = "";
  const branchParams = [];
  if (branchIds) {
    branchSql = ` AND o.branch_id IN (${branchIds.map(() => "?").join(",")})`;
    branchParams.push(...branchIds);
  }

  const rows = db
    .prepare(
      `SELECT o.*, b.name as branch_name, b.slug as branch_slug
       FROM orders o
       LEFT JOIN branches b ON b.id = o.branch_id
       WHERE 1=1${dateSql}${branchSql}
       ORDER BY o.created_at DESC
       LIMIT 500`
    )
    .all(...dateParams, ...branchParams);

  // Resolve product → category map for fallback (only if categoryId filter is used)
  let productCategoryMap = null;
  if (categoryId) {
    productCategoryMap = {};
    const prodRows = db.prepare("SELECT id, category_id FROM products").all();
    for (const p of prodRows) {
      productCategoryMap[String(p.id)] = String(p.category_id);
    }
  }

  const result = [];
  for (const o of rows) {
    const items = safeParseJson(o.items, []);

    if (categoryId || productId) {
      const matches = items.some((item) => {
        const itemProductId = String(item.productId ?? "");
        if (productId && itemProductId !== productId) return false;
        if (categoryId) {
          const itemCategoryId = item.categoryId
            ? String(item.categoryId)
            : productCategoryMap?.[itemProductId] || "";
          if (itemCategoryId !== categoryId) return false;
        }
        return true;
      });
      if (!matches) continue;
    }

    result.push({
      ...o,
      items,
      // DB stores UTC — append Z so frontend converts to local timezone
      created_at: o.created_at ? o.created_at.replace(" ", "T") + "Z" : o.created_at,
    });
  }

  res.json(result);
});

// GET /api/global/metrics/products?from=&to=&branchIds=&categoryId=
router.get("/metrics/products", (req, res) => {
  const db = req.app.locals.db;
  const from = req.query.from || "";
  const to = req.query.to || "";
  const branchIds = parseBranchIds(req.query.branchIds);
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : "";

  const { sql: dateSql, params: dateParams } = parseDateFilter(from, to);

  let branchSql = "";
  const branchParams = [];
  if (branchIds) {
    branchSql = ` AND o.branch_id IN (${branchIds.map(() => "?").join(",")})`;
    branchParams.push(...branchIds);
  }

  const orderRows = db
    .prepare(`SELECT o.branch_id, o.items FROM orders o WHERE o.status != 'cancelled'${dateSql}${branchSql}`)
    .all(...dateParams, ...branchParams);

  // Aggregate sales per product, tracking which branches sold it
  const salesMap = {};
  for (const row of orderRows) {
    const items = safeParseJson(row.items, []);
    for (const item of items) {
      const key = String(item.productId || item.productName || "");
      if (!key) continue;
      if (!salesMap[key]) {
        salesMap[key] = {
          productId: item.productId || null,
          productName: item.productName,
          unitsSold: 0,
          purchases: 0,
          revenue: 0,
          branches: new Set(),
        };
      }
      salesMap[key].unitsSold += item.quantity || 0;
      salesMap[key].purchases += 1;
      salesMap[key].revenue += (item.price || 0) * (item.quantity || 0);
      salesMap[key].branches.add(row.branch_id);
    }
  }

  // Enrich with product name + category from DB
  const productMeta = db.prepare("SELECT id, name, category_id FROM products").all();
  const metaMap = {};
  for (const p of productMeta) {
    metaMap[String(p.id)] = { name: p.name, categoryId: String(p.category_id) };
  }

  const result = [];
  for (const key of Object.keys(salesMap)) {
    const meta = metaMap[key];
    // Apply category filter if requested
    if (categoryId && (!meta || meta.categoryId !== categoryId)) continue;

    const entry = salesMap[key];
    result.push({
      productId: key,
      productName: meta?.name || entry.productName || `Producto ${key}`,
      unitsSold: entry.unitsSold,
      purchases: entry.purchases,
      revenue: Math.round(entry.revenue),
      branchCount: entry.branches.size,
    });
  }

  result.sort((a, b) => b.revenue - a.revenue);
  res.json(result);
});

// GET /api/global/customers?branchId= — clientes con desglose por sucursal.
router.get("/customers", (req, res) => {
  const db = req.app.locals.db;
  const branchId = req.query.branchId ? Number(req.query.branchId) : null;

  // Pedidos por cliente (teléfono) y sucursal, excluyendo cancelados.
  const rows = db.prepare(`
    SELECT o.customer_phone AS phone, o.branch_id AS branchId, b.name AS branchName,
           COUNT(*) AS count, COALESCE(SUM(o.total),0) AS spent, MAX(o.created_at) AS last_order
    FROM orders o
    LEFT JOIN branches b ON b.id = o.branch_id
    WHERE o.status != 'cancelled' AND o.customer_phone != ''
    GROUP BY o.customer_phone, o.branch_id
  `).all();

  const byPhone = {};
  for (const r of rows) {
    if (!byPhone[r.phone]) {
      byPhone[r.phone] = { phone: r.phone, order_count: 0, total_spent: 0, last_order: null, branches: [] };
    }
    const c = byPhone[r.phone];
    c.order_count += r.count;
    c.total_spent += r.spent || 0;
    if (!c.last_order || r.last_order > c.last_order) c.last_order = r.last_order;
    c.branches.push({
      branchId: r.branchId,
      name: r.branchName || `Sucursal ${r.branchId}`,
      count: r.count,
      spent: Math.round(r.spent || 0),
    });
  }

  const users = db.prepare(
    "SELECT id, name, email, phone, address, neighborhood, registered_at FROM app_users"
  ).all();
  const userByPhone = {};
  for (const u of users) userByPhone[u.phone] = u;

  let result = Object.values(byPhone).map((c) => {
    const u = userByPhone[c.phone] || {};
    c.branches.sort((a, b) => b.count - a.count);
    return {
      id: u.id || null,
      name: u.name || "",
      email: u.email || "",
      phone: c.phone,
      address: u.address || "",
      neighborhood: u.neighborhood || "",
      registered_at: u.registered_at || null,
      order_count: c.order_count,
      total_spent: Math.round(c.total_spent),
      branches: c.branches,
    };
  });

  if (branchId) {
    result = result.filter((c) => c.branches.some((b) => b.branchId === branchId));
  }
  result.sort((a, b) => String(b.last_order || "").localeCompare(String(a.last_order || "")));
  res.json(result);
});

// GET /api/global/metrics/revenue?from=&to=&branchIds= — total, ranking y tendencia.
router.get("/metrics/revenue", (req, res) => {
  const db = req.app.locals.db;
  const from = req.query.from || "";
  const to = req.query.to || "";
  const branchIds = parseBranchIds(req.query.branchIds);
  const { sql: dateSql, params: dateParams } = parseDateFilter(from, to);

  let branchSql = "";
  const branchParams = [];
  if (branchIds) {
    branchSql = ` AND o.branch_id IN (${branchIds.map(() => "?").join(",")})`;
    branchParams.push(...branchIds);
  }
  const where = `WHERE o.status != 'cancelled'${dateSql}${branchSql}`;
  const params = [...dateParams, ...branchParams];

  const totalRow = db
    .prepare(`SELECT COUNT(*) orders, COALESCE(SUM(o.total),0) total FROM orders o ${where}`)
    .get(...params);

  const byBranch = db.prepare(`
    SELECT o.branch_id branchId, b.name name, COUNT(*) orders, COALESCE(SUM(o.total),0) revenue
    FROM orders o LEFT JOIN branches b ON b.id = o.branch_id
    ${where} GROUP BY o.branch_id ORDER BY revenue DESC
  `).all(...params);

  // Agrupado por día en hora Argentina (created_at está en UTC → -3h).
  const byDay = db.prepare(`
    SELECT date(o.created_at, '-3 hours') date, COUNT(*) orders, COALESCE(SUM(o.total),0) revenue
    FROM orders o ${where} GROUP BY date(o.created_at, '-3 hours') ORDER BY date ASC
  `).all(...params);

  res.json({
    total: Math.round(totalRow.total),
    orders: totalRow.orders,
    byBranch: byBranch.map((r) => ({ branchId: r.branchId, name: r.name || `Sucursal ${r.branchId}`, orders: r.orders, revenue: Math.round(r.revenue) })),
    byDay: byDay.map((r) => ({ date: r.date, orders: r.orders, revenue: Math.round(r.revenue) })),
  });
});

// GET /api/global/health — chequeos de configuración / flujo que afectan al cliente.
router.get("/health", (req, res) => {
  const db = req.app.locals.db;
  const issues = [];
  const add = (type, severity, message, hint, branch, entity) =>
    issues.push({ type, severity, message, hint, branch: branch || null, entity: entity || null });

  // ── Config por sucursal ──
  const branches = db.prepare("SELECT * FROM branches WHERE is_active = 1 AND slug != 'master'").all();
  for (const b of branches) {
    if (!String(b.whatsapp || "").trim() && !String(b.phone || "").trim()) {
      add("config", "alta", `${b.name}: sin WhatsApp ni teléfono`, "Cargá un WhatsApp en Configuración; sin eso los pedidos no llegan al local.", b.name);
    }
    const zones = db.prepare("SELECT COUNT(*) n FROM delivery_zones WHERE branch_id = ?").get(b.id);
    if (zones.n === 0) {
      add("config", "media", `${b.name}: sin zonas de envío`, "Si hacés delivery, configurá las zonas para calcular el costo de envío.", b.name);
    }
  }

  // ── Productos / categorías (global) ──
  db.prepare("SELECT id, name FROM products WHERE is_active = 1 AND type = 'simple' AND (base_price IS NULL OR base_price <= 0)")
    .all().forEach((p) => add("config", "alta", `Producto "${p.name}" sin precio`, "Asigná un precio o desactivá el producto: hoy se muestra en $0.", null, p.name));
  db.prepare("SELECT id, name FROM products WHERE is_active = 1 AND (image_url IS NULL OR image_url = '')")
    .all().forEach((p) => add("config", "baja", `Producto "${p.name}" sin imagen`, "Subí una foto; los productos con imagen venden más.", null, p.name));
  db.prepare(`SELECT c.id, c.name FROM categories c WHERE c.is_active = 1
              AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id AND p.is_active = 1)`)
    .all().forEach((c) => add("config", "media", `Categoría "${c.name}" sin productos`, "Agregá productos o desactivá la categoría: el cliente ve una sección vacía.", null, c.name));

  // ── Promos / cupones sin sentido ──
  db.prepare("SELECT code, name, value, date_to FROM coupons WHERE is_active = 1 AND date_to != '' AND date_to < date('now','-3 hours')")
    .all().forEach((c) => add("promo", "media", `Cupón "${c.code}" vencido pero activo`, `Venció el ${c.date_to}. Desactivalo o extendé la fecha.`, null, c.code));
  db.prepare("SELECT code, name FROM coupons WHERE is_active = 1 AND value <= 0")
    .all().forEach((c) => add("promo", "media", `Cupón "${c.code}" con descuento 0`, "No mejora el precio: ponele un valor o desactivalo.", null, c.code));
  db.prepare("SELECT id, name, date_to FROM promotions WHERE is_active = 1 AND date_to != '' AND date_to < date('now','-3 hours')")
    .all().forEach((p) => add("promo", "media", `Promo "${p.name}" vencida pero activa`, `Venció el ${p.date_to}. Desactivala.`, null, p.name));

  // ── Pedidos trabados (pendientes hace +2h) ──
  db.prepare(`SELECT o.id, b.name bname, o.created_at FROM orders o
              LEFT JOIN branches b ON b.id = o.branch_id
              WHERE o.status = 'pending' AND o.created_at < datetime('now','-2 hours')
              ORDER BY o.created_at ASC LIMIT 50`)
    .all().forEach((o) => add("orders", "alta", `Pedido #${o.id} (${o.bname || "?"}) pendiente hace +2h`, "Confirmalo o cancelalo: el cliente está esperando respuesta.", o.bname, `#${o.id}`));

  const order = { alta: 0, media: 1, baja: 2 };
  issues.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  res.json({ generatedAt: new Date().toISOString(), count: issues.length, issues });
});

function safeParseJson(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/* ══════════════════════════════════════════════════
   Uso estimado de la API de Google Maps (mes actual)
   ══════════════════════════════════════════════════ */
// Constantes editables. Ajustá MAPS_PRICE_PER_1000 hasta que el estimado matchee
// tu factura real de Google. MAPS_MONTHLY_BUDGET_USD es el tope contra el que se
// compara la barra del admin (no es un límite que corte nada; solo referencia).
const MAPS_PRICE_PER_1000 = 7; // USD por 1000 cargas (aprox. Maps JS dinámico)
const MAPS_MONTHLY_BUDGET_USD = 50;

router.get("/metrics/maps-usage", (req, res) => {
  const db = req.app.locals.db;
  const countInMonth = (offset) =>
    db
      .prepare(
        `SELECT COUNT(*) n FROM analytics_events
         WHERE event_type = 'maps_load'
           AND created_at >= date('now','localtime','start of month', ?)
           AND created_at <  date('now','localtime','start of month', ?)`
      )
      .get(`${offset} month`, `${offset + 1} month`).n;

  const loads = countInMonth(0);
  const loadsPrevMonth = countInMonth(-1);
  const estimatedUsd = (loads / 1000) * MAPS_PRICE_PER_1000;

  res.json({
    month: new Date().toISOString().slice(0, 7),
    loads,
    loadsPrevMonth,
    estimatedUsd,
    pricePer1000: MAPS_PRICE_PER_1000,
    budgetUsd: MAPS_MONTHLY_BUDGET_USD,
    pct: MAPS_MONTHLY_BUDGET_USD > 0 ? estimatedUsd / MAPS_MONTHLY_BUDGET_USD : 0,
  });
});

module.exports = router;
