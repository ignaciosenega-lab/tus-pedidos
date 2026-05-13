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
    .prepare(`SELECT o.branch_id, o.items FROM orders o WHERE 1=1${dateSql}${branchSql}`)
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

function safeParseJson(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = router;
