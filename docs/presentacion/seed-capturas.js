/**
 * Siembra la base LOCAL para capturar los mockups del deck.
 * Usa el catálogo real de producción (nombres, precios y fotos públicas) para
 * que las capturas tengan comida de verdad, sin tocar producción ni exponer
 * un solo dato de cliente real.
 *
 * Uso: node seed-deck.js <modo>
 *   catalogo  — catálogo limpio, con badges. Sin promos ni cupones.
 *   carrusel  — + promo 30% y promo 2x1 (para el carrusel)
 *   cupon     — catálogo limpio + un cupón del 10%
 *   ruleta    — catálogo limpio + ruleta prendida
 *   cerrado   — catálogo limpio + local cerrado con hora de reapertura
 */
const path = require("path");
const RAIZ = "/Users/ignaciosenega/Documents/VisualCode/TUS_PEDIDOS";
const { getDb } = require(path.join(RAIZ, "server/db"));
const db = getDb();
const estado = require("./prod-state.json");

const modo = process.argv[2] || "catalogo";
const SUC = 1;

// ── Limpieza de todo lo que puede afectar una captura ──
db.prepare("DELETE FROM promotions").run();
db.prepare("DELETE FROM promotion_products").run();
db.prepare("DELETE FROM coupons").run();
db.prepare("DELETE FROM wheel_spins").run();
db.prepare("DELETE FROM orders").run();
db.prepare("UPDATE branches SET wheel_enabled = 0, is_open = 1, paused_until = NULL, schedule = '{}' WHERE id = ?").run(SUC);

// ── Catálogo: se recarga siempre, para que los ids sean estables ──
db.prepare("DELETE FROM product_variants").run();
db.prepare("DELETE FROM products").run();
db.prepare("DELETE FROM categories").run();

const catIds = {};
const insCat = db.prepare("INSERT INTO categories (name, sort_order, is_active) VALUES (?, ?, 1)");
// Solo las categorías que tienen productos con foto, en el orden de producción
const usadas = [];
for (const c of estado.categories) {
  const tiene = estado.products.some((p) => p.categoryId === c.id && p.imageUrl);
  if (tiene) usadas.push(c);
}
usadas.forEach((c, i) => { catIds[c.id] = Number(insCat.run(c.name, i + 1).lastInsertRowid); });

const insProd = db.prepare(`INSERT INTO products
  (name, description, category_id, image_url, type, base_price, badges, is_active, is_private, gallery)
  VALUES (?, ?, ?, ?, 'simple', ?, ?, 1, 0, '[]')`);

const porNombre = {};
let n = 0;
for (const p of estado.products) {
  if (!p.imageUrl || !catIds[p.categoryId]) continue;
  const precio = p.basePrice || (p.variants && p.variants[0] && p.variants[0].price) || 0;
  if (!precio) continue;
  // Badges de ejemplo en dos productos, para que se vean los chips
  let badges = "[]";
  if (p.name === "Harumakis") badges = '["nuevo"]';
  if (p.name.toLowerCase().includes("sin tacc") && n < 40) badges = '["sin_tacc"]';
  const id = Number(insProd.run(p.name, p.description || "", catIds[p.categoryId], p.imageUrl, precio, badges).lastInsertRowid);
  porNombre[p.name] = { id, precio };
  n++;
}
console.log(`catálogo: ${n} productos, ${usadas.length} categorías`);

const buscar = (frag) => {
  const k = Object.keys(porNombre).find((x) => x.toLowerCase().includes(frag.toLowerCase()));
  return k ? { nombre: k, ...porNombre[k] } : null;
};

// ── Modos ──
if (modo === "carrusel") {
  const insPromo = db.prepare(`INSERT INTO promotions
    (branch_id, name, percentage, apply_to_all, date_from, date_to, weekly_repeat, is_active, type, min_quantity, apply_scope)
    VALUES (?, ?, ?, 0, '', '', 0, 1, ?, ?, 'products')`);
  const insPP = db.prepare("INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)");

  // Promo de porcentaje: precio tachado + chip "-30% OFF"
  const p30 = Number(insPromo.run(SUC, "Semana del Ceviche", 30, "percentage", 0).lastInsertRowid);
  ["Ceviche Limeño", "Ceviche Trujillano", "Salad de Salmón"].forEach((nm) => {
    const p = buscar(nm); if (p) insPP.run(p30, p.id);
  });

  // Promo 2x1: chip ámbar + la línea de letra chica
  const p2x1 = Number(insPromo.run(SUC, "2x1 en Harumakis", 50, "same_product_quantity", 2).lastInsertRowid);
  ["Harumakis", "Geishas de Mango"].forEach((nm) => {
    const p = buscar(nm); if (p) insPP.run(p2x1, p.id);
  });
  console.log("carrusel: promo 30% + promo 2x1 activas");
}

if (modo === "cupon") {
  db.prepare(`INSERT INTO coupons
    (branch_id, code, name, type, value, min_order, max_uses, used_count, apply_to, active_days, time_from, time_to, date_from, date_to, is_active, first_purchase_only)
    VALUES (?, 'BIENVENIDO', 'Bienvenida', 'percentage', 10, 0, 0, 0, 'all', '[]', '', '', '', '', 1, 0)`).run(SUC);
  console.log("cupón BIENVENIDO (10%) activo — el chip verde muestra 'Bienvenida'");
}

if (modo === "ruleta") {
  db.prepare("DELETE FROM wheel_prizes WHERE branch_id = ?").run(SUC);
  const insPremio = db.prepare(`INSERT INTO wheel_prizes
    (branch_id, label, type, value, max_discount, min_order, weight, color, sort_order, is_active)
    VALUES (?, ?, 'percentage', ?, 0, 0, ?, '#0f0f12', ?, 1)`);
  // El 10% con peso altísimo: es el premio que tiene que salir en la captura,
  // y deja la ruleta a la par del cupón en vez de verse como el mejor negocio.
  [["5% OFF", 5, 1], ["10% OFF", 10, 999], ["15% OFF", 15, 1], ["20% OFF", 20, 1], ["25% OFF", 25, 1]]
    .forEach(([label, val, peso], i) => insPremio.run(SUC, label, val, peso, i + 1));
  db.prepare("UPDATE branches SET wheel_enabled = 1, wheel_cooldown_hours = 0, wheel_expires_minutes = 60 WHERE id = ?").run(SUC);
  console.log("ruleta prendida, 5 gajos, el 10% con peso 999 para que salga seguro");
}

if (modo === "cerrado") {
  // Cerrado por horario con hora de reapertura: el cartel rojo invita a programar
  const horario = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] };
  const hoy = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"][new Date().getDay()];
  horario[hoy] = [{ open: "19:00", close: "23:30" }];
  db.prepare("UPDATE branches SET schedule = ?, is_open = 1 WHERE id = ?").run(JSON.stringify({ hours: horario }), SUC);
  console.log("local cerrado por horario, reabre 19:00");
}

console.log("modo:", modo, "— listo");
