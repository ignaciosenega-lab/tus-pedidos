const express = require("express");

const router = express.Router();

/**
 * Feed público del catálogo, para que otro sistema lo importe.
 *
 *   GET /api/public/menu                    → catálogo global, precios de lista
 *   GET /api/public/menu?sucursal=canning   → lo que ve esa sucursal, a sus precios
 *   GET /api/public/menu?formato=csv        → lo mismo como planilla que abre Excel
 *
 * Sin `sucursal` la respuesta conserva la forma que ya consume JIRO_FQC: lo
 * nuevo se agrega, nada se saca ni se renombra.
 *
 * Dos decisiones que no son obvias:
 *
 * 1. Los precios que salen de acá son SIEMPRE los de lista. /api/state entrega
 *    el precio con la promoción del día ya aplicada —correcto para la tienda,
 *    equivocado para un catálogo: el otro sistema importaría el precio de un
 *    martes y se quedaría con él para siempre. Cuando hay promo activa,
 *    readStateFromDb deja el de lista en `originalPrice`, y es el que tomamos.
 *
 * 2. Sin `sucursal` los precios son los del catálogo base, sin la regla de
 *    precio del menú ni los ajustes por sucursal. Es decir: pueden no coincidir
 *    con lo que paga nadie. Para entregar un menú que se pueda cobrar hay que
 *    pedir una sucursal.
 */

/** Una imagen sirve a un tercero solo si la URL es absoluta. */
function absolutizar(url, base) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return base + (u.startsWith("/") ? u : "/" + u);
}

/** El precio sin la promo del día encima (ver nota 1 arriba). */
function precioLista(x, campo) {
  return Number(x.originalPrice != null ? x.originalPrice : x[campo]) || 0;
}

function itemDeSucursal(p, base) {
  const item = {
    id: p.id,
    nombre: p.name,
    descripcion: p.description || "",
    tipo: p.variants && p.variants.length ? "variantes" : "simple",
    etiquetas: p.badges || [],
    imagen: absolutizar(p.imageUrl, base),
    galeria: (p.gallery || []).map((g) => absolutizar(g, base)),
    adicionales: (p.toppings || []).map((t) => ({
      id: t.id,
      nombre: t.name,
      precio: Number(t.price) || 0,
    })),
  };
  if (p.variants && p.variants.length) {
    item.variantes = p.variants.map((v) => ({
      id: v.id,
      label: v.label || "",
      precio: precioLista(v, "price"),
    }));
  } else {
    item.precio = precioLista(p, "basePrice");
  }
  return item;
}

/** Catálogo del catálogo global, sin sucursal: precios base. */
function catalogoGlobal(db, base) {
  const categorias = db
    .prepare("SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order, id")
    .all();

  const productosStmt = db.prepare(
    `SELECT id, name, description, base_price, type, image_url, gallery, badges
       FROM products
      WHERE category_id = ? AND is_active = 1 AND is_private = 0
      ORDER BY id`
  );
  const variantsStmt = db.prepare(
    "SELECT id, label, price FROM product_variants WHERE product_id = ? ORDER BY sort_order, id"
  );
  const toppingsStmt = db.prepare(
    "SELECT id, name, price FROM product_toppings WHERE product_id = ? ORDER BY sort_order, id"
  );

  const json = (txt, fallback) => {
    try {
      const v = JSON.parse(txt);
      return Array.isArray(v) ? v : fallback;
    } catch {
      return fallback;
    }
  };

  return categorias.map((c) => ({
    id: String(c.id),
    nombre: c.name,
    items: productosStmt.all(c.id).map((p) => {
      const variantes = variantsStmt.all(p.id);
      const item = {
        id: String(p.id),
        nombre: p.name,
        descripcion: p.description || "",
        tipo: variantes.length > 0 ? "variantes" : "simple",
        etiquetas: json(p.badges, []),
        imagen: absolutizar(p.image_url, base),
        galeria: json(p.gallery, []).map((g) => absolutizar(g, base)),
        adicionales: toppingsStmt.all(p.id).map((t) => ({
          id: String(t.id),
          nombre: t.name,
          precio: Number(t.price) || 0,
        })),
      };
      if (variantes.length > 0) {
        item.variantes = variantes.map((v) => ({
          id: String(v.id),
          label: v.label || "",
          precio: Number(v.price),
        }));
      } else {
        item.precio = Number(p.base_price);
      }
      return item;
    }),
  }));
}

