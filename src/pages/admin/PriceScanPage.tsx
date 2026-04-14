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
  jiro: { name: string; variants: Array<{ label: string | null; price: number }> };
  reason: string;
  product?: { id: number; name: string };
  candidates?: Candidate[];
}

interface NotFoundItem {
  jiro: { name: string; variants: Array<{ label: string | null; price: number }> };
}

interface ScanResult {
  scraped_count: number;
  scrape_errors: Array<{ url: string; error: string }>;
  autoApply: AutoApplyItem[];
  ambiguous: AmbiguousItem[];
  notFound: NotFoundItem[];
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

function parseCsv(text: string): { products: ParsedProduct[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length === 0) return { products: [], errors };

  // Detección de header: si la última celda de la primera línea no parsea como precio,
  // la tratamos como header y la saltamos.
  const firstCells = splitCsvLine(lines[0]);
  const lastIsNumeric = parsePriceCell(firstCells[firstCells.length - 1]) !== null;
  const dataLines = lastIsNumeric ? lines : lines.slice(1);

  const byName = new Map<string, ParsedProduct>();
  dataLines.forEach((line, i) => {
    const cells = splitCsvLine(line);
    let name: string;
    let label: string | null;
    let price: number | null;

    if (cells.length >= 3) {
      name = cells[0];
      label = cells[1] || null;
      price = parsePriceCell(cells[2]);
    } else if (cells.length === 2) {
      name = cells[0];
      label = null;
      price = parsePriceCell(cells[1]);
    } else {
      errors.push(`línea ${i + 1}: se esperaban 2 o 3 columnas`);
      return;
    }

    if (!name) {
      errors.push(`línea ${i + 1}: nombre vacío`);
      return;
    }
    if (price == null) {
      errors.push(`línea ${i + 1}: precio inválido "${cells[cells.length - 1]}"`);
      return;
    }

    if (!byName.has(name)) byName.set(name, { name, variants: [] });
    byName.get(name)!.variants.push({ label, price });
  });

  return { products: Array.from(byName.values()), errors };
}

export default function PriceScanPage() {
  const { apiFetch } = useApi();
  const [mode, setMode] = useState<"urls" | "csv">("urls");
  const [urlsText, setUrlsText] = useState(DEFAULT_URLS);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<ParsedProduct[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
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

  const onCsvText = (text: string) => {
    setCsvText(text);
    if (text.trim()) {
      const { products, errors } = parseCsv(text);
      setCsvPreview(products);
      setCsvErrors(errors);
    } else {
      setCsvPreview([]);
      setCsvErrors([]);
    }
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
    const manualChanges = Object.values(resolved).map((item) => ({
      product_id: item.product_id,
      changes: item.changes.map((c) => ({
        kind: c.kind,
        variant_id: c.variant_id,
        to: c.to,
      })),
    }));
    const changes = [...autoChanges, ...manualChanges];
    if (changes.length === 0) {
      setError("No hay nada seleccionado para aplicar");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const data = await apiFetch<ApplyResult>("/api/catalog/price-apply", {
        method: "POST",
        body: JSON.stringify({ changes }),
      });
      setApplyResult(data);
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
  const selectedCount = selectedAutoCount + resolvedCount;

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
              simples). Dejá la variante vacía si el producto no tiene variantes. Se aceptan
              precios con <code>$</code> y separadores de miles (ej.{" "}
              <code className="text-gray-300">$27.210</code>). Header opcional.
            </div>

            {csvPreview.length > 0 && (
              <div className="mt-3 bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">
                  <strong className="text-white">{csvPreview.length}</strong>{" "}
                  {csvPreview.length === 1 ? "producto parseado" : "productos parseados"}
                </div>
                <div className="text-xs text-gray-500 max-h-32 overflow-y-auto space-y-0.5">
                  {csvPreview.slice(0, 10).map((p, i) => (
                    <div key={i}>
                      · {p.name} —{" "}
                      {p.variants
                        .map((v) => (v.label ? `${v.label}:${v.price}` : `${v.price}`))
                        .join(" / ")}
                    </div>
                  ))}
                  {csvPreview.length > 10 && (
                    <div className="text-gray-600">... y {csvPreview.length - 10} más</div>
                  )}
                </div>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <SummaryBox label="Productos escrapeados" value={result.scraped_count} color="gray" />
            <SummaryBox
              label="Listos para aplicar"
              value={result.autoApply.length}
              color="emerald"
            />
            <SummaryBox label="Ambiguos" value={result.ambiguous.length} color="yellow" />
            <SummaryBox label="No encontrados" value={result.notFound.length} color="red" />
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Not found */}
          {result.notFound.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-white font-bold">
                  No encontrados ({result.notFound.length})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Productos en Jiro que no existen en TUS_PEDIDOS — se ignoran.
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {result.notFound.map((item, i) => (
                  <div key={i} className="px-5 py-2 text-sm text-gray-400">
                    · {item.jiro.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra sticky con el botón de aplicar todo */}
          <div className="sticky bottom-4 bg-gray-900/95 backdrop-blur border border-emerald-700 rounded-xl p-4 flex items-center justify-between shadow-xl">
            <div className="text-sm text-white">
              <strong className="text-emerald-400">{selectedCount}</strong>{" "}
              {selectedCount === 1 ? "cambio listo" : "cambios listos"}
              <span className="text-gray-500 text-xs ml-2">
                ({selectedAutoCount} automáticos + {resolvedCount} manuales)
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
