import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface Order {
  id: number;
  branch_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  delivery_method: string;
  payment_method: string;
  items: OrderItem[];
  subtotal: number;
  delivery_cost: number;
  total: number;
  status: string;
  notes: string;
  created_at: string;
}

type FilterTab = "active" | "delivered" | "cancelled" | "all";

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

const STATUS_FLOW = ["pending", "confirmed", "preparing", "ready", "delivering", "delivered"];

function getNextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

export default function OperationsPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("active");

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    loadOrders();
  }, [branchId]);

  async function loadOrders() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<Order[]>(`/api/branches/${branchId}/orders`);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId: number, status: string) {
    try {
      await apiFetch(`/api/branches/${branchId}/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      loadOrders();
    } catch (err: any) {
      alert(err.message || "Error al actualizar estado");
    }
  }

  const activeStatuses = ["pending", "confirmed", "preparing", "ready", "delivering"];

  const filtered = orders.filter((o) => {
    if (filter === "active") return activeStatuses.includes(o.status);
    if (filter === "delivered") return o.status === "delivered";
    if (filter === "cancelled") return o.status === "cancelled";
    return true;
  });

  const counts = {
    active: orders.filter((o) => activeStatuses.includes(o.status)).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    all: orders.length,
  };

  if (branchLoading || loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="max-w-6xl">
        <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-4 text-yellow-400">
          No hay sucursal asignada. Contacta al administrador master.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl">
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-red-400">{error}</div>
      </div>
    );
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "active", label: `Activos (${counts.active})` },
    { key: "delivered", label: `Entregados (${counts.delivered})` },
    { key: "cancelled", label: `Cancelados (${counts.cancelled})` },
    { key: "all", label: `Todos (${counts.all})` },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Operación</h2>
          <p className="text-gray-400">Gestiona los pedidos de la sucursal</p>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && branches.length > 0 && (
            <select value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button onClick={loadOrders}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
            Actualizar
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay pedidos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const nextStatus = getNextStatus(order.status);
            return (
              <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-bold text-lg">#{order.id}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || "bg-gray-700 text-gray-400"}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {order.created_at ? new Date(order.created_at).toLocaleString("es-AR") : "-"}
                    </p>
                  </div>
                  <span className="text-emerald-400 font-bold text-lg">
                    ${order.total?.toLocaleString() || "0"}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 text-sm">
                  <div>
                    <span className="text-gray-500">Cliente:</span>{" "}
                    <span className="text-gray-300">{order.customer_name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Teléfono:</span>{" "}
                    <span className="text-gray-300">{order.customer_phone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Entrega:</span>{" "}
                    <span className="text-gray-300">
                      {order.delivery_method === "delivery" ? "Envío" : "Retiro"}
                    </span>
                  </div>
                </div>

                {order.customer_address && order.delivery_method === "delivery" && (
                  <div className="text-sm mb-3">
                    <span className="text-gray-500">Dirección:</span>{" "}
                    <span className="text-gray-300">{order.customer_address}</span>
                  </div>
                )}

                {/* Items */}
                <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                  <div className="space-y-1">
                    {(order.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-300">
                          {item.qty}x {item.name}
                        </span>
                        <span className="text-gray-400">${(item.price * item.qty).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {order.delivery_cost > 0 && (
                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-700">
                      <span className="text-gray-400">Envío</span>
                      <span className="text-gray-400">${order.delivery_cost.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {order.notes && (
                  <div className="text-sm mb-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg p-2">
                    <span className="text-yellow-500 font-medium">Nota:</span>{" "}
                    <span className="text-yellow-400/80">{order.notes}</span>
                  </div>
                )}

                {/* Payment */}
                <div className="text-sm mb-3">
                  <span className="text-gray-500">Pago:</span>{" "}
                  <span className="text-gray-300 capitalize">{order.payment_method || "-"}</span>
                </div>

                {/* Actions */}
                {order.status !== "delivered" && order.status !== "cancelled" && (
                  <div className="flex gap-2 pt-2 border-t border-gray-800">
                    {nextStatus && (
                      <button onClick={() => updateStatus(order.id, nextStatus)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
                        {STATUS_LABELS[nextStatus] ? `Marcar: ${STATUS_LABELS[nextStatus]}` : "Avanzar"}
                      </button>
                    )}
                    <button onClick={() => {
                      if (confirm(`¿Cancelar el pedido #${order.id}?`)) {
                        updateStatus(order.id, "cancelled");
                      }
                    }}
                      className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm font-medium transition-colors">
                      Cancelar Pedido
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
