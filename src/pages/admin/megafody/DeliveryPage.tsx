import { useState, useMemo, useEffect } from "react";
import { useMegaFody, useMegaFodyDispatch, type MegaFodyItem, type OrderType } from "./megafodyStore";

function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function DeliveryPage() {
  const { products, categories } = useMegaFody();
  const dispatch = useMegaFodyDispatch();

  const [categoryId, setCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<MegaFodyItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("mostrador");
  const [notes, setNotes] = useState("");
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
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId);
      if (idx >= 0) {
        return prev.map((i, k) => (k === idx ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        { productId: product.id, productName: product.name, price: product.price, quantity: 1 },
      ];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0);
    });
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function sendToKitchen() {
    if (cart.length === 0) return;
    const order = {
      type: orderType,
      customer: {
        name: customerName.trim() || undefined,
        phone: customerPhone.trim() || undefined,
        address: orderType === "delivery" ? address.trim() || undefined : undefined,
      },
      items: cart,
      total: subtotal,
      notes: notes.trim() || undefined,
    };
    dispatch({ type: "ADD_ORDER", payload: order });
    setToast(`Pedido enviado a cocina`);
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setNotes("");
  }

  return (
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
            <CategoryChip key={c.id} label={c.name} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} />
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

      {/* Cart */}
      <section className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-4 h-fit lg:sticky lg:top-4">
        <div>
          <h2 className="text-lg font-bold text-white">Pedido actual</h2>
          <p className="text-xs text-gray-500">Datos del cliente opcionales</p>
        </div>

        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2">
          <TypeBtn label="Mostrador" active={orderType === "mostrador"} onClick={() => setOrderType("mostrador")} />
          <TypeBtn label="Delivery" active={orderType === "delivery"} onClick={() => setOrderType("delivery")} />
        </div>

        {/* Customer */}
        <div className="space-y-2">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre del cliente o mesa"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
          />
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Teléfono"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
          />
          {orderType === "delivery" && (
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
            />
          )}
        </div>

        {/* Items */}
        <div className="border-t border-gray-800 pt-3">
          {cart.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Tocá productos del catálogo para sumarlos</p>
          ) : (
            <ul className="space-y-2">
              {cart.map((i) => (
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
          value={notes}
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
            disabled={cart.length === 0}
            className="w-full py-3 rounded-lg text-sm font-bold transition-colors bg-rose-600 hover:bg-rose-700 disabled:bg-gray-800 disabled:text-gray-600 text-white"
          >
            Enviar a cocina
          </button>
        </div>
      </section>

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
