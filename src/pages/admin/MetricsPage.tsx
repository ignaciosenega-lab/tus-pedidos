import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

type Tab = "funnel" | "products" | "patterns";

interface FunnelData {
  sessions: number;
  productViews: number;
  checkoutStarts: number;
  orders: number;
}

interface ProductMetric {
  productId: string;
  productName: string;
  views: number;
  unitsSold: number;
  purchases: number;
  revenue: number;
}

interface DayData {
  day: number;
  label: string;
  count: number;
}

interface HourData {
  hour: number;
  count: number;
}

interface PatternsData {
  byDay: DayData[];
  byHour: HourData[];
}

type SortKey = "productName" | "views" | "unitsSold" | "purchases" | "revenue";

export default function MetricsPage() {
  const { apiFetch } = useApi();
  const { branchId, loading: branchLoading } = useBranchId();

  const [tab, setTab] = useState<Tab>("funnel");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [productData, setProductData] = useState<ProductMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [patternsData, setPatternsData] = useState<PatternsData | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  async function loadMetrics() {
    if (!branchId) return;
    setLoading(true);
    try {
      if (tab === "funnel") {
        const data = await apiFetch<FunnelData>(
          `/api/branches/${branchId}/metrics/funnel?from=${dateFrom}&to=${dateTo}`
        );
        setFunnelData(data);
      } else if (tab === "products") {
        const data = await apiFetch<ProductMetric[]>(
          `/api/branches/${branchId}/metrics/products?from=${dateFrom}&to=${dateTo}`
        );
        setProductData(data);
      } else {
        const data = await apiFetch<PatternsData>(
          `/api/branches/${branchId}/metrics/patterns?from=${dateFrom}&to=${dateTo}`
        );
        setPatternsData(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "productName");
    }
  }

  const sortedProducts = [...productData].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === "productName") return a.productName.localeCompare(b.productName) * dir;
    return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
  });

  function funnelPercent(value: number, total: number): string {
    if (total === 0) return "0%";
    return `${((value / total) * 100).toFixed(2)}%`;
  }

  if (branchLoading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-gray-400 mt-4">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="max-w-6xl">
        <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-4 text-yellow-400">
          No hay sucursal asignada.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold text-white mb-1">Métricas</h2>
      <p className="text-gray-400 mb-6">Análisis de conversión y rendimiento de productos</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setTab("funnel"); setFunnelData(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "funnel"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
        >
          Funnel
        </button>
        <button
          onClick={() => { setTab("products"); setProductData([]); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "products"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
        >
          Performance productos
        </button>
        <button
          onClick={() => { setTab("patterns"); setPatternsData(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "patterns"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
        >
          Días y Horarios
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-gray-400 mb-3">Filtros</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <button onClick={loadMetrics} disabled={loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {loading ? "Cargando..." : "Generar Métricas"}
          </button>
        </div>
      </div>

      {/* Funnel Tab */}
      {tab === "funnel" && (
        <>
          {!funnelData ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500">Seleccioná un rango de fechas y hacé click en "Generar Métricas"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Funnel steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FunnelCard label="Sesiones" value={funnelData.sessions} color="text-amber-400" />
                <FunnelCard label="Detalle pedido" value={funnelData.productViews}
                  percent={funnelPercent(funnelData.productViews, funnelData.sessions)} color="text-gray-300" />
                <FunnelCard label="Checkout" value={funnelData.checkoutStarts}
                  percent={funnelPercent(funnelData.checkoutStarts, funnelData.sessions)} color="text-gray-300" />
                <FunnelCard label="Pedidos generados" value={funnelData.orders}
                  percent={funnelPercent(funnelData.orders, funnelData.sessions)} color="text-emerald-400" />
              </div>

              {/* Funnel bar */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-sm font-medium text-gray-400 mb-4">Embudo de conversión</p>
                <div className="space-y-3">
                  <FunnelBar label="Sesiones" value={funnelData.sessions} max={funnelData.sessions} color="bg-amber-500" />
                  <FunnelBar label="Detalle pedido" value={funnelData.productViews} max={funnelData.sessions} color="bg-gray-400" />
                  <FunnelBar label="Checkout" value={funnelData.checkoutStarts} max={funnelData.sessions} color="bg-blue-500" />
                  <FunnelBar label="Pedidos" value={funnelData.orders} max={funnelData.sessions} color="bg-emerald-500" />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Products Tab */}
      {tab === "products" && (
        <>
          {productData.length === 0 && !loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500">Seleccioná un rango de fechas y hacé click en "Generar Métricas"</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800 border-b border-gray-700">
                  <tr>
                    <SortableHeader label="Producto" sortKey="productName" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortableHeader label="Visualizaciones" sortKey="views" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortableHeader label="Unidades vendidas" sortKey="unitsSold" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortableHeader label="Compras" sortKey="purchases" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ratio de compra</th>
                    <SortableHeader label="Ingresos" sortKey="revenue" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedProducts.map((p) => (
                    <tr key={p.productId} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-white">{p.productName}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-center">{p.views}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-center">{p.unitsSold}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-center">{p.purchases}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-center">
                        {p.views > 0 ? `${((p.purchases / p.views) * 100).toFixed(0)}%` : "0%"}
                      </td>
                      <td className="px-4 py-3 text-sm text-emerald-400 font-medium text-right">
                        ${p.revenue.toLocaleString("es-AR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Patterns Tab */}
      {tab === "patterns" && (
        <>
          {!patternsData ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500">Seleccioná un rango de fechas y hacé click en "Generar Métricas"</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Orders by day of week */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-sm font-medium text-gray-400 mb-4">Pedidos por día de la semana</p>
                <div className="space-y-3">
                  {/* Show Monday first: reorder [1,2,3,4,5,6,0] */}
                  {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                    const d = patternsData.byDay[i];
                    const maxDay = Math.max(...patternsData.byDay.map((x) => x.count), 1);
                    return (
                      <FunnelBar key={d.day} label={d.label} value={d.count} max={maxDay} color="bg-emerald-500" />
                    );
                  })}
                </div>
              </div>

              {/* Orders by hour */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-sm font-medium text-gray-400 mb-4">Pedidos por hora del día</p>
                <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: 220 }}>
                  {patternsData.byHour.map((h) => {
                    const maxHour = Math.max(...patternsData.byHour.map((x) => x.count), 1);
                    const pct = (h.count / maxHour) * 100;
                    return (
                      <div key={h.hour} className="flex flex-col items-center flex-1 min-w-[28px]">
                        <span className="text-[10px] text-gray-400 mb-1">{h.count || ""}</span>
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full bg-emerald-500 rounded-t transition-all duration-500"
                            style={{ height: `${Math.max(pct, h.count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 mt-1">{h.hour}h</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FunnelCard({ label, value, percent, color }: { label: string; value: number; percent?: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value.toLocaleString("es-AR")}</p>
      {percent && <p className="text-xs text-gray-500 mt-1">{percent}</p>}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <span className="text-sm text-white font-medium w-16 text-right">{value.toLocaleString("es-AR")}</span>
    </div>
  );
}

function SortableHeader({ label, sortKey, currentKey, asc, onClick }: {
  label: string; sortKey: SortKey; currentKey: SortKey; asc: boolean; onClick: (key: SortKey) => void;
}) {
  const isActive = sortKey === currentKey;
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
      onClick={() => onClick(sortKey)}>
      <span className="flex items-center gap-1">
        {label}
        {isActive && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={asc ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        )}
      </span>
    </th>
  );
}
