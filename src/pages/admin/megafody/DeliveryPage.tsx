import { useState, useMemo, useEffect } from "react";
import { useMegaFody, useMegaFodyDispatch, type OrderType } from "./megafodyStore";

function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function DeliveryPage() {
  const { products, categories, drafts, activeDraftId } = useMegaFody();
  const dispatch = useMegaFodyDispatch();

  const activeDraft = useMemo(
    () => drafts.find((d) => d.draftId === activeDraftId) || null,
    [drafts, activeDraftId]
  );

  const [categoryId, setCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    let list = products;
    if (categoryId !== "all") list = list.filter((p) => p.categoryId === categoryId);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, categoryId, search]);

  function addToCart(productId: string) {
    if (!activeDraft) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const existing = activeDraft.items.find((i) => i.productId === productId);
    const newItems = existing
      ? activeDraft.items.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        )
      : [
          ...activeDraft.items,
          { productId: product.id, productName: product.name, price: product.price, quantity: 1 },
        ];
    dispatch({
      type: "UPDATE_DRAFT",
      payload: { draftId: activeDraft.draftId, changes: { items: newItems } },
    });
  }

  function updateQty(productId: string, delta: number) {
    if (!activeDraft) return;
    const newItems = activeDraft.items
      .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
      .filter((i) => i.quantity > 0);
    dispatch({
      type: "UPDATE_DRAFT",
      payload: { draftId: activeDraft.draftId, changes: { items: newItems } },
    });
  }

  function removeItem(productId: string) {
    if (!activeDraft) return;
    dispatch({
      type: "UPDATE_DRAFT",
      payload: {
        draftId: activeDraft.draftId,
        changes: { items: activeDraft.items.filter((i) => i.productId !== productId) },
      },
    });
  }

  function updateField<K extends "name" | "phone" | "address">(field: K, value: string) {
    if (!activeDraft) return;
    dispatch({
      type: "UPDATE_DRAFT",
      payload: {
        draftId: activeDraft.draftId,
        changes: { customer: { ...activeDraft.customer, [field]: value } },
      },
    });
  }

  function setOrderType(type: OrderType) {
    if (!activeDraft) return;
    dispatch({
      type: "UPDATE_DRAFT",
      payload: { draftId: activeDraft.draftId, changes: { type } },
    });
  }

  function setNotes(notes: string) {
    if (!activeDraft) return;
    dispatch({
      type: "UPDATE_DRAFT",
      payload: { draftId: activeDraft.draftId, changes: { notes } },
    });
  }

  const subtotal = activeDraft
    ? activeDraft.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    : 0;

  function sendToKitchen() {
    if (!activeDraft || activeDraft.items.length === 0) return;
    dispatch({ type: "SUBMIT_DRAFT", payload: { draftId: activeDraft.draftId } });
    setToast(`Pedido enviado a cocina`);
  }

  return (
    <div className="space-y-4">
      {/* Pedidos abiertos (tabs) */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Pedidos abiertos</p>
          <span className="text-[10px] text-gray-500">{drafts.length} en curso</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {drafts.map((d) => {
            const isActive = d.draftId === activeDraftId;
            const itemCount = d.items.reduce((sum, i) => sum + i.quantity, 0);
            const total = d.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
            return (
              <button
                key={d.draftId}
                onClick={() => dispatch({ type: "SET_ACTIVE_DRAFT", payload: { draftId: d.draftId } })}
                className={`shrink-0 text-left rounded-lg px-3 py-2 border transition-all min-w-[150px] ${
                  isActive
                    ? "bg-rose-600 border-rose-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-sm font-semibold truncate">{d.label}</span>
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-white/20 text-white"
                        : d.type === "delivery"
                        ? "bg-purple-600/30 text-purple-300"
                        : "bg-blue-600/30 text-blue-300"
                    }`}
                  >
                    {d.type === "delivery" ? "Del" : "Mos"}
                  </span>
                </div>
                <div className={`text-[11px] ${isActive ? "text-rose-100" : "text-gray-500"}`}>
                  {itemCount === 0 ? "Vacío" : `${itemCount} ítems · ${formatARS(total)}`}
                </div>
              </button>
            );
          })}
          <button
            onClick={() => dispatch({ type: "CREATE_DRAFT" })}
            className="shrink-0 rounded-lg px-3 py-2 border border-dashed border-gray-700 text-gray-400 hover:border-rose-500 hover:text-rose-400 transition-colors text-sm font-medium min-w-[110px]"
          >
            + Nuevo
          </button>
        </div>
      </div>

      {!activeDraft ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-10 text-center">
          <p className="text-gray-400 mb-3">No hay pedidos abiertos</p>
          <button
            onClick={() => dispatch({ type: "CREATE_DRAFT" })}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
          >
            Crear pedido nuevo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Catalog */}
          <section className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-white">Catálogo</h2>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <CategoryChip label="Todo" active={categoryId === "all"} onClick={() => setCategoryId("all")} />
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  label={c.name}
                  active={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.length === 0 ? (
                <div className="col-span-full bg-gray-900 border border-gray-800 rounded-lg p-6 text-center text-gray-500 text-sm">
                  No hay productos con esos filtros
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p.id)}
                    className="text-left bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-rose-500 transition-colors"
                  >
                    <div className="w-full h-20 rounded bg-gradient-to-br from-rose-900/40 to-gray-800 flex items-center justify-center mb-2 text-2xl font-bold text-rose-300/60">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-medium text-white leading-snug line-clamp-2 min-h-[2.5em]">{p.name}</p>
                    <p className="text-rose-400 font-bold text-sm mt-1">{formatARS(p.price)}</p>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Cart for active draft */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-4 h-fit lg:sticky lg:top-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">{activeDraft.label}</h2>
                <p className="text-xs text-gray-500">Datos del cliente opcionales</p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar ${activeDraft.label}?`)) {
                    dispatch({ type: "DELETE_DRAFT", payload: { draftId: activeDraft.draftId } });
                  }
                }}
                className="text-xs text-red-400/80 hover:text-red-300"
              >
                Eliminar
              </button>
            </div>

            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <TypeBtn label="Mostrador" active={activeDraft.type === "mostrador"} onClick={() => setOrderType("mostrador")} />
              <TypeBtn label="Delivery" active={activeDraft.type === "delivery"} onClick={() => setOrderType("delivery")} />
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <input
                value={activeDraft.customer.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Nombre del cliente o mesa"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
              />
              <input
                value={activeDraft.customer.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="Teléfono"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
              />
              {activeDraft.type === "delivery" && (
                <input
                  value={activeDraft.customer.address || ""}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Dirección"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
                />
              )}
            </div>

            {/* Items */}
            <div className="border-t border-gray-800 pt-3">
              {activeDraft.items.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Tocá productos del catálogo para sumarlos</p>
              ) : (
                <ul className="space-y-2">
                  {activeDraft.items.map((i) => (
                    <li key={i.productId} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate">{i.productName}</p>
                        <p className="text-xs text-gray-500">{formatARS(i.price)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(i.productId, -1)}
                          className="w-6 h-6 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-white text-sm font-medium">{i.quantity}</span>
                        <button
                          onClick={() => updateQty(i.productId, 1)}
                          className="w-6 h-6 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(i.productId)}
                        className="text-red-400 hover:text-red-300 text-xs ml-1"
                        aria-label="Quitar"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Notes */}
            <textarea
              value={activeDraft.notes || ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notas para cocina (sin sal, etc.)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 resize-none"
            />

            {/* Total + submit */}
            <div className="border-t border-gray-800 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total</span>
                <span className="text-xl font-bold text-rose-400">{formatARS(subtotal)}</span>
              </div>
              <button
                onClick={sendToKitchen}
                disabled={activeDraft.items.length === 0}
                className="w-full py-3 rounded-lg text-sm font-bold transition-colors bg-rose-600 hover:bg-rose-700 disabled:bg-gray-800 disabled:text-gray-600 text-white"
              >
                Enviar a cocina
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-2xl text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? "bg-rose-600 text-white" : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function TypeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
        active ? "bg-rose-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
