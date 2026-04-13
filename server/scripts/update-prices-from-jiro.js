#!/usr/bin/env node
/*
 * Scrapea páginas de categoría de jirosushi.com.ar (WordPress + Elementor),
 * matchea productos contra los ya cargados en TUS_PEDIDOS y actualiza precios.
 *
 * Uso:
 *   node server/scripts/update-prices-from-jiro.js                       # scan usando jiro-urls.txt
 *   node server/scripts/update-prices-from-jiro.js https://... https://...   # scan de URLs específicas
 *   node server/scripts/update-prices-from-jiro.js --urls archivo.txt        # scan de un archivo custom
 *   node server/scripts/update-prices-from-jiro.js --apply                   # aplica el último snapshot
 *   node server/scripts/update-prices-from-jiro.js --apply --file <path>
 *
 * Credenciales:
 *   ADMIN_TOKEN=<jwt>                               (preferido)
 *   o ADMIN_USERNAME=<user> ADMIN_PASSWORD=<pass>   (hace login automático)
 *
 * Variables opcionales:
 *   API_URL=http://localhost:3000  (default)
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "output");
const DEFAULT_URLS_FILE = path.join(__dirname, "jiro-urls.txt");
const API_URL = process.env.API_URL || "http://localhost:3000";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const fileArgIdx = args.indexOf("--file");
const FILE_ARG = fileArgIdx >= 0 ? args[fileArgIdx + 1] : null;
const urlsArgIdx = args.indexOf("--urls");
const URLS_FILE_ARG = urlsArgIdx >= 0 ? args[urlsArgIdx + 1] : null;
const URL_ARGS = args.filter((a) => /^https?:\/\//.test(a));

/* ── API client ───────────────────────────────────────── */

async function apiLogin() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Falta ADMIN_TOKEN (o ADMIN_USERNAME + ADMIN_PASSWORD) en el entorno."
    );
  }
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Login falló: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  if (data.user.role !== "master") {
    throw new Error(`El usuario debe tener rol "master", tiene "${data.user.role}".`);
  }
  return data.token;
}

async function apiGetProducts(token) {
  const res = await fetch(`${API_URL}/api/catalog/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /api/catalog/products: ${res.status}`);
  return res.json();
}

async function apiUpdateProduct(token, id, body) {
  const res = await fetch(`${API_URL}/api/catalog/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${id}: ${res.status} ${await res.text()}`);
  return res.json();
}

/* ── Normalización ────────────────────────────────────── */

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    // Remover badges que pueden aparecer en el nombre pero son flags aparte
    // en TUS_PEDIDOS — evita falsos no-matches por "(Sin Tacc) X" vs "X".
    .replace(/\bsin\s+tacc\b/g, " ")
    .replace(/\bnuevo\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variantKey(label) {
  if (!label) return "__single__";
  const n = normalize(label);
  // Intenta detectar cantidad: "x5", "x 10", "5 unidades", "5 piezas", "10u", etc.
  const match = n.match(/(?:x\s*)?(\d+)(?:\s*(?:u|unidades?|piezas?|pzs?|pcs?|bocados?))?/);
  if (match) return `x${match[1]}`;
  return n;
}

function parsePrice(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return Math.round(raw);
  const s = String(raw).trim();
  // "$10.900", "10.900", "$10,900", "10900"
  // En AR el punto suele ser separador de miles, la coma decimales.
  const cleaned = s.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  // Si tiene coma como último separador, es decimal → descartar parte decimal
  const hasComma = cleaned.lastIndexOf(",");
  const hasDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (hasComma > hasDot) {
    normalized = cleaned.replace(/\./g, "").split(",")[0];
  } else {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, "");
  }
  const n = parseInt(normalized, 10);
  return Number.isFinite(n) ? n : null;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

/* ── Scraping ─────────────────────────────────────────── */

function cleanText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

// Extrae variantes o precio simple de un texto tipo "x5 $10.280 - x10 $20.560" o "$27.210"
function parsePriceText(text) {
  const variantRegex = /x\s*(\d+)\s*\$\s*([\d.,]+)/gi;
  const variants = [];
  let m;
  while ((m = variantRegex.exec(text)) !== null) {
    const count = m[1];
    const price = parsePrice(m[2]);
    if (price != null) variants.push({ label: `x${count}`, price });
  }
  if (variants.length > 0) return variants;

  const simple = text.match(/\$\s*([\d.,]+)/);
  if (simple) {
    const price = parsePrice(simple[1]);
    if (price != null) return [{ label: null, price }];
  }
  return [];
}

function isProbablyHeader(name) {
  // "YAKIMESHI", "YAKISOBA", "ROLLS ESPECIALES" → headers de sección (todo mayúsculas)
  const letters = name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters.length === 0) return true;
  return letters === letters.toUpperCase() && letters.length <= 30;
}

