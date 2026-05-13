import { useEffect, useState } from "react";
import { useMegaFody, useMegaFodyDispatch, type MegaFodyOrder, type OrderStatus } from "./megafodyStore";

const COLUMNS: { status: OrderStatus; title: string; accent: string }[] = [
  { status: "pending", title: "Pendientes", accent: "border-l-yellow-500" },
  { status: "preparing", title: "En preparación", accent: "border-l-blue-500" },
  { status: "ready", title: "Listos para despachar", accent: "border-l-emerald-500" },
];

function minutesSince(iso: string, now: number): number {
  const created = new Date(iso).getTime();
  return Math.max(0, Math.floor((now - created) / 60000));
}

function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function KdsPage() {
  const { orders } = useMegaFody();
  const dispatch = useMegaFodyDispatch();
  const [now, setNow] = useState<number>(() => Date.now());

  // Recalculate elapsed minutes every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  function setStatus(orderId: number, status: OrderStatus) {
    dispatch({ type: "SET_STATUS", payload: { orderId, status } });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Monitor de cocina</h2>
          <p className="text-xs text-gray-500">Click en las acciones para avanzar el estado del pedido.</p>
        </div>
        <button
          onClick={() => dispatch({ type: "RESET_DEMO" })}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          ↺ Reiniciar demo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{col.title}</h3>
                <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">
                  {colOrders.length}
                </span>
              </div>

              {colOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center text-xs text-gray-600">
                  Sin pedidos
                </div>
              ) : (
                <div className="space-y-3">
                  {colOrders.map((order) => (
                    <KdsCard key={order.id} order={order} now={now} accent={col.accent} onStatus={setStatus} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KdsCard({
  order,
  now,
  accent,
  onStatus,
}: {
  order: MegaFodyOrder;
  now: number;
  accent: string;
  onStatus: (orderId: number, status: OrderStatus) => void;
}) {
  const elapsed = minutesSince(order.createdAt, now);
  const isDelayed = (order.status === "pending" || order.status === "preparing") && elapsed > 15;

  return (
    <div
      className={`bg-gray-900 rounded-lg p-3 border-l-4 ${
        isDelayed ? "border-l-red-500 ring-1 ring-red-500/30" : accent
      } border-y border-r border-gray-800`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold">#{order.id}</span>
          <span
            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              order.type === "delivery" ? "bg-purple-600/20 text-purple-300" : "bg-blue-600/20 text-blue-300"
            }`}
          >
            {order.type === "delivery" ? "Delivery" : "Mostrador"}
          </span>
          {isDelayed && (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-600/30 text-red-300">
              Demorado
            </span>
          )}
        </div>
        <span className={`text-xs font-medium ${isDelayed ? "text-red-400" : "text-gray-400"}`}>
          {elapsed === 0 ? "ahora" : `${elapsed}m`}
        </span>
      </div>

      {order.customer?.name && (
        <p className="text-xs text-gray-300 mb-1">
          <span className="text-gray-500">Cliente: </span>
          {order.customer.name}
          {order.customer.phone ? ` · ${order.customer.phone}` : ""}
        </p>
      )}
      {order.customer?.address && (
        <p className="text-xs text-gray-400 mb-1 truncate">
          <span className="text-gray-500">Dir: </span>
          {order.customer.address}
        </p>
      )}

      <ul className="text-sm space-y-0.5 mb-2 mt-2 bg-gray-800/40 rounded px-2 py-1.5">
        {order.items.map((i, idx) => (
          <li key={idx} className="text-gray-200 flex justify-between gap-2">
            <span>
              <span className="text-rose-300 font-bold">{i.quantity}×</span> {i.productName}
            </span>
            <span className="text-gray-500 text-xs shrink-0 self-center">
              {formatARS(i.price * i.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="text-xs text-yellow-400/90 bg-yellow-900/15 border border-yellow-900/30 rounded px-2 py-1 mb-2">
          <span className="font-semibold">Nota: </span>
          {order.notes}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-800">
        <button
          onClick={() => onStatus(order.id, "cancelled")}
          className="text-[11px] text-red-400/80 hover:text-red-300"
        >
          Cancelar
        </button>
        {order.status === "pending" && (
          <button
            onClick={() => onStatus(order.id, "preparing")}
            className="px-3 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            Empezar →
          </button>
        )}
        {order.status === "preparing" && (
          <button
            onClick={() => onStatus(order.id, "ready")}
            className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Marcar listo →
          </button>
        )}
        {order.status === "ready" && (
          <button
            onClick={() => onStatus(order.id, "delivered")}
            className="px-3 py-1.5 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white"
          >
            Despachar ✓
          </button>
        )}
      </div>
    </div>
  );
}
