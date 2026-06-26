import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";

interface Issue {
  type: "config" | "promo" | "orders" | string;
  severity: "alta" | "media" | "baja" | string;
  message: string;
  hint: string;
  branch: string | null;
  entity: string | null;
}

interface HealthData {
  generatedAt: string;
  count: number;
  issues: Issue[];
}

const TYPE_LABELS: Record<string, string> = {
  config: "Configuración",
  promo: "Promos y cupones",
  orders: "Pedidos trabados",
};

const SEV_STYLES: Record<string, string> = {
  alta: "bg-red-900/30 text-red-400 border-red-900/50",
  media: "bg-yellow-900/30 text-yellow-400 border-yellow-900/50",
  baja: "bg-gray-800 text-gray-400 border-gray-700",
};

const SEV_LABELS: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

export default function AlertsPage() {
  const { apiFetch } = useApi();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<HealthData>("/api/global/health");
      setData(res);
    } catch (e: any) {
      setError(e.message || "Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups: Record<string, Issue[]> = {};
  (data?.issues || []).forEach((i) => {
    (groups[i.type] ||= []).push(i);
  });

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Alertas</h2>
          <p className="text-gray-400 text-sm mt-1">
            Cosas que pueden romper el flujo o confundir al cliente. Revisalas para que la tienda funcione bien.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          {loading ? "..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Cargando…</div>
      ) : !data || data.count === 0 ? (
        <div className="text-center py-12 text-emerald-400 border border-dashed border-gray-800 rounded-xl">
          ✓ Todo en orden, no hay alertas.
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-400">{data.count} alerta(s) encontrada(s).</p>
          {Object.keys(groups).map((type) => (
            <div key={type}>
              <h3 className="text-sm font-semibold text-white mb-2">
                {TYPE_LABELS[type] || type}{" "}
                <span className="text-gray-500">({groups[type].length})</span>
              </h3>
              <div className="space-y-2">
                {groups[type].map((i, idx) => (
                  <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
                    <span className={`shrink-0 h-fit text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${SEV_STYLES[i.severity] || SEV_STYLES.baja}`}>
                      {SEV_LABELS[i.severity] || i.severity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">{i.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{i.hint}</p>
                      {(i.branch || i.entity) && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          {i.branch && <span>Sucursal: {i.branch}</span>}
                          {i.branch && i.entity && " · "}
                          {i.entity && <span>{i.entity}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