async function scrapeJiroPage(url) {
  let cheerio;
  try {
    cheerio = require("cheerio");
  } catch {
    throw new Error(
      'cheerio no está instalado. Corré: cd server && npm install --save-dev cheerio'
    );
  }
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const products = [];
  let pendingName = null;

  // Iteramos todos los h2 heading-title en orden del documento. Si el texto
  // contiene "$" es un precio y lo asociamos al último nombre pendiente.
  // Si no contiene "$" es un nombre candidato (si ya había uno pendiente sin
  // precio, era un header de sección y lo descartamos).
  $("h2.elementor-heading-title").each((_, el) => {
    const text = cleanText($(el).text());
    if (!text) return;

    if (text.includes("$")) {
      if (!pendingName) return;
      const variants = parsePriceText(text);
      if (variants.length > 0 && !isProbablyHeader(pendingName)) {
        products.push({ name: pendingName, variants });
      }
      pendingName = null;
    } else {
      pendingName = text;
    }
  });

  return products;
}

async function scrapeJiroMenu(urls) {
  const all = [];
  for (const url of urls) {
    console.log(`→ Scrapeando ${url}`);
    try {
      const items = await scrapeJiroPage(url);
      console.log(`   ${items.length} productos`);
      for (const it of items) all.push({ ...it, sourceUrl: url });
    } catch (e) {
      console.error(`   ✗ ${e.message}`);
    }
  }
  // Dedup por nombre normalizado (última ocurrencia gana)
  const byKey = new Map();
  for (const p of all) byKey.set(normalize(p.name), p);
  return Array.from(byKey.values());
}

