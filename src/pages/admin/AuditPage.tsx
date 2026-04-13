import { useCallback, useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { formatPrice } from "../../utils/money";

interface PriceDiff {
  kind: "base_price" | "variant_price";
  variant_id?: number;
  label?: string;
  from: number;
  to: number;
}

interface BatchChange {
  audit_id: number;
  product_id: number;
  product_name: string;
  diffs: PriceDiff[];
  reverted_at: string | null;
}

interface Batch {
  batch_id: string;
  source: string;
  created_at: string;
  user_display: string;
  changes: BatchChange[];
  reverted: boolean;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: string): string {
  if (source === "jiro-script") return "Script Jiro";
  if (source === "manual") return "Edición manual";
  return source;
}

export default function AuditPage() {
  const { apiFetch } = useApi();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Batch[]>("/api/catalog/price-history?limit=200");
      setBatches(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const revertBatch = async (batchId: string) => {
    setReverting(true);
    try {
      await apiFetch("/api/catalog/price-history/revert", {
        method: "POST",
        body: JSON.stringify({ batch_id: batchId }),
      });
      setConfirming(null);
      await load();
    } catch (e) {
      alert("Error al revertir: " + (e as Error).message);
    } finally {
      setReverting(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Historial de precios</h2>
          <p className="text-gray-400">
            Cambios de precios agrupados por lote. Podés revertir un lote completo.
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-white"
        >
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-400">
          Cargando...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && batches.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
          Todavía no se registraron cambios de precios.
        </div>
      )}

      <div className="space-y-3">
        {batches.map((batch) => {
          const isOpen = !!expanded[batch.batch_id];
          const totalDiffs = batch.changes.reduce((n, c) => n + c.diffs.length, 0);
          return (
            <div
              key={batch.batch_id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-800/40"
                onClick={() =>
                  setExpanded((e) => ({ ...e, [batch.batch_id]: !isOpen }))
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        batch.source === "jiro-script"
                          ? "bg-emerald-900/40 text-emerald-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {sourceLabel(batch.source)}
                    </span>
                    {batch.reverted && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/40 text-red-400">
                        REVERTIDO
                      </span>
                    )}
                    <span className="text-gray-500 text-xs truncate">
                      {batch.batch_id}
                    </span>
                  </div>
                  <div className="text-sm text-white">
                    {batch.changes.length}{" "}
                    {batch.changes.length === 1 ? "producto" : "productos"} —{" "}
                    {totalDiffs} {totalDiffs === 1 ? "cambio" : "cambios"} de precio
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatDate(batch.created_at)} · {batch.user_display}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {!batch.reverted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirming(batch.batch_id);
                      }}
                      className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-semibold rounded-lg"
                    >
                      Revertir
                    </button>
                  )}
                  <span className="text-gray-500 text-lg">{isOpen ? "▾" : "▸"}</span>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-800 bg-gray-950/50">
                  {batch.changes.map((change) => (
                    <div
                      key={change.audit_id}
                      className="px-5 py-3 border-b border-gray-800/60 last:border-b-0"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-white text-sm font-medium">
                          {change.product_name}
                        </div>
                        {change.reverted_at && (
                          <span className="text-red-400 text-xs">
                            revertido {formatDate(change.reverted_at)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {change.diffs.map((d, i) => (
                          <div key={i}>
                            {d.kind === "base_price" ? "precio base" : `variante ${d.label || ""}`}
                            {": "}
                            <span className="text-gray-500 line-through">
                              {formatPrice(d.from)}
                            </span>{" "}
                            →{" "}
                            <span className="text-emerald-400">{formatPrice(d.to)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !reverting && setConfirming(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold text-lg">Revertir lote de cambios</h3>
            </div>
            <div className="p-5">
              <p className="text-gray-300 text-sm">
                Los precios de los productos afectados por este lote van a volver al valor
                que tenían antes del cambio. ¿Confirmás?
              </p>
              <p className="text-gray-500 text-xs mt-2 break-all">ID: {confirming}</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button
                disabled={reverting}
                onClick={() => setConfirming(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={reverting}
                onClick={() => revertBatch(confirming)}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {reverting ? "Revirtiendo..." : "Revertir lote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
