const express = require("express");

const router = express.Router();

// GET /api/public/menu — feed público del catálogo agrupado por categoría.
// Pensado para que sistemas externos (ej. JIRO_FQC) lo consuman server-side
// y comparen contra el PDF oficial de la marca. Sin auth: expone lo mismo
// que ve cualquier visitante del sitio (productos activos, no privados).
router.get("/menu", (req, res) => {
  try {
    const db = req.app.locals.db;

    const categorias = db
      .prepare(
        "SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order, id"
      )
      .all();

    const productosStmt = db.prepare(
      `SELECT id, name, description, base_price, type
         FROM products
        WHERE category_id = ? AND is_active = 1 AND is_private = 0
        ORDER BY id`
    );
    const variantsStmt = db.prepare(
      "SELECT label, price FROM product_variants WHERE product_id = ? ORDER BY sort_order, id"
    );

    const payload = categorias.map((c) => ({
      nombre: c.name,
      items: productosStmt.all(c.id).map((p) => {
        const variantes = variantsStmt.all(p.id);
        const item = {
          nombre: p.name,
          descripcion: p.description || "",
        };
        if (variantes.length > 0) {
          item.variantes = variantes.map((v) => ({
            label: v.label || "",
            precio: Number(v.price),
          }));
        } else {
          item.precio = Number(p.base_price);
        }
        return item;
      }),
    }));

    res.set("Cache-Control", "public, max-age=300");
    res.json({
      generatedAt: new Date().toISOString(),
      categorias: payload,
    });
  } catch (err) {
    console.error("Error en GET /api/public/menu", err);
    res.status(500).json({ error: err?.message || "Error obteniendo menú" });
  }
});

module.exports = router;