function loadUrls() {
  if (URL_ARGS.length > 0) return URL_ARGS;
  const file = URLS_FILE_ARG || DEFAULT_URLS_FILE;
  if (!fs.existsSync(file)) {
    throw new Error(
      `No hay URLs para scrapear. Pasalas como argumentos, con --urls <file>, o creá ${DEFAULT_URLS_FILE}`
    );
  }
  return fs
    .readFileSync(file, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && /^https?:\/\//.test(l));
}

/* ── Matching ─────────────────────────────────────────── */

function matchProducts(scraped, existing) {
  const autoApply = [];
  const ambiguous = [];
  const notFound = [];

  const existingByNorm = new Map();
  for (const p of existing) existingByNorm.set(normalize(p.name), p);
  const existingNames = Array.from(existingByNorm.keys());

  for (const jiro of scraped) {
    const key = normalize(jiro.name);
    let matched = existingByNorm.get(key);
    let matchType = "exact";

    if (!matched) {
      // Contains: jiro name contained in existing or viceversa
      const candidates = existingNames.filter(
        (n) => n.includes(key) || key.includes(n)
      );
      if (candidates.length === 1) {
        matched = existingByNorm.get(candidates[0]);
        matchType = "contains";
      } else if (candidates.length > 1) {
        ambiguous.push({
          jiro,
          reason: "nombre ambiguo (varios productos existentes coinciden parcialmente)",
          candidates: candidates.map((c) => existingByNorm.get(c).name),
        });
        continue;
      }
    }

    if (!matched) {
      // Fuzzy
      let best = null;
      let bestDist = Infinity;
      for (const n of existingNames) {
        if (Math.abs(n.length - key.length) > 3) continue;
        const d = levenshtein(n, key);
        if (d < bestDist) {
          bestDist = d;
          best = n;
        }
      }
      if (best && bestDist <= 2) {
        ambiguous.push({
          jiro,
          reason: `match difuso (distancia=${bestDist})`,
          candidates: [existingByNorm.get(best).name],
        });
        continue;
      }
      notFound.push({ jiro });
      continue;
    }

    // Tenemos producto matcheado → matchear variantes
    const variantDiff = matchVariants(jiro, matched);
    if (variantDiff.status === "ok") {
      if (variantDiff.changes.length === 0) {
        // Nada que actualizar
        continue;
      }
      autoApply.push({
        jiro,
        product: matched,
        matchType,
        type: matched.type,
        changes: variantDiff.changes,
      });
    } else {
      ambiguous.push({
        jiro,
        product: matched,
        reason: variantDiff.reason,
        jiroVariants: jiro.variants,
        existingVariants: matched.variants || [],
      });
    }
  }

  return { autoApply, ambiguous, notFound };
}

function matchVariants(jiro, product) {
  const isSimple = product.type === "simple";
  const existingVariants = Array.isArray(product.variants) ? product.variants : [];

  // Caso 1: producto simple del lado de TUS_PEDIDOS
  if (isSimple) {
    if (jiro.variants.length !== 1) {
      return {
        status: "ambiguous",
        reason: `lado TUS es simple pero jiro tiene ${jiro.variants.length} variantes`,
      };
    }
    const newPrice = jiro.variants[0].price;
    if (newPrice === product.base_price) return { status: "ok", changes: [] };
    return {
      status: "ok",
      changes: [{ kind: "base_price", from: product.base_price, to: newPrice }],
    };
  }

  // Caso 2: producto con variantes
  if (existingVariants.length === 0) {
    return { status: "ambiguous", reason: "producto tipo options sin variantes cargadas" };
  }

  // Si del lado Jiro vino una sola variante sin label y TUS tiene varias, es ambiguo
  if (jiro.variants.length === 1 && jiro.variants[0].label == null && existingVariants.length > 1) {
    return {
      status: "ambiguous",
      reason: "jiro trae un solo precio pero el producto tiene múltiples variantes",
    };
  }

  // Match por variantKey extraído del label
  const jiroByKey = new Map();
  for (const v of jiro.variants) {
    const k = variantKey(v.label);
    if (jiroByKey.has(k)) {
      return { status: "ambiguous", reason: `jiro tiene labels duplicados (${k})` };
    }
    jiroByKey.set(k, v);
  }

  const changes = [];
  let matchedCount = 0;
  for (const ev of existingVariants) {
    const k = variantKey(ev.label);
    const jv = jiroByKey.get(k);
    if (!jv) continue;
    matchedCount++;
    if (jv.price !== ev.price) {
      changes.push({
        kind: "variant",
        variantId: ev.id,
        label: ev.label,
        from: ev.price,
        to: jv.price,
      });
    }
  }

  if (matchedCount === 0) {
    return {
      status: "ambiguous",
      reason: "ninguna variante coincidió por label (revisar formatos)",
    };
  }

  // Si hay variantes del lado TUS que no matchearon y también del lado jiro, flag
  const unmatchedJiro = jiro.variants.length - matchedCount;
  const unmatchedTus = existingVariants.length - matchedCount;
  if (unmatchedJiro > 0 || unmatchedTus > 0) {
    return {
      status: "ambiguous",
      reason: `variantes parcialmente matcheadas (matched=${matchedCount}, jiro_resto=${unmatchedJiro}, tus_resto=${unmatchedTus})`,
    };
  }

  return { status: "ok", changes };
}

/* ── Apply ────────────────────────────────────────────── */

async function applySnapshot(token, snapshot) {
  const logLines = [];
  let ok = 0;
  let failed = 0;
  const batchId = `jiro-${timestamp()}`;
  const audit = { batch_id: batchId, source: "jiro-script" };
  console.log(`→ Batch ID: ${batchId}`);

  for (const entry of snapshot.autoApply) {
    const product = entry.product;
    try {
      const body = { _audit: audit };
      if (entry.type === "simple") {
        const change = entry.changes.find((c) => c.kind === "base_price");
        if (!change) continue;
        body.base_price = change.to;
      } else {
        // options: el PUT reemplaza todas las variantes — hay que reenviar el set completo
        const newVariants = product.variants.map((v) => {
          const change = entry.changes.find((c) => c.kind === "variant" && c.variantId === v.id);
          return {
            label: v.label,
            price: change ? change.to : v.price,
            stock: v.stock,
            sort_order: v.sort_order,
          };
        });
        body.variants = newVariants;
      }

      await apiUpdateProduct(token, product.id, body);
      const summary = entry.changes
        .map((c) => (c.kind === "base_price" ? `base: ${c.from}→${c.to}` : `${c.label}: ${c.from}→${c.to}`))
        .join(", ");
      const line = `✓ [${product.id}] ${product.name} — ${summary}`;
      console.log(line);
      logLines.push(line);
      ok++;
    } catch (e) {
      const line = `✗ [${product.id}] ${product.name} — ${e.message}`;
      console.error(line);
      logLines.push(line);
      failed++;
    }
  }

  console.log(`\n→ Aplicados: ${ok}  Fallidos: ${failed}`);
  const logPath = path.join(OUTPUT_DIR, `jiro-apply-${timestamp()}.log`);
  fs.writeFileSync(logPath, logLines.join("\n") + "\n");
  console.log(`→ Log: ${logPath}`);
}

/* ── Snapshot helpers ─────────────────────────────────── */

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function findLatestSnapshot() {
  if (!fs.existsSync(OUTPUT_DIR)) return null;
  const files = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith("jiro-prices-") && f.endsWith(".json"))
    .map((f) => ({ f, t: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length > 0 ? path.join(OUTPUT_DIR, files[0].f) : null;
}

/* ── Main ─────────────────────────────────────────────── */

(async () => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const token = await apiLogin();
    console.log("→ Autenticado contra", API_URL);

    if (APPLY) {
      const filePath = FILE_ARG || findLatestSnapshot();
      if (!filePath) {
        throw new Error("No hay snapshot para aplicar. Corré primero sin --apply.");
      }
      console.log(`→ Aplicando snapshot: ${filePath}`);
      const snapshot = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      await applySnapshot(token, snapshot);
      return;
    }

    // Dry-run / scan
    const existing = await apiGetProducts(token);
    console.log(`→ Productos en TUS_PEDIDOS: ${existing.length}`);

    const urls = loadUrls();
    console.log(`→ URLs a scrapear: ${urls.length}`);
    const scraped = await scrapeJiroMenu(urls);
    console.log(`→ Productos scrapeados de Jiro: ${scraped.length}`);

    if (scraped.length === 0) {
      console.error("✗ No se scrapearon productos — nada que hacer.");
      process.exit(1);
    }

    const result = matchProducts(scraped, existing);

    console.log(`\n── RESULTADO ────────────────────────────`);
    console.log(`✓ auto-apply : ${result.autoApply.length}`);
    console.log(`? ambiguous  : ${result.ambiguous.length}`);
    console.log(`✗ not-found  : ${result.notFound.length}`);

    if (result.autoApply.length > 0) {
      console.log(`\n── AUTO-APPLY ───────────────────────────`);
      for (const e of result.autoApply) {
        const summary = e.changes
          .map((c) => (c.kind === "base_price" ? `base: ${c.from}→${c.to}` : `${c.label}: ${c.from}→${c.to}`))
          .join(", ");
        console.log(`  [${e.product.id}] ${e.product.name}  —  ${summary}`);
      }
    }

    if (result.ambiguous.length > 0) {
      console.log(`\n── AMBIGUOUS (revisar manualmente) ──────`);
      for (const e of result.ambiguous) {
        console.log(`  "${e.jiro.name}"  →  ${e.reason}`);
        if (e.candidates) console.log(`     candidatos: ${e.candidates.join(" | ")}`);
      }
    }

    if (result.notFound.length > 0) {
      console.log(`\n── NOT-FOUND (productos de jiro no existentes en TUS) ──`);
      for (const e of result.notFound) console.log(`  · ${e.jiro.name}`);
    }

    const snapshotPath = path.join(OUTPUT_DIR, `jiro-prices-${timestamp()}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(result, null, 2));
    console.log(`\n→ Snapshot guardado en: ${snapshotPath}`);
    console.log(`→ Para aplicar los cambios auto-apply: node server/scripts/update-prices-from-jiro.js --apply`);
  } catch (e) {
    console.error("✗ Error:", e.message);
    process.exit(1);
  }
})();
