// Clasificación de pedidos por barrio cerrado / country.
//
// Un pedido cae en un barrio de dos maneras, en este orden:
//   1. POLÍGONO — si el pedido tiene coordenadas y caen dentro del contorno
//      dibujado. Es exacto y no depende de cómo escriba el cliente.
//   2. NOMBRE — si el texto de la dirección contiene el nombre del barrio o
//      alguno de sus alias. Funciona sobre todo el historial, incluidos los
//      pedidos tomados con Google Maps apagado, que no tienen coordenadas.
//
// La clasificación NO se guarda en el pedido: se calcula cada vez. La lista de
// barrios va a crecer, y al agregar uno nuevo los pedidos viejos tienen que
// reclasificarse solos. Guardarlo congelaría el historial.

/**
 * Minúsculas, sin tildes, sin puntuación, espacios colapsados.
 * Es lo que hace que "Saint Thomas", "SAINT-THOMAS" y "saint  thomas" sean lo
 * mismo, y lo que permite buscar el nombre adentro de "Barrio Saint Thomas sur
 * lote 429".
 */
function normalizar(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca las tildes
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ") // puntuación y símbolos → espacio
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Ray casting: ¿el punto cae dentro del polígono?
 *
 * ⚠️ Gemela de isPointInPolygon en src/utils/kmlParser.ts. El front la necesita
 * en TypeScript para el checkout y el server en JS para las métricas; si tocás
 * una, tocá la otra. El polígono viene como [[lat, lng], ...].
 */
function puntoEnPoligono(lat, lng, poligono) {
  if (!Array.isArray(poligono) || poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [lat1, lng1] = poligono[i];
    const [lat2, lng2] = poligono[j];
    if (typeof lat1 !== "number" || typeof lng1 !== "number") continue;
    if (lat1 > lat !== lat2 > lat) {
      const corte = ((lng2 - lng1) * (lat - lat1)) / (lat2 - lat1) + lng1;
      if (lng < corte) dentro = !dentro;
    }
  }
  return dentro;
}

/**
 * Prepara la lista una sola vez para no re-parsear el JSON en cada pedido.
 * Devuelve cada barrio con sus términos normalizados, ordenados de más largo a
 * más corto: así "saint thomas norte" le gana a "saint thomas" y un alias corto
 * no le roba pedidos a un nombre más específico.
 */
function prepararBarrios(filas) {
  return (filas || [])
    .filter((b) => b.is_active === undefined || b.is_active)
    .map((b) => {
      let alias = [];
      let poligono = [];
      try {
        alias = JSON.parse(b.aliases || "[]");
      } catch {
        alias = [];
      }
      try {
        poligono = JSON.parse(b.polygon || "[]");
      } catch {
        poligono = [];
      }
      const terminos = [b.name, ...(Array.isArray(alias) ? alias : [])]
        .map(normalizar)
        .filter(Boolean)
        .sort((x, y) => y.length - x.length);
      return { id: b.id, name: b.name, color: b.color, terminos, poligono };
    });
}

/**
 * Devuelve el barrio del pedido, o null si no cae en ninguno.
 * `barrios` tiene que venir de prepararBarrios().
 */
function clasificar(pedido, barrios) {
  const lat = Number(pedido?.lat);
  const lng = Number(pedido?.lng);

  // 1. El polígono manda cuando hay coordenadas.
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
    for (const b of barrios) {
      if (b.poligono.length >= 3 && puntoEnPoligono(lat, lng, b.poligono)) {
        return b;
      }
    }
  }

  // 2. Si no, se busca el nombre en la dirección. Gana la coincidencia más
  //    larga de todas, no la del primer barrio de la lista.
  const texto = normalizar(pedido?.address);
  if (!texto) return null;

  let mejor = null;
  let largo = 0;
  for (const b of barrios) {
    for (const t of b.terminos) {
      if (t.length > largo && texto.includes(t)) {
        mejor = b;
        largo = t.length;
        break; // los términos ya vienen de mayor a menor
      }
    }
  }
  return mejor;
}

/**
 * Fragmentos de texto que se repiten en las direcciones y todavía no pertenecen
 * a ningún barrio cargado. Sirve para armar la lista a partir de los datos
 * reales en vez de inventarla de memoria.
 *
 * Descarta lo que claramente no es un nombre de barrio: números, palabras de
 * calle ("av", "calle", "lote"), y los fragmentos que aparecen una sola vez.
 */
const RUIDO = new Set([
  "av", "avenida", "calle", "ruta", "km", "lote", "lot", "casa", "piso", "depto",
  "departamento", "manzana", "mz", "mza", "s", "n", "nro", "numero", "esq",
  "esquina", "entre", "y", "de", "del", "la", "el", "los", "las", "a", "al",
  "provincia", "buenos", "aires", "argentina", "b", "bis", "sur", "norte",
  "este", "oeste", "barrio", "country", "countrie", "bo",
]);

function sugerir(direcciones, barrios, { minimo = 2, max = 25 } = {}) {
  const cuenta = new Map();

  for (const d of direcciones) {
    const dir = d && d.address ? d.address : d;
    // Si ya cae en un barrio conocido, no hay nada que sugerir.
    if (clasificar({ address: dir }, barrios)) continue;

    const palabras = normalizar(dir)
      .split(" ")
      .filter((w) => w && !/^\d+$/.test(w) && !RUIDO.has(w));

    // Fragmentos de 1 y 2 palabras: "terralagos", "saint thomas".
    const frags = new Set();
    for (let i = 0; i < palabras.length; i++) {
      if (palabras[i].length >= 4) frags.add(palabras[i]);
      if (i + 1 < palabras.length) frags.add(`${palabras[i]} ${palabras[i + 1]}`);
    }
    for (const f of frags) {
      cuenta.set(f, (cuenta.get(f) || 0) + 1);
    }
  }

  let lista = [...cuenta.entries()].filter(([, n]) => n >= minimo);

  // "saint", "thomas" y "saint thomas" cuentan lo mismo: sobran los pedazos.
  // Se descarta el fragmento que está contenido en otro más largo con el mismo
  // conteo, así queda el nombre completo y no sus mitades.
  lista = lista.filter(([texto, n]) =>
    !lista.some(
      ([otro, m]) =>
        otro !== texto &&
        m === n &&
        otro.length > texto.length &&
        (otro === texto ||
          otro.startsWith(texto + " ") ||
          otro.endsWith(" " + texto) ||
          otro.includes(" " + texto + " "))
    )
  );

  return lista
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([texto, direcciones]) => ({ texto, direcciones }));
}

module.exports = { normalizar, puntoEnPoligono, prepararBarrios, clasificar, sugerir };
