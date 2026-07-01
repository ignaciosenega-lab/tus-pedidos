import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { formatPrice } from "../../utils/money";

interface Change {
  kind: "base_price" | "variant";
  variant_id?: number;
  label?: string;
  from: number;
  to: number;
}

interface AutoApplyItem {
  product_id: number;
  product_name: string;
  type: "simple" | "options";
  match_type: "exact" | "contains";
  jiro_name: string;
  changes: Change[];
}

interface CandidateVariant {
  id: number;
  label: string;
  price: number;
}
interface Candidate {
  id: number;
  name: string;
  type: "simple" | "options";
  base_price: number;
  variants: CandidateVariant[];
}
interface AmbiguousItem {
  jiro: {
    name: string;
    description?: string | null;
    variants: Array<{ label: string | null; price: number }>;
  };
  reason: string;
  product?: { id: number; name: string };
  candidates?: Candidate[];
}

interface NotFoundItem {
  jiro: {
    name: string;
    description?: string | null;
    variants: Array<{ label: string | null; price: number }>;
  };
}

interface DescriptionChange {
  product_id: number;
  product_name: string;
  jiro_name: string;
  match_type: "exact" | "contains";
  from: string;
  to: string;
}

interface ScanResult {
  scraped_count: number;
  scrape_errors: Array<{ url: string; error: string }>;
  autoApply: AutoApplyItem[];
  ambiguous: AmbiguousItem[];
  notFound: NotFoundItem[];
  descriptionChanges: DescriptionChange[];
  // Productos activos del catálogo que ninguna fila del Excel tocó (quedaron con precio viejo).
  notUpdated: Candidate[];
}

interface CatalogCategory {
  id: number;
  name: string;
}

// Forma cruda que devuelve GET /api/catalog/products (id numérico, precios numéricos).
interface CatalogProductLite {
  id: number;
  name: string;
  type: "simple" | "options";
  base_price: number;
  variants: Array<{ id: number; label: string; price: number }>;
}

// Normaliza nombres para el buscador (minúsculas, sin acentos).
function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

interface NewProductDraft {
  notFoundIdx: number;
  name: string;
  description: string;
  category_id: number | null;
  type: "simple" | "options";
  base_price: number;
  variants: Array<{ label: string; price: number }>;
}

interface ApplyResult {
  batch_id: string;
  ok: number;
  failed: number;
  errors: Array<{ product_id: number; error: string }>;
}

const DEFAULT_URLS = `https://jirosushi.com.ar/woks-salteados/
https://jirosushi.com.ar/lunch/rolls-especiales/`;

const CSV_TEMPLATE = `nombre,variante,precio
Yakimeshi de Lomo,,27210
Raices,x5,10280
Raices,x10,20560
`;

interface ResolvedItem {
  key: string;
  jiro_name: string;
  product_id: number;
  product_name: string;
  changes: Change[];
}

interface ParsedProduct {
  name: string;
  variants: Array<{ label: string | null; price: number }>;
}

function parsePriceCell(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
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
  return Number.isFinite(n) && n > 0 ? n : null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === "," || c === ";" || c === "\t") && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

interface ParseCsvResult {
  products: ParsedProduct[];
  errors: string[];
  skipped: string[]; // filas omitidas por no tener precio (ej. fuera del delivery)
}

// Mapea las columnas a partir de la fila de header por palabras clave. Ignora columnas
// de ID y Categoría (la planilla de Jiro trae "ID producto | Categoria | Productos |
// Precio delivery"). Devuelve null si no reconoce un header → se usa el fallback posicional.
function detectColumns(
  header: string[]
): { nameCol: number; variantCol: number | null; priceCol: number } | null {
  const norm = header.map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  );
  let nameCol = -1;
  let variantCol: number | null = null;
  let priceCol = -1;
  norm.forEach((h, i) => {
    if (/\bid\b/.test(h) || /categor/.test(h)) return; // ignorar ID y Categoría
    if (priceCol === -1 && /(precio|price|importe)/.test(h)) {
      priceCol = i;
      return;
    }
    if (variantCol === null && /(variante|variant|presentacion|tama[nñ]o)/.test(h)) {
      variantCol = i;
      return;
    }
    if (nameCol === -1 && /(producto|nombre|item|articulo|descripcion)/.test(h)) {
      nameCol = i;
    }
  });
  if (nameCol === -1 || priceCol === -1) return null;
  return { nameCol, variantCol, priceCol };
}

