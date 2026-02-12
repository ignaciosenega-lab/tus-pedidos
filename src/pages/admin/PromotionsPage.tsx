import { useState } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import type { Promotion } from "../../types";

const EMPTY: Promotion = {
  id: "",
  name: "",
  percentage: 10,
  applyToAll: true,
  productIds: [],
  dateFrom: "",
  dateTo: "",
  weeklyRepeat: false,
};

export default function PromotionsPage() {
  const { promotions, products } = useAdmin();
  const dispatch = useAdminDispatch();
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<Promotion>(EMPTY);

  function openNew() {
    setForm({ ...EMPTY, id: `promo-${Date.now()}` });
    setEditing({} as Promotion);
  }

  function openEdit(p: Promotion) {
    setForm({ ...p });
    setEditing(p);
  }

  function close() {
    setEditing(null);
  }

  function save() {
    if (!form.name.trim()) return;
    dispatch({ type: "UPSERT_PROMOTION", payload: form });
    close();
  }

  function toggleProductId(pid: string) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(pid)
        ? f.productIds.filter((id) => id !== pid)
        : [...f.productIds, pid],
    }));
  }

  function isActive(p: Promotion): boolean {
    const now = new Date().toISOString().slice(0, 10);
    return p.dateFrom <= now && now <= p.dateTo;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Promociones y descuentos</h2>
        <button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Nueva promoción
        </button>
      </div>

      {/* Grid of promo cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((p) => {
          const active = isActive(p);
          return (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-white font-bold text-base">{p.name}</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${active ? "bg-emerald-900/40 text-emerald-400" : "bg-gray-800 text-gray-500"}`}>
                  {active ? "Activa" : "Inactiva"}
                </span>
              </div>

              <div className="text-4xl font-black text-emerald-400 mb-3">
                {p.percentage}%
                <span className="text-sm font-normal text-gray-500 ml-1">OFF</span>
              </div>

              <div className="text-gray-400 text-sm space-y-1 flex-1">
                <p>Aplica a: {p.applyToAll ? "Todos los productos" : `${p.productIds.length} productos`}</p>
                <p>Desde: {p.dateFrom || "-"}</p>
                <p>Hasta: {p.dateTo || "-"}</p>
                {p.weeklyRepeat && (
                  <p className="text-yellow-400 text-xs font-medium">Se repite semanalmente</p>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => dispatch({ type: "DELETE_PROMOTION", payload: p.id })}
                  className="bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 py-2 px-3 rounded-lg text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}

        {promotions.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">No hay promociones creadas</div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={close}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">
                {form.id.startsWith("promo-") && !form.name ? "Nueva promoción" : "Editar promoción"}
              </h3>
              <button onClick={close} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Porcentaje de descuento</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.percentage}
                    onChange={(e) => setForm((f) => ({ ...f, percentage: Number(e.target.value) }))}
                    className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <span className="text-gray-400 text-lg font-bold">%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fecha desde</label>
                  <input
                    type="date"
                    value={form.dateFrom}
                    onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fecha hasta</label>
                  <input
                    type="date"
                    value={form.dateTo}
                    onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.weeklyRepeat}
                  onChange={(e) => setForm((f) => ({ ...f, weeklyRepeat: e.target.checked }))}
                  className="accent-emerald-600"
                />
                Se repite semanalmente
              </label>

              {/* Apply to */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Aplicar a</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.applyToAll}
                      onChange={() => setForm((f) => ({ ...f, applyToAll: true, productIds: [] }))}
                      className="accent-emerald-600"
                    />
                    Todos los productos
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={!form.applyToAll}
                      onChange={() => setForm((f) => ({ ...f, applyToAll: false }))}
                      className="accent-emerald-600"
                    />
                    Productos específicos
                  </label>
                </div>

                {!form.applyToAll && (
                  <div className="mt-3 max-h-40 overflow-y-auto border border-gray-700 rounded-lg p-2 space-y-1">
                    {products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer py-1 px-2 rounded hover:bg-gray-800">
                        <input
                          type="checkbox"
                          checked={form.productIds.includes(p.id)}
                          onChange={() => toggleProductId(p.id)}
                          className="accent-emerald-600"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button onClick={close} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