/** Catálogo tal como lo ve una sucursal: su menú, sus ajustes, sus precios. */
function catalogoDeSucursal(state, base) {
  const porCategoria = new Map(
    state.categories.map((c) => [c.id, { id: c.id, nombre: c.name, items: [] }])
  );
  for (const p of state.products || []) {
    if (p.private) continue; // los privados no son parte del menú público
    const cat = porCategoria.get(p.categoryId);
    if (!cat) continue; // categoría oculta en esta sucursal
    cat.items.push(itemDeSucursal(p, base));
  }
  return [...porCategoria.values()];
}

/**
 * La misma información como planilla, una fila por cosa que se pueda vender
 * (un producto simple, o una variante). Las dos cosas que hacen que abra bien
 * en el Excel en español: el BOM, sin el cual los acentos salen rotos, y el
 * punto y coma como separador, porque con coma mete todo en una columna.
 */
function aCsv(categorias) {
  const sep = ";";
  const limpio = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const num = (v) => `"${String(Math.round(Number(v) || 0)).replace(".", ",")}"`;

  const cabecera = [
    "Categoría", "Producto", "Descripción", "Variante", "Precio",
    "Adicionales", "Etiquetas", "Foto", "ID producto", "ID variante",
  ];

  const filas = [];
  for (const c of categorias) {
    for (const it of c.items) {
      const adicionales = (it.adicionales || [])
        .map((a) => `${a.nombre} (+${Math.round(a.precio)})`)
        .join(" | ");
      const comunes = [
        limpio(c.nombre), limpio(it.nombre), limpio(it.descripcion),
      ];
      const cola = [
        limpio(adicionales), limpio((it.etiquetas || []).join(", ")),
        limpio(it.imagen), limpio(it.id),
      ];
      if (it.variantes && it.variantes.length) {
        for (const v of it.variantes) {
          filas.push([...comunes, limpio(v.label), num(v.precio), ...cola, limpio(v.id)].join(sep));
        }
      } else {
        filas.push([...comunes, limpio(""), num(it.precio), ...cola, limpio("")].join(sep));
      }
    }
  }

  return "﻿" + [cabecera.map(limpio).join(sep), ...filas].join("\r\n");
}

router.get("/menu", (req, res) => {
  try {
    const db = req.app.locals.db;
    const leerEstado = req.app.locals.readStateFromDb;
    const base = `${req.protocol}://${req.get("host")}`;
    const slug = String(req.query.sucursal || "").trim();

    let categorias;
    let sucursal = null;

    if (slug) {
      const state = leerEstado ? leerEstado(slug) : null;
      if (!state) {
        return res.status(404).json({ error: `No existe la sucursal "${slug}"` });
      }
      categorias = catalogoDeSucursal(state, base);
      const fila = db
        .prepare("SELECT slug, name, address, phone FROM branches WHERE id = ?")
        .get(state.branchId);
      sucursal = fila
        ? { slug: fila.slug, nombre: fila.name, direccion: fila.address || "", telefono: fila.phone || "" }
        : { slug };
    } else {
      categorias = catalogoGlobal(db, base);
    }

    if (String(req.query.formato || "").toLowerCase() === "csv") {
      const nombre = `menu-${sucursal ? sucursal.slug : "catalogo"}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      res.set("Cache-Control", "public, max-age=300");
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="${nombre}"`);
      return res.send(aCsv(categorias));
    }

    res.set("Cache-Control", "public, max-age=300");
    res.json({
      generatedAt: new Date().toISOString(),
      moneda: "ARS",
      // Sin sucursal, los precios no llevan la regla del menú ni los ajustes
      // por sucursal. Lo decimos en la respuesta para que nadie los cobre.
      precios: sucursal ? "de lista, de esta sucursal" : "de lista, del catálogo base",
      sucursal,
      categorias,
    });
  } catch (err) {
    console.error("Error en GET /api/public/menu", err);
    res.status(500).json({ error: err?.message || "Error obteniendo menú" });
  }
});

module.exports = router;