function parseCsv(text: string, splitVariant: boolean): ParseCsvResult {
  const errors: string[] = [];
  const skipped: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length === 0) return { products: [], errors, skipped };

  const byName = new Map<string, ParsedProduct>();
  const seen = new Set<string>(); // dedupe defensivo por (nombre|label|precio)

  const pushRow = (rawName: string, rawLabel: string | null, rawPrice: string, lineNo: number) => {
    let name = (rawName || "").trim();
    let label = rawLabel != null ? rawLabel.trim() || null : null;
    if (!name) {
      errors.push(`fila ${lineNo}: nombre vacío`);
      return;
    }
    // Separar el sufijo de cantidad "xN" del nombre → pasa a ser la variante.
    // Ej: "Combinado de Salmón Premium x15" → nombre "Combinado de Salmón Premium", label "x15".
    if (splitVariant && !label) {
      const m = name.match(/^(.*\S)\s+x\s*(\d+)\s*$/i);
      if (m && m[1].trim()) {
        name = m[1].trim();
        label = `x${m[2]}`;
      }
    }
    const price = parsePriceCell(rawPrice);
    if (price == null) {
      // Sin precio → se omite (no es error). Típico de productos fuera del delivery.
      skipped.push(label ? `${name} ${label}` : name);
      return;
    }
    const key = `${name}||${label ?? ""}||${price}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!byName.has(name)) byName.set(name, { name, variants: [] });
    byName.get(name)!.variants.push({ label, price });
  };

  const firstCells = splitCsvLine(lines[0]);
  const cols = detectColumns(firstCells);

  if (cols) {
    // Header con nombres de columna reconocibles → mapeo fijo, ignora ID/Categoría.
    lines.slice(1).forEach((line, i) => {
      const cells = splitCsvLine(line);
      const rawName = cells[cols.nameCol] ?? "";
      const rawLabel = cols.variantCol != null ? cells[cols.variantCol] ?? "" : null;
      const rawPrice = cells[cols.priceCol] ?? "";
      pushRow(rawName, rawLabel, rawPrice, i + 2);
    });
  } else {
    // Fallback posicional retrocompatible: nombre,precio o nombre,variante,precio.
    // Detección de header: si la última celda de la primera línea no parsea como precio,
    // la tratamos como header y la saltamos.
    const lastIsNumeric = parsePriceCell(firstCells[firstCells.length - 1]) !== null;
    const dataLines = lastIsNumeric ? lines : lines.slice(1);
    dataLines.forEach((line, i) => {
      const cells = splitCsvLine(line);
      if (cells.length >= 3) {
        pushRow(cells[0], cells[1] || null, cells[2], i + 1);
      } else if (cells.length === 2) {
        pushRow(cells[0], null, cells[1], i + 1);
      } else {
        errors.push(`línea ${i + 1}: se esperaban 2 o 3 columnas`);
      }
    });
  }

  return { products: Array.from(byName.values()), errors, skipped };
}

export default function PriceScanPage() {
  const { apiFetch } = useApi();
  const [mode, setMode] = useState<"urls" | "csv">("urls");
  const [urlsText, setUrlsText] = useState(DEFAULT_URLS);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<ParsedProduct[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvSkipped, setCsvSkipped] = useState<string[]>([]);
  // Separar el sufijo "xN" del nombre y tratarlo como variante (default ON).
  const [splitVariant, setSplitVariant] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Elecciones de resolución manual de ambiguos. Key = index del ambiguous.
  const [ambiguousChoice, setAmbiguousChoice] = useState<
    Record<number, { product_id: number | null; variant_id: number | null }>
  >({});
  // Resueltos manualmente — se suman al apply.
  const [resolved, setResolved] = useState<Record<number, ResolvedItem>>({});
  const [resolving, setResolving] = useState<Record<number, boolean>>({});
  // Vínculos manuales a productos ya cargados. Key = `nf-{i}-{vi}` o `amb-{i}-{vi}`
  // (permite mapear cada variante de un ítem a un producto distinto).
  const [manualLinks, setManualLinks] = useState<Record<string, ResolvedItem>>({});
  const [linking, setLinking] = useState<Record<string, boolean>>({});
  // Qué paneles de vínculo manual están desplegados. Key = `nf-{i}` o `amb-{i}`.
  const [openLinker, setOpenLinker] = useState<Record<string, boolean>>({});
  // Todos los productos del catálogo — para el buscador del vínculo manual.
  const [allProducts, setAllProducts] = useState<CatalogProductLite[]>([]);
  // Cambios de descripción — checkbox por product_id.
  const [selectedDesc, setSelectedDesc] = useState<Record<number, boolean>>({});
  // Categorías para el modal de "Agregar producto".
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  // Productos nuevos ya creados → notFoundIdx → product_id.
  const [createdNotFound, setCreatedNotFound] = useState<Record<number, number>>({});
  // Borrador del producto a crear (modal).
  const [newProduct, setNewProduct] = useState<NewProductDraft | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);

  const reparseCsv = (text: string, split: boolean) => {
    if (text.trim()) {
      const { products, errors, skipped } = parseCsv(text, split);
      setCsvPreview(products);
      setCsvErrors(errors);
      setCsvSkipped(skipped);
    } else {
      setCsvPreview([]);
      setCsvErrors([]);
      setCsvSkipped([]);
    }
  };

  const onCsvText = (text: string) => {
    setCsvText(text);
    reparseCsv(text, splitVariant);
  };

  const toggleSplitVariant = (value: boolean) => {
    setSplitVariant(value);
    reparseCsv(csvText, value);
  };

  const onCsvFile = async (file: File) => {
    const text = await file.text();
    onCsvText(text);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-precios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    setApplyResult(null);
    setAmbiguousChoice({});
    setResolved({});
    setResolving({});
    setManualLinks({});
    setLinking({});
    setOpenLinker({});
    setSelectedDesc({});
    setCreatedNotFound({});
    // cargar categorías para el modal de alta — sólo una vez por sesión
    if (categories.length === 0) {
      apiFetch<CatalogCategory[]>("/api/catalog/categories")
        .then((cats) => setCategories(cats))
        .catch(() => {/* silently */});
    }
    // cargar todos los productos para el buscador de vínculo manual — una vez por sesión
    if (allProducts.length === 0) {
      apiFetch<CatalogProductLite[]>("/api/catalog/products")
        .then((prods) => setAllProducts(prods))
        .catch(() => {/* silently */});
    }
    try {
      let body: { urls?: string[]; products?: ParsedProduct[] };
      if (mode === "urls") {
        const urls = urlsText
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("#"));
        if (urls.length === 0) {
          setError("Pasá al menos una URL");
          setScanning(false);
          return;
        }
        body = { urls };
      } else {
        if (csvPreview.length === 0) {
          setError("El CSV está vacío o no tiene filas válidas");
          setScanning(false);
          return;
        }
        body = { products: csvPreview };
      }
      const data = await apiFetch<ScanResult>("/api/catalog/price-scan", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(data);
      // Seleccionar todo por defecto
      const initial: Record<number, boolean> = {};
      for (const item of data.autoApply) initial[item.product_id] = true;
      setSelected(initial);
      const initialDesc: Record<number, boolean> = {};
      for (const item of data.descriptionChanges || []) initialDesc[item.product_id] = true;
      setSelectedDesc(initialDesc);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const resolveAmbiguous = async (idx: number) => {
    if (!result) return;
    const item = result.ambiguous[idx];
    const choice = ambiguousChoice[idx];
    if (!choice || !choice.product_id) {
      setError("Elegí un producto destino antes de resolver");
      return;
    }
    setResolving((r) => ({ ...r, [idx]: true }));
    setError(null);
    try {
      const data = await apiFetch<{
        status: "ok" | "ambiguous";
        changes?: Change[];
        reason?: string;
      }>("/api/catalog/price-match", {
        method: "POST",
        body: JSON.stringify({
          product_id: choice.product_id,
          jiro_variants: item.jiro.variants,
          variant_id: choice.variant_id || undefined,
        }),
      });

      if (data.status !== "ok") {
        setError(`No se pudo resolver: ${data.reason}`);
        return;
      }
      if (!data.changes || data.changes.length === 0) {
        setError("Los precios ya coinciden — no hay cambios que aplicar");
        return;
      }

      const candidate = item.candidates?.find((c) => c.id === choice.product_id);
      setResolved((r) => ({
        ...r,
        [idx]: {
          key: `manual-${idx}`,
          jiro_name: item.jiro.name,
          product_id: choice.product_id!,
          product_name: candidate?.name || `#${choice.product_id}`,
          changes: data.changes!,
        },
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResolving((r) => ({ ...r, [idx]: false }));
    }
  };

  const clearResolved = (idx: number) => {
    setResolved((r) => {
      const n = { ...r };
      delete n[idx];
      return n;
    });
  };

  // Vincula una variante de un ítem (no encontrado o ambiguo) a un producto ya cargado.
  const linkVariant = async (
    linkKey: string,
    jiroName: string,
    jiroVariant: { label: string | null; price: number },
    target: CatalogProductLite,
    variantId: number | null
  ) => {
    setLinking((l) => ({ ...l, [linkKey]: true }));
    setError(null);
    try {
      const data = await apiFetch<{ status: "ok" | "ambiguous"; changes?: Change[]; reason?: string }>(
        "/api/catalog/price-match",
        {
          method: "POST",
          body: JSON.stringify({
            product_id: target.id,
            jiro_variants: [{ label: jiroVariant.label, price: jiroVariant.price }],
            variant_id: variantId || undefined,
          }),
        }
      );
      if (data.status !== "ok") {
        setError(`No se pudo vincular: ${data.reason}`);
        return;
      }
      if (!data.changes || data.changes.length === 0) {
        setError(`"${target.name}" ya tiene ese precio — no hay cambios`);
        return;
      }
      setManualLinks((m) => ({
        ...m,
        [linkKey]: {
          key: linkKey,
          jiro_name: jiroVariant.label ? `${jiroName} ${jiroVariant.label}` : jiroName,
          product_id: target.id,
          product_name: target.name,
          changes: data.changes!,
        },
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLinking((l) => ({ ...l, [linkKey]: false }));
    }
  };

  const unlink = (linkKey: string) => {
    setManualLinks((m) => {
      const n = { ...m };
      delete n[linkKey];
      return n;
    });
  };

  const runApply = async () => {
    if (!result) return;
    const autoChanges = result.autoApply
      .filter((item) => selected[item.product_id])
      .map((item) => ({
        product_id: item.product_id,
        changes: item.changes.map((c) => ({
          kind: c.kind,
          variant_id: c.variant_id,
          to: c.to,
        })),
      }));
    // Resueltos de ambiguos + vínculos manuales a productos ya cargados.
    const manualChanges = [...Object.values(resolved), ...Object.values(manualLinks)].map(
      (item) => ({
        product_id: item.product_id,
        changes: item.changes.map((c) => ({
          kind: c.kind,
          variant_id: c.variant_id,
          to: c.to,
        })),
      })
    );
    // Agrupar por product_id para no mandar entradas duplicadas del mismo producto
    // (ej. dos variantes de un mismo producto vinculadas por separado).
    const byProduct = new Map<number, Array<{ kind: string; variant_id?: number; to: number }>>();
    for (const entry of [...autoChanges, ...manualChanges]) {
      const acc = byProduct.get(entry.product_id) || [];
      acc.push(...entry.changes);
      byProduct.set(entry.product_id, acc);
    }
    const priceChanges = Array.from(byProduct.entries()).map(([product_id, changes]) => ({
      product_id,
      changes,
    }));
    const descChanges = (result.descriptionChanges || [])
      .filter((d) => selectedDesc[d.product_id])
      .map((d) => ({ product_id: d.product_id, to: d.to }));

    if (priceChanges.length === 0 && descChanges.length === 0) {
      setError("No hay nada seleccionado para aplicar");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      let priceResult: ApplyResult | null = null;
      if (priceChanges.length > 0) {
        priceResult = await apiFetch<ApplyResult>("/api/catalog/price-apply", {
          method: "POST",
          body: JSON.stringify({ changes: priceChanges }),
        });
      }
      type DescApplyResult = {
        ok: number;
        failed: number;
        errors: Array<{ product_id: number; error: string }>;
      };
      let descResult: DescApplyResult | null = null;
      if (descChanges.length > 0) {
        descResult = await apiFetch<DescApplyResult>("/api/catalog/description-apply", {
          method: "POST",
          body: JSON.stringify({ changes: descChanges }),
        });
      }
      // Mergeamos ambos resultados en el banner de éxito.
      const merged: ApplyResult = {
        batch_id: priceResult?.batch_id || "—",
        ok: (priceResult?.ok || 0) + (descResult?.ok || 0),
        failed: (priceResult?.failed || 0) + (descResult?.failed || 0),
        errors: [...(priceResult?.errors || []), ...(descResult?.errors || [])],
      };
      setApplyResult(merged);
      setConfirmOpen(false);
    } catch (e) {
      setError((e as Error).message);
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  };

  const selectedAutoCount = result
    ? result.autoApply.filter((i) => selected[i.product_id]).length
    : 0;
  const resolvedCount = Object.keys(resolved).length;
  const manualLinkCount = Object.keys(manualLinks).length;
  const manualCount = resolvedCount + manualLinkCount;
  const selectedDescCount = result
    ? (result.descriptionChanges || []).filter((d) => selectedDesc[d.product_id]).length
    : 0;
  const selectedCount = selectedAutoCount + manualCount + selectedDescCount;

  const openCreateModal = (idx: number, item: NotFoundItem) => {
    const variants = item.jiro.variants || [];
    const isSimple = variants.length === 1 && !variants[0].label;
    setNewProduct({
      notFoundIdx: idx,
      name: item.jiro.name,
      description: item.jiro.description || "",
      category_id: categories[0]?.id ?? null,
      type: isSimple ? "simple" : "options",
      base_price: isSimple ? variants[0].price : 0,
      variants: isSimple
        ? []
        : variants.map((v) => ({ label: v.label || "", price: v.price })),
    });
  };

  const updateNewProductVariant = (idx: number, field: "label" | "price", value: string | number) => {
    setNewProduct((p) => {
      if (!p) return p;
      const variants = p.variants.map((v, i) =>
        i === idx ? { ...v, [field]: field === "price" ? Number(value) : String(value) } : v
      );
      return { ...p, variants };
    });
  };

  const submitNewProduct = async () => {
    if (!newProduct) return;
    if (!newProduct.name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!newProduct.category_id) {
      setError("Elegí una categoría");
      return;
    }
    setCreatingProduct(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: newProduct.name.trim(),
        description: newProduct.description.trim(),
        category_id: newProduct.category_id,
        type: newProduct.type,
        base_price: newProduct.type === "simple" ? newProduct.base_price : 0,
        is_active: true,
      };
      if (newProduct.type === "options") {
        payload.variants = newProduct.variants
          .filter((v) => Number.isFinite(v.price) && v.price > 0)
          .map((v, i) => ({ label: v.label.trim(), price: v.price, sort_order: i }));
      }
      const created = await apiFetch<{ id: number }>("/api/catalog/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreatedNotFound((m) => ({ ...m, [newProduct.notFoundIdx]: created.id }));
      setNewProduct(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreatingProduct(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Actualizar precios desde Jiro</h2>
        <p className="text-gray-400">
          Pegá las URLs de categorías de jirosushi.com.ar, escaneá y aplicá los cambios en lote.
          Los cambios quedan agrupados y se pueden revertir desde{" "}
          <Link to="/admin/auditoria" className="text-emerald-400 hover:underline">
            Historial precios
          </Link>
          .
        </p>
      </div>

      {/* Tabs URLs / CSV */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl mb-4 overflow-hidden">
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setMode("urls")}
            className={`flex-1 px-5 py-3 text-sm font-semibold ${
              mode === "urls"
                ? "bg-gray-800 text-emerald-400 border-b-2 border-emerald-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Desde URLs de jirosushi.com.ar
          </button>
          <button
            onClick={() => setMode("csv")}
            className={`flex-1 px-5 py-3 text-sm font-semibold ${
              mode === "csv"
                ? "bg-gray-800 text-emerald-400 border-b-2 border-emerald-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Desde archivo CSV
          </button>
        </div>

        {mode === "urls" ? (
          <div className="p-5">
            <label className="block text-gray-400 text-xs font-semibold mb-2">
              URLs de categorías (una por línea)
            </label>
            <textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
              placeholder="https://jirosushi.com.ar/..."
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-500">
                Ejemplos: /woks-salteados/, /lunch/rolls-especiales/, /lunch/rolls-clasicos/
              </div>
              <button
                onClick={runScan}
                disabled={scanning || applying}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {scanning ? "Escaneando..." : "Escanear"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-xs font-semibold">
                Subí un archivo CSV o pegá el contenido abajo
              </label>
              <button
                onClick={downloadTemplate}
                className="text-xs text-emerald-400 hover:underline"
              >
                ↓ Descargar plantilla
              </button>
            </div>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsvFile(f);
              }}
              className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-emerald-400 hover:file:bg-gray-700 mb-3"
            />

            <textarea
              value={csvText}
              onChange={(e) => onCsvText(e.target.value)}
              rows={8}
              placeholder={`nombre,variante,precio\nYakimeshi de Lomo,,27210\nRaices,x5,10280\nRaices,x10,20560`}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
            />

            <div className="text-xs text-gray-500 mt-2 leading-relaxed">
              Formato: <code className="text-gray-300">nombre,variante,precio</code> (3 columnas)
              o <code className="text-gray-300">nombre,precio</code> (2 columnas para productos
              simples). También acepta la planilla de Jiro con columnas{" "}
              <code className="text-gray-300">ID, Categoría, Productos, Precio</code> — se ignoran
              ID y Categoría. Se aceptan precios con <code>$</code> y separadores de miles (ej.{" "}
              <code className="text-gray-300">$27.210</code>). Las filas sin precio se omiten.
            </div>

            <label className="flex items-center gap-2 mt-3 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={splitVariant}
                onChange={(e) => toggleSplitVariant(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              Separar la cantidad <code className="text-gray-300">xN</code> del nombre como variante
              (ej. <span className="text-gray-300">"Combinado x15"</span> → producto{" "}
              <span className="text-gray-300">"Combinado"</span> variante{" "}
              <span className="text-gray-300">x15</span>)
            </label>

            {csvPreview.length > 0 &&
              (() => {
                const withVariants = csvPreview.filter(
                  (p) => p.variants.length > 1 || p.variants.some((v) => v.label)
                ).length;
                const simples = csvPreview.length - withVariants;
                return (
                  <div className="mt-3 bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-300 mb-2">
                      <strong className="text-white">{csvPreview.length}</strong> productos ·{" "}
                      <span className="text-emerald-400">{withVariants}</span> con variantes ·{" "}
                      <span className="text-gray-400">{simples}</span> simples
                      {csvSkipped.length > 0 && (
                        <>
                          {" "}
                          · <span className="text-gray-500">{csvSkipped.length} sin precio</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs max-h-40 overflow-y-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-gray-500 text-left">
                            <th className="font-medium pb-1">Producto</th>
                            <th className="font-medium pb-1">Variante</th>
                            <th className="font-medium pb-1 text-right">Precio</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-400">
                          {csvPreview.slice(0, 15).flatMap((p) =>
                            p.variants.map((v, vi) => (
                              <tr key={`${p.name}-${vi}`} className="border-t border-gray-800/60">
                                <td className="py-0.5 pr-2 text-gray-300">
                                  {vi === 0 ? p.name : ""}
                                </td>
                                <td className="py-0.5 pr-2">{v.label || "—"}</td>
                                <td className="py-0.5 text-right text-emerald-400">
                                  {formatPrice(v.price)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      {csvPreview.length > 15 && (
                        <div className="text-gray-600 pt-1">
                          ... y {csvPreview.length - 15} productos más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            {csvSkipped.length > 0 && (
              <div className="mt-3 bg-gray-800/40 border border-gray-700 rounded-lg p-3 text-gray-400 text-xs">
                <strong className="text-gray-300">
                  {csvSkipped.length} {csvSkipped.length === 1 ? "fila omitida" : "filas omitidas"} sin
                  precio:
                </strong>{" "}
                {csvSkipped.slice(0, 8).join(", ")}
                {csvSkipped.length > 8 && ` … y ${csvSkipped.length - 8} más`}
              </div>
            )}

            {csvErrors.length > 0 && (
              <div className="mt-3 bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 text-yellow-300 text-xs">
                <strong>Filas ignoradas:</strong>
                <ul className="mt-1 space-y-0.5">
                  {csvErrors.slice(0, 10).map((e, i) => (
                    <li key={i}>· {e}</li>
                  ))}
                  {csvErrors.length > 10 && <li>... y {csvErrors.length - 10} más</li>}
                </ul>
              </div>
            )}

            <div className="flex justify-end mt-3">
              <button
                onClick={runScan}
                disabled={scanning || applying || csvPreview.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {scanning ? "Escaneando..." : `Escanear ${csvPreview.length} productos`}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {applyResult && (
        <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4 mb-4">
          <div className="text-emerald-300 font-semibold text-sm">
            ✓ Lote aplicado: {applyResult.ok}{" "}
            {applyResult.ok === 1 ? "producto actualizado" : "productos actualizados"}
            {applyResult.failed > 0 && ` — ${applyResult.failed} fallaron`}
          </div>
          <div className="text-xs text-gray-400 mt-1">Batch: {applyResult.batch_id}</div>
          {applyResult.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-300 space-y-0.5">
              {applyResult.errors.map((e, i) => (
                <li key={i}>
                  #{e.product_id}: {e.error}
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/admin/auditoria"
            className="inline-block mt-2 text-xs text-emerald-400 hover:underline"
          >
            Ver en historial →
          </Link>
        </div>
      )}

      {result && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            <SummaryBox label="Productos escrapeados" value={result.scraped_count} color="gray" />
            <SummaryBox
              label="Listos para aplicar"
              value={result.autoApply.length}
              color="emerald"
            />
            <SummaryBox
              label="Cambios de descripción"
              value={(result.descriptionChanges || []).length}
              color="emerald"
            />
            <SummaryBox label="Ambiguos" value={result.ambiguous.length} color="yellow" />
            <SummaryBox label="Productos nuevos" value={result.notFound.length} color="red" />
            <SummaryBox
              label="Sin actualizar"
              value={(result.notUpdated || []).length}
              color="gray"
            />
          </div>

          {result.scrape_errors.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mb-4 text-yellow-300 text-xs">
              <strong>Errores al scrapear:</strong>
              <ul className="mt-1 space-y-0.5">
                {result.scrape_errors.map((e, i) => (
                  <li key={i}>
                    {e.url}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Auto-apply */}
          {result.autoApply.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-white font-bold">
                  Cambios a aplicar ({selectedAutoCount}/{result.autoApply.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const all: Record<number, boolean> = {};
                      for (const i of result.autoApply) all[i.product_id] = true;
                      setSelected(all);
                    }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Seleccionar todo
                  </button>
                  <button
                    onClick={() => setSelected({})}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-800">
                {result.autoApply.map((item) => (
                  <label
                    key={item.product_id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[item.product_id]}
                      onChange={(e) =>
                        setSelected((s) => ({ ...s, [item.product_id]: e.target.checked }))
                      }
                      className="mt-1 w-4 h-4 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">
                        {item.product_name}
                        {item.match_type === "contains" && (
                          <span className="ml-2 text-xs text-yellow-500">(match parcial)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 space-y-0.5 mt-0.5">
                        {item.changes.map((c, i) => (
                          <div key={i}>
                            {c.kind === "base_price" ? "precio base" : `variante ${c.label || ""}`}
                            {": "}
                            <span className="text-gray-500 line-through">
                              {formatPrice(c.from)}
                            </span>{" "}
                            →{" "}
                            <span className="text-emerald-400">{formatPrice(c.to)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Cambios de descripción */}
          {(result.descriptionChanges || []).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold">
                    Cambios de descripción ({selectedDescCount}/{result.descriptionChanges.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Jiro tiene una descripción distinta a la actual — marcá cuáles querés actualizar.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const all: Record<number, boolean> = {};
                      for (const d of result.descriptionChanges) all[d.product_id] = true;
                      setSelectedDesc(all);
                    }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Seleccionar todo
                  </button>
                  <button
                    onClick={() => setSelectedDesc({})}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-800">
                {result.descriptionChanges.map((d) => (
                  <label
                    key={d.product_id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedDesc[d.product_id]}
                      onChange={(e) =>
                        setSelectedDesc((s) => ({ ...s, [d.product_id]: e.target.checked }))
                      }
                      className="mt-1 w-4 h-4 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">
                        {d.product_name}
                        {d.match_type === "contains" && (
                          <span className="ml-2 text-xs text-yellow-500">(match parcial)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {d.from ? (
                          <span className="line-through">{d.from}</span>
                        ) : (
                          <span className="italic text-gray-600">(sin descripción)</span>
                        )}
                      </div>
                      <div className="text-xs text-emerald-400 mt-0.5">→ {d.to}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Ambiguos */}
          {result.ambiguous.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-white font-bold">
                  Ambiguos ({result.ambiguous.length}) — {resolvedCount} resueltos
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Elegí manualmente a qué producto aplicar cada uno. Los resueltos se suman al
                  lote de aplicar.
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {result.ambiguous.map((item, i) => {
                  const choice = ambiguousChoice[i] || { product_id: null, variant_id: null };
                  const resolvedItem = resolved[i];
                  const candidates = item.candidates || [];
                  const chosen = candidates.find((c) => c.id === choice.product_id);
                  const jiroPriceText = item.jiro.variants
                    .map((v) => (v.label ? `${v.label} $${v.price}` : `$${v.price}`))
                    .join(" · ");

                  return (
                    <div key={i} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">{item.jiro.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{jiroPriceText}</div>
                          <div className="text-xs text-yellow-400 mt-0.5">{item.reason}</div>
                        </div>
                      </div>

                      {resolvedItem ? (
                        <div className="mt-2 bg-emerald-900/20 border border-emerald-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-emerald-300 text-sm font-medium">
                              ✓ Resuelto → {resolvedItem.product_name}
                            </div>
                            <button
                              onClick={() => clearResolved(i)}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              Cambiar
                            </button>
                          </div>
                          <div className="text-xs text-gray-400 space-y-0.5">
                            {resolvedItem.changes.map((c, j) => (
                              <div key={j}>
                                {c.kind === "base_price"
                                  ? "precio base"
                                  : `variante ${c.label || ""}`}
                                {": "}
                                <span className="text-gray-500 line-through">
                                  {formatPrice(c.from)}
                                </span>{" "}
                                →{" "}
                                <span className="text-emerald-400">{formatPrice(c.to)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={choice.product_id || ""}
                            onChange={(e) =>
                              setAmbiguousChoice((a) => ({
                                ...a,
                                [i]: {
                                  product_id: e.target.value ? Number(e.target.value) : null,
                                  variant_id: null,
                                },
                              }))
                            }
                            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 max-w-xs"
                          >
                            <option value="">— elegí producto destino —</option>
                            {candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                                {c.type === "options"
                                  ? ` (${c.variants.length} variantes)`
                                  : " (simple)"}
                              </option>
                            ))}
                          </select>

                          {/* Si jiro tiene 1 precio y el destino tiene variantes → permitir
                              elegir variante puntual (sino se aplica a todas). */}
                          {chosen &&
                            chosen.type === "options" &&
                            item.jiro.variants.length === 1 && (
                              <select
                                value={choice.variant_id || ""}
                                onChange={(e) =>
                                  setAmbiguousChoice((a) => ({
                                    ...a,
                                    [i]: {
                                      ...a[i],
                                      variant_id: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    },
                                  }))
                                }
                                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                              >
                                <option value="">aplicar a TODAS las variantes</option>
                                {chosen.variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    solo {v.label} ({formatPrice(v.price)})
                                  </option>
                                ))}
                              </select>
                            )}

                          <button
                            onClick={() => resolveAmbiguous(i)}
                            disabled={!choice.product_id || !!resolving[i]}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                          >
                            {resolving[i] ? "..." : "Usar este"}
                          </button>
                        </div>
                      )}

                      {/* Para ítems con varias variantes que van a varios productos distintos */}
                      {!resolvedItem && item.jiro.variants.length > 1 && (
                        <div className="mt-2">
                          <button
                            onClick={() =>
                              setOpenLinker((o) => ({ ...o, [`amb-${i}`]: !o[`amb-${i}`] }))
                            }
                            className="text-xs text-emerald-300 hover:underline"
                          >
                            {openLinker[`amb-${i}`]
                              ? "Cerrar"
                              : "¿Va a varios productos? Vincular cada variante"}
                          </button>
                          {openLinker[`amb-${i}`] && (
                            <ManualLinkPanel
                              jiro={item.jiro}
                              keyPrefix={`amb-${i}`}
                              allProducts={allProducts}
                              manualLinks={manualLinks}
                              linking={linking}
                              onLink={linkVariant}
                              onUnlink={unlink}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Not found — productos nuevos en Jiro que no existen en TUS_PEDIDOS */}
          {result.notFound.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-white font-bold">
                  Productos nuevos ({result.notFound.length})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  No matchearon con ningún producto. Si ya lo tenés cargado (con otro nombre),
                  usá <span className="text-emerald-300">Vincular a existente</span> para
                  actualizar su precio. Si es realmente nuevo, <span className="text-emerald-300">Agregar nuevo</span>.
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {result.notFound.map((item, i) => {
                  const createdId = createdNotFound[i];
                  const prefix = `nf-${i}`;
                  const isOpen = !!openLinker[prefix];
                  const linkedCount = item.jiro.variants.filter(
                    (_, vi) => manualLinks[`${prefix}-${vi}`]
                  ).length;
                  const variantText = item.jiro.variants
                    .map((v) => (v.label ? `${v.label} ${formatPrice(v.price)}` : formatPrice(v.price)))
                    .join(" · ");
                  return (
                    <div key={i} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">{item.jiro.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{variantText}</div>
                          {item.jiro.description && (
                            <div className="text-xs text-gray-400 italic mt-1">{item.jiro.description}</div>
                          )}
                          {linkedCount > 0 && (
                            <div className="text-xs text-emerald-400 mt-1">
                              ✓ {linkedCount}/{item.jiro.variants.length} vinculado
                              {linkedCount > 1 ? "s" : ""} a productos existentes
                            </div>
                          )}
                        </div>
                        {createdId ? (
                          <span className="text-emerald-400 text-xs font-semibold whitespace-nowrap">
                            ✓ Agregado
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2 items-end">
                            <button
                              onClick={() =>
                                setOpenLinker((o) => ({ ...o, [prefix]: !o[prefix] }))
                              }
                              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-300 text-xs font-semibold rounded-lg whitespace-nowrap border border-gray-700"
                            >
                              {isOpen ? "Cerrar" : "Vincular a existente"}
                            </button>
                            {linkedCount === 0 && (
                              <button
                                onClick={() => openCreateModal(i, item)}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                              >
                                + Agregar nuevo
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {isOpen && !createdId && (
                        <ManualLinkPanel
                          jiro={item.jiro}
                          keyPrefix={prefix}
                          allProducts={allProducts}
                          manualLinks={manualLinks}
                          linking={linking}
                          onLink={linkVariant}
                          onUnlink={unlink}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sin actualizar — productos del catálogo que ninguna fila del Excel tocó */}
          {(result.notUpdated || []).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-white font-bold">
                    Ya cargados sin actualizar ({result.notUpdated.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Estos productos están activos en el catálogo pero ninguna fila del Excel los
                    tocó — quedaron con el precio anterior. Revisalos o cargalos a mano desde{" "}
                    <Link to="/admin/catalogo" className="text-emerald-400 hover:underline">
                      Catálogo
                    </Link>
                    .
                  </p>
                </div>
                <button
                  onClick={() => {
                    const list = result.notUpdated.map((p) => p.name).join("\n");
                    navigator.clipboard?.writeText(list).catch(() => {/* noop */});
                  }}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg whitespace-nowrap"
                >
                  Copiar lista
                </button>
              </div>
              <div className="divide-y divide-gray-800">
                {result.notUpdated.map((p) => {
                  const priceText =
                    p.type === "simple" || p.variants.length === 0
                      ? formatPrice(p.base_price)
                      : p.variants
                          .map((v) => `${v.label || ""} ${formatPrice(v.price)}`.trim())
                          .join(" · ");
                  return (
                    <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="text-white text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                        {priceText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Barra sticky con el botón de aplicar todo */}
          <div className="sticky bottom-4 bg-gray-900/95 backdrop-blur border border-emerald-700 rounded-xl p-4 flex items-center justify-between shadow-xl">
            <div className="text-sm text-white">
              <strong className="text-emerald-400">{selectedCount}</strong>{" "}
              {selectedCount === 1 ? "cambio listo" : "cambios listos"}
              <span className="text-gray-500 text-xs ml-2">
                ({selectedAutoCount} automáticos + {manualCount} manuales)
              </span>
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={selectedCount === 0 || applying}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              Aplicar {selectedCount} {selectedCount === 1 ? "cambio" : "cambios"}
            </button>
          </div>
        </>
      )}

      {/* Confirm modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !applying && setConfirmOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold text-lg">Aplicar cambios de precios</h3>
            </div>
            <div className="p-5">
              <p className="text-gray-300 text-sm">
                Vas a actualizar <strong>{selectedCount}</strong> productos. Los cambios quedan
                registrados en el historial y podés revertir todo el lote después si algo sale
                mal. ¿Continuás?
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button
                disabled={applying}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={applying}
                onClick={runApply}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {applying ? "Aplicando..." : "Aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: agregar producto nuevo desde Jiro */}
      {newProduct && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !creatingProduct && setNewProduct(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold text-lg">Agregar producto nuevo</h3>
              <p className="text-xs text-gray-500 mt-0.5">Datos pre-cargados desde Jiro — revisalos y guardá.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1">Nombre</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1">Categoría</label>
                <select
                  value={newProduct.category_id ?? ""}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      category_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">— elegí categoría —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1">Descripción</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold mb-1">Tipo</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="radio"
                      checked={newProduct.type === "simple"}
                      onChange={() => setNewProduct({ ...newProduct, type: "simple" })}
                    />
                    Simple (precio único)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="radio"
                      checked={newProduct.type === "options"}
                      onChange={() => setNewProduct({ ...newProduct, type: "options" })}
                    />
                    Con variantes
                  </label>
                </div>
              </div>

              {newProduct.type === "simple" ? (
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-1">Precio</label>
                  <input
                    type="number"
                    value={newProduct.base_price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, base_price: Number(e.target.value) })
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-gray-400 text-xs font-semibold mb-2">Variantes</label>
                  <div className="space-y-2">
                    {newProduct.variants.map((v, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Etiqueta (ej: x5)"
                          value={v.label}
                          onChange={(e) => updateNewProductVariant(i, "label", e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <input
                          type="number"
                          placeholder="Precio"
                          value={v.price}
                          onChange={(e) => updateNewProductVariant(i, "price", e.target.value)}
                          className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button
                disabled={creatingProduct}
                onClick={() => setNewProduct(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={creatingProduct}
                onClick={submitNewProduct}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {creatingProduct ? "Guardando..." : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Una fila del panel de vínculo manual: busca un producto existente y lo vincula
// a una variante (o al precio único) de un ítem del Excel.
function VariantLinkRow({
  linkKey,
  jiroName,
  variant,
  allProducts,
  linked,
  busy,
  onLink,
  onUnlink,
}: {
  linkKey: string;
  jiroName: string;
  variant: { label: string | null; price: number };
  allProducts: CatalogProductLite[];
  linked?: ResolvedItem;
  busy?: boolean;
  onLink: (
    linkKey: string,
    jiroName: string,
    variant: { label: string | null; price: number },
    target: CatalogProductLite,
    variantId: number | null
  ) => void;
  onUnlink: (linkKey: string) => void;
}) {
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);

  const label = variant.label || "precio";

  if (linked) {
    return (
      <div className="flex items-center justify-between gap-2 bg-emerald-900/20 border border-emerald-800 rounded-lg px-3 py-2">
        <div className="text-xs text-emerald-300">
          <span className="text-gray-400">{label} {formatPrice(variant.price)}</span> → ✓{" "}
          {linked.product_name}
        </div>
        <button
          onClick={() => onUnlink(linkKey)}
          className="text-xs text-gray-400 hover:text-white"
        >
          deshacer
        </button>
      </div>
    );
  }

  const nq = normalizeName(q);
  const matches =
    nq.length >= 2
      ? allProducts.filter((p) => normalizeName(p.name).includes(nq)).slice(0, 12)
      : [];
  const chosen = allProducts.find((p) => p.id === productId) || null;
  const needsVariant = !!chosen && chosen.type === "options" && chosen.variants.length > 0;

  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 space-y-2">
      <div className="text-xs text-gray-300">
        {label} <span className="text-emerald-400">{formatPrice(variant.price)}</span>
      </div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setProductId(null);
          setVariantId(null);
        }}
        placeholder="Buscar producto ya cargado…"
        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      />
      {nq.length >= 2 && (
        <select
          value={productId ?? ""}
          onChange={(e) => {
            setProductId(Number(e.target.value) || null);
            setVariantId(null);
          }}
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
        >
          <option value="">
            {matches.length ? "— elegí producto —" : "sin coincidencias"}
          </option>
          {matches.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ·{" "}
              {p.type === "simple" ? formatPrice(p.base_price) : `${p.variants.length} var`}
            </option>
          ))}
        </select>
      )}
      {needsVariant && (
        <select
          value={variantId ?? ""}
          onChange={(e) => setVariantId(Number(e.target.value) || null)}
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
        >
          <option value="">— variante destino —</option>
          {chosen!.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} {formatPrice(v.price)}
            </option>
          ))}
        </select>
      )}
      <button
        disabled={!chosen || busy || (needsVariant && !variantId)}
        onClick={() => chosen && onLink(linkKey, jiroName, variant, chosen, variantId)}
        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded disabled:opacity-40"
      >
        {busy ? "Vinculando…" : "Vincular"}
      </button>
    </div>
  );
}

// Panel de vínculo manual: una fila por variante del ítem.
function ManualLinkPanel({
  jiro,
  keyPrefix,
  allProducts,
  manualLinks,
  linking,
  onLink,
  onUnlink,
}: {
  jiro: { name: string; variants: Array<{ label: string | null; price: number }> };
  keyPrefix: string;
  allProducts: CatalogProductLite[];
  manualLinks: Record<string, ResolvedItem>;
  linking: Record<string, boolean>;
  onLink: (
    linkKey: string,
    jiroName: string,
    variant: { label: string | null; price: number },
    target: CatalogProductLite,
    variantId: number | null
  ) => void;
  onUnlink: (linkKey: string) => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <div className="text-xs text-gray-500">
        Vinculá cada precio a un producto ya cargado del catálogo:
      </div>
      {jiro.variants.map((v, vi) => {
        const linkKey = `${keyPrefix}-${vi}`;
        return (
          <VariantLinkRow
            key={linkKey}
            linkKey={linkKey}
            jiroName={jiro.name}
            variant={v}
            allProducts={allProducts}
            linked={manualLinks[linkKey]}
            busy={linking[linkKey]}
            onLink={onLink}
            onUnlink={onUnlink}
          />
        );
      })}
    </div>
  );
}

function SummaryBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "gray" | "emerald" | "yellow" | "red";
}) {
  const colors = {
    gray: "text-gray-300",
    emerald: "text-emerald-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</div>
    </div>
  );
}
