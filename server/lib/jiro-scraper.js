/*
 * Scraping + matching de precios desde páginas de categoría de jirosushi.com.ar.
 * Usado tanto por el script CLI (server/scripts/update-prices-from-jiro.js) como
 * por los endpoints POST /api/catalog/price-scan y /price-apply.
 */

const cheerio = require("cheerio");

function cleanText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bsin\s+tacc\b/g, " ")
    .replace(/\bnuevo\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variantKey(label) {
  if (!label) return "__single__";
  const n = normalize(label);
  const match = n.match(/(?:x\s*)?(\d+)(?:\s*(?:u|unidades?|piezas?|pzs?|pcs?|bocados?))?/);
  if (match) return `x${match[1]}`;
  return n;
}

function parsePrice(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return Math.round(raw);
  const s = String(raw).trim();
  const cleaned = s.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const hasComma = cleaned.lastIndexOf(",");
  const hasDot = cleaned.lastIndexOf(".");
  let normalized;
  if (hasComma > hasDot) {
    normalized = cleaned.replace(/\./g, "").split(",")[0];
  } else {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, "");
  }
  const n = parseInt(normalized, 10);
  return Number.isFinite(n) ? n : null;
}

function parsePriceText(text) {
  const variantRegex = /x\s*(\d+)\s*\$\s*([\d.,]+)/gi;
  const variants = [];
  let m;
  while ((m = variantRegex.exec(text)) !== null) {
    const price = parsePrice(m[2]);
    if (price != null) variants.push({ label: `x${m[1]}`, price });
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
  const letters = name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters.length === 0) return true;
  return letters === letters.toUpperCase() && letters.length <= 30;
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
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

async function scrapeJiroPage(url) {
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

async function scrapeUrls(urls) {
  const all = [];
  const errors = [];
  for (const url of urls) {
    try {
      const items = await scrapeJiroPage(url);
      for (const it of items) all.push({ ...it, sourceUrl: url });
    } catch (e) {
      errors.push({ url, error: e.message });
    }
  }
  const byKey = new Map();
  for (const p of all) byKey.set(normalize(p.name), p);
  return { products: Array.from(byKey.values()), errors };
}

function matchVariants(jiro, product) {
  const isSimple = product.type === "simple";
  const existingVariants = Array.isArray(product.variants) ? product.variants : [];

  if (isSimple) {
    if (jiro.variants.length !== 1) {
      return {
        status: "ambiguous",
        reason: `lado TUS es simple pero jiro tiene ${jiro.variants.length} variantes`,
      };
    }
    const newPrice = jiro.variants[0].price;
    if (Number(newPrice) === Number(product.base_price)) return { status: "ok", changes: [] };
    return {
      status: "ok",
      changes: [{ kind: "base_price", from: Number(product.base_price), to: newPrice }],
    };
  }

  if (existingVariants.length === 0) {
    return { status: "ambiguous", reason: "producto tipo options sin variantes cargadas" };
  }

  if (jiro.variants.length === 1 && jiro.variants[0].label == null && existingVariants.length > 1) {
    return {
      status: "ambiguous",
      reason: "jiro trae un solo precio pero el producto tiene múltiples variantes",
    };
  }

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
    if (Number(jv.price) !== Number(ev.price)) {
      changes.push({
        kind: "variant",
        variant_id: ev.id,
        label: ev.label,
        from: Number(ev.price),
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

function candidateSummary(p) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    base_price: Number(p.base_price),
    variants: (p.variants || []).map((v) => ({
      id: v.id,
      label: v.label,
      price: Number(v.price),
    })),
  };
}

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
      const candidates = existingNames.filter((n) => n.includes(key) || key.includes(n));
      if (candidates.length === 1) {
        matched = existingByNorm.get(candidates[0]);
        matchType = "contains";
      } else if (candidates.length > 1) {
        ambiguous.push({
          jiro,
          reason: "nombre ambiguo (varios productos existentes coinciden parcialmente)",
          candidates: candidates.map((c) => candidateSummary(existingByNorm.get(c))),
        });
        continue;
      }
    }

    if (!matched) {
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
          candidates: [candidateSummary(existingByNorm.get(best))],
        });
        continue;
      }
      notFound.push({ jiro });
      continue;
    }

    const variantDiff = matchVariants(jiro, matched);
    if (variantDiff.status === "ok") {
      if (variantDiff.changes.length === 0) continue;
      autoApply.push({
        product_id: matched.id,
        product_name: matched.name,
        type: matched.type,
        match_type: matchType,
        jiro_name: jiro.name,
        changes: variantDiff.changes,
      });
    } else {
      // El nombre matcheó pero las variantes no — ofrecemos el mismo producto
      // como candidato único para que el usuario pueda resolverlo manualmente.
      ambiguous.push({
        jiro,
        product: { id: matched.id, name: matched.name },
        reason: variantDiff.reason,
        candidates: [candidateSummary(matched)],
      });
    }
  }

  return { autoApply, ambiguous, notFound };
}

module.exports = {
  normalize,
  scrapeJiroPage,
  scrapeUrls,
  matchProducts,
  matchVariants,
};
