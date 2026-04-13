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

interface AmbiguousItem {
  jiro: { name: string; variants: Array<{ label: string | null; price: number }> };
  reason: string;
  product?: { id: number; name: string };
  candidates?: string[];
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

export default function PriceScanPage() {
  const { apiFetch } = useApi();
  const [urlsText, setUrlsText] = useState(DEFAULT_URLS);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    setApplyResult(null);
    try {
      const urls = urlsText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#"));
      if (urls.length === 0) {
        setError("Pasá al menos una URL");
        setScanning(false);
        return;
      }
      const data = await apiFetch<ScanResult>("/api/catalog/price-scan", {
        method: "POST",
        body: JSON.stringify({ urls }),
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

  const runApply = async () => {
    if (!result) return;
    const changes = result.autoApply
      .filter((item) => selected[item.product_id])
      .map((item) => ({
        product_id: item.product_id,
        changes: item.changes.map((c) => ({
          kind: c.kind,
          variant_id: c.variant_id,
          to: c.to,
        })),
      }));
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

  const selectedCount = result
    ? result.autoApply.filter((i) => selected[i.product_id]).length
    : 0;

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

      {/* URLs input */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
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
                  Cambios a aplicar ({selectedCount}/{result.autoApply.length})
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
              <div className="px-5 py-4 border-t border-gray-800 flex justify-end">
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={selectedCount === 0 || applying}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  Aplicar {selectedCount} {selectedCount === 1 ? "cambio" : "cambios"}
                </button>
              </div>
            </div>
          )}

          {/* Ambiguos */}
          {result.ambiguous.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-white font-bold">
                  Ambiguos ({result.ambiguous.length})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Requieren revisión manual — no se aplican automáticamente.
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {result.ambiguous.map((item, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="text-white text-sm font-medium">{item.jiro.name}</div>
                    <div className="text-xs text-yellow-400 mt-0.5">{item.reason}</div>
                    {item.candidates && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        candidatos: {item.candidates.join(" · ")}
                      </div>
                    )}
                    {item.product && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        matcheó con: {item.product.name}
                      </div>
                    )}
                  </div>
                ))}
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
