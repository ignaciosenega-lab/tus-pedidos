import { useState, useEffect, useMemo, useCallback } from "react";
import { useApi } from "../../hooks/useApi";

interface Branch {
  id: number;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  categoryId: string;
}

interface OrderItem {
  productId?: string;
  productName: string;
  variantLabel?: string;
  quantity: number;
  price: number;
  categoryId?: string;
}

interface GlobalOrder {
  id: number;
  branch_id: number;
  branch_name: string;
  branch_slug: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  delivery_type: string;
  payment_method: string;
  items: OrderItem[];
  subtotal: number;
  delivery_cost: number;
  discount: number;
  total: number;
  status: string;
  created_at: string;
}

interface ProductMetric {
  productId: string;
  productName: string;
  unitsSold: number;
  purchases: number;
  revenue: number;
  branchCount: number;
}

type Tab = "orders" | "topProducts";
type SortKey = "productName" | "unitsSold" | "purchases" | "revenue" | "branchCount";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  delivering: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/30 text-yellow-400",
  confirmed: "bg-blue-900/30 text-blue-400",
  preparing: "bg-purple-900/30 text-purple-400",
  ready: "bg-cyan-900/30 text-cyan-400",
  delivering: "bg-orange-900/30 text-orange-400",
  delivered: "bg-emerald-900/30 text-emerald-400",
  cancelled: "bg-red-900/30 text-red-400",
};

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export default function GlobalOperationsPage() {
  const { apiFetch } = useApi();

  // Reference data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  // Filters
  const [tab, setTab] = useState<Tab>("orders");
  const [dateFrom, setDateFrom] = useState<string>(() => isoDateNDaysAgo(7));
  const [dateTo, setDateTo] = useState<string>(() => todayISO());
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<number>>(new Set());
  const [categoryId, setCategoryId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [productSearch, setProductSearch] = useState<string>("");

  // Data
  const [orders, setOrders] = useState<GlobalOrder[]>([]);
  const [topProducts, setTopProducts] = useState<ProductMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort for top products
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [topLimit, setTopLimit] = useState(50);

  // Load reference data once
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Branch[]>("/api/branches"),
      apiFetch<Category[]>("/api/catalog/categories"),
      apiFetch<CatalogProduct[]>("/api/catalog/products"),
    ])
      .then(([b, c, p]) => {
        if (cancelled) return;
        setBranches(b);
        setCategories(c);
        setProducts(p);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || "Error cargando datos");
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  function buildQuery(includeProduct: boolean): string {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("from", dateFrom);
    if (dateTo) qs.set("to", dateTo);
    if (selectedBranchIds.size > 0) qs.set("branchIds", [...selectedBranchIds].join(","));
    if (categoryId) qs.set("categoryId", categoryId);
    if (includeProduct && productId) qs.set("productId", productId);
    return qs.toString();
  }

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<GlobalOrder[]>(`/api/global/orders?${buildQuery(true)}`);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || "Error cargando pedidos");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch, dateFrom, dateTo, selectedBranchIds, categoryId, productId]);

  const loadTopProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ProductMetric[]>(`/api/global/metrics/products?${buildQuery(false)}`);
      setTopProducts(data);
    } catch (err: any) {
      setError(err.message || "Error cargando productos");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch, dateFrom, dateTo, selectedBranchIds, categoryId]);

  // Auto-fetch when filters change or tab changes
  useEffect(() => {
    if (tab === "orders") loadOrders();
    else loadTopProducts();
  }, [tab, loadOrders, loadTopProducts]);

  function toggleBranch(id: number) {
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllBranches() {
    setSelectedBranchIds(new Set());
  }

  function clearAllFilters() {
    setDateFrom(isoDateNDaysAgo(7));
    setDateTo(todayISO());
    setSelectedBranchIds(new Set());
    setCategoryId("");
    setProductId("");
    setProductSearch("");
  }

  // Sorted product list for the product picker
  const filteredProductOptions = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    let list = products;
    if (categoryId) list = list.filter((p) => String(p.categoryId) === categoryId);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list.slice(0, 50);
  }, [products, productSearch, categoryId]);

  // Sorted top products
  const sortedTopProducts = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    const sorted = [...topProducts].sort((a, b) => {
      if (sortKey === "productName") return a.productName.localeCompare(b.productName) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return sorted;
  }, [topProducts, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "productName");
    }
  }

  const branchAllSelected = selectedBranchIds.size === 0;
  const selectedProduct = products.find((p) => p.id === productId) || null;

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Operación global</h2>
          <p className="text-gray-400">Pedidos y rendimiento de todas las sucursales en un mismo lugar</p>
        </div>
        <button
          onClick={() => (tab === "orders" ? loadOrders() : loadTopProducts())}
          disabled={loading}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 space-y-4">
        {/* Row 1: dates + category + product */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Categoría</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (e.target.value && selectedProduct && String(selectedProduct.categoryId) !== e.target.value) {
                  setProductId("");
                  setProductSearch("");
                }
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 min-w-[180px]"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {tab === "orders" && (
            <div className="min-w-[220px]">
              <label className="block text-xs text-gray-500 mb-1">Producto</label>
              {productId && selectedProduct ? (
                <div className="flex items-center gap-2 bg-gray-800 border border-emerald-600/40 rounded-lg px-3 py-2 text-sm text-white">
                  <span className="truncate flex-1">{selectedProduct.name}</span>
                  <button
                    onClick={() => {
                      setProductId("");
                      setProductSearch("");
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                  {productSearch.trim() && filteredProductOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-10">
                      {filteredProductOptions.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setProductId(p.id);
                            setProductSearch("");
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={clearAllFilters}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Limpiar
          </button>
        </div>

        {/* Row 2: branch chips */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Sucursales</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={selectAllBranches}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                branchAllSelected
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
              }`}
            >
              Todas
            </button>
            {branches.map((b) => {
              const selected = selectedBranchIds.has(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggleBranch(b.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selected
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("orders")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "orders"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
        >
          Pedidos {tab === "orders" && !loading ? `(${orders.length})` : ""}
        </button>
        <button
          onClick={() => setTab("topProducts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "topProducts"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
        >
          Más vendidos
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-red-400 mb-4">
          {error}
        </div>
      )}

      {/* Tab: Orders */}
      {tab === "orders" && (
        <>
          {loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500">Cargando pedidos…</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500">No se encontraron pedidos con esos filtros</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-base">#{order.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-200">
                        {order.branch_name || order.branch_slug}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[order.status] || "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString("es-AR", {
                              timeZone: "America/Argentina/Buenos_Aires",
                            })
                          : "-"}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold">
                      ${(order.total ?? 0).toLocaleString("es-AR")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-400 mb-2">
                    <div>
                      <span className="text-gray-500">Cliente: </span>
                      <span className="text-gray-300">{order.customer_name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tel: </span>
                      <span className="text-gray-300">{order.customer_phone || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Entrega: </span>
                      <span className="text-gray-300">
                        {order.delivery_type === "delivery" ? "Envío" : "Retiro"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded px-3 py-2 text-sm">
                    {(order.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between text-gray-300">
                        <span className="truncate">
                          {item.quantity}× {item.productName}
                          {item.variantLabel ? ` (${item.variantLabel})` : ""}
                        </span>
                        <span className="text-gray-500 shrink-0 ml-2">
                          ${((item.price || 0) * (item.quantity || 0)).toLocaleString("es-AR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {orders.length >= 500 && (
                <p className="text-center text-xs text-gray-500 py-2">
                  Mostrando los 500 pedidos más recientes. Achicá el rango de fechas para ver más detalle.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Tab: Top Products */}
      {tab === "topProducts" && (
        <>
          {loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500">Calculando ranking…</p>
            </div>
          ) : sortedTopProducts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500">No se vendió ningún producto con esos filtros</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-12">#</th>
                    <SortableHeader label="Producto" sortKey="productName" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortableHeader label="Unidades" sortKey="unitsSold" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortableHeader label="Pedidos" sortKey="purchases" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortableHeader label="Sucursales" sortKey="branchCount" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                    <SortableHeader label="Ingresos" sortKey="revenue" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedTopProducts.slice(0, topLimit).map((p, i) => (
                    <tr key={p.productId} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-sm text-white">{p.productName}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-center">{p.unitsSold}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-center">{p.purchases}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-center">{p.branchCount}</td>
                      <td className="px-4 py-3 text-sm text-emerald-400 font-medium text-right">
                        ${p.revenue.toLocaleString("es-AR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedTopProducts.length > topLimit && (
                <div className="text-center py-3 border-t border-gray-800">
                  <button
                    onClick={() => setTopLimit((n) => n + 50)}
                    className="text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    Ver más ({sortedTopProducts.length - topLimit} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  asc,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
}) {
  const isActive = sortKey === currentKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
      onClick={() => onClick(sortKey)}
    >
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
