import { useState } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import type { Coupon } from "../../types";
import { formatPrice } from "../../utils/money";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const EMPTY: Coupon = {
  id: "",
  code: "",
  name: "",
  type: "percentage",
  value: 10,
  minOrder: 0,
  maxUses: 0,
  usedCount: 0,
  applyTo: "all",
  categoryIds: [],
  productIds: [],
  activeDays: [],
  timeFrom: "",
  timeTo: "",
  dateFrom: "",
  dateTo: "",
  active: true,
};

export default function CouponsPage() {
  const { coupons, products, categories } = useAdmin();
  const dispatch = useAdminDispatch();

  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<Coupon>(EMPTY);

  /* ── helpers ────────────────────────────────── */

  function openNew() {
    setForm({ ...EMPTY, id: `cup-${Date.now()}` });
    setEditing({} as Coupon);
  }

  function openEdit(c: Coupon) {
    setForm({ ...c });
    setEditing(c);
  }

  function close() {
    setEditing(null);
  }

  function save() {
    if (!form.code.trim() || !form.name.trim()) return;
    dispatch({ type: "UPSERT_COUPON", payload: form });
    close();
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      activeDays: f.activeDays.includes(day)
        ? f.activeDays.filter((d) => d !== day)
        : [...f.activeDays, day].sort((a, b) => a - b),
    }));
  }

  function toggleProductId(pid: string) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(pid)
        ? f.productIds.filter((id) => id !== pid)
        : [...f.productIds, pid],
    }));
  }

  function toggleCategoryId(cid: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(cid)
        ? f.categoryIds.filter((id) => id !== cid)
        : [...f.categoryIds, cid],
    }));
  }

  function daysLabel(days: number[]): string {
    if (days.length === 0) return "Todos los días";
    if (days.length === 7) return "Todos los días";
    return days.map((d) => DAY_LABELS[d]).join(", ");
  }

  function timeLabel(from: string, to: string): string {
    if (!from && !to) return "Todo el día";
    if (from && to) return `${from} - ${to}`;
    if (from) return `Desde ${from}`;
    return `Hasta ${to}`;
  }

  function applyLabel(c: Coupon): string {
    if (c.applyTo === "all") return "Todos los productos";
    if (c.applyTo === "categories") return `${c.categoryIds.length} categoría(s)`;
    return `${c.productIds.length} producto(s)`;
  }

  /* ── render ─────────────────────────────────── */

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Cupones de descuento</h2>
        <button
          onClick={openNew}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          + Nuevo cupón
        </button>
      </div>

      {/* ── Cards grid ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map((c) => {
          const exhausted = c.maxUses > 0 && c.usedCount >= c.maxUses;
          return (
            <div
              key={c.id}
              className={`bg-gray-900 border rounded-xl p-5 flex flex-col ${
                c.active && !exhausted ? "border-gray-800" : "border-gray-800 opacity-60"
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Código</p>
                  <p className="text-white font-mono font-bold text-lg tracking-wide">{c.code}</p>
                </div>
                <button
                  onClick={() => dispatch({ type: "TOGGLE_COUPON_ACTIVE", payload: c.id })}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    c.active
                      ? "bg-emerald-900/40 text-emerald-400"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {c.active ? "Activo" : "Inactivo"}
                </button>
              </div>

              <p className="text-gray-400 text-sm mb-3">{c.name}</p>

              {/* Discount badge */}
              <div className="text-3xl font-black text-emerald-400 mb-3">
                {c.type === "percentage" ? (
                  <>
                    {c.value}%
                    <span className="text-sm font-normal text-gray-500 ml-1">OFF</span>
                  </>
                ) : (
                  <>
                    -{formatPrice(c.value)}
                    <span className="text-sm font-normal text-gray-500 ml-1">fijo</span>
                  </>
                )}
              </div>

              {/* Details */}
              <div className="text-gray-400 text-xs space-y-1.5 flex-1">
                <p>Aplica a: <span className="text-gray-300">{applyLabel(c)}</span></p>
                <p>Días: <span className="text-gray-300">{daysLabel(c.activeDays)}</span></p>
                <p>Horario: <span className="text-gray-300">{timeLabel(c.timeFrom, c.timeTo)}</span></p>
                {c.minOrder > 0 && (
                  <p>Pedido mín: <span className="text-gray-300">{formatPrice(c.minOrder)}</span></p>
                )}
                <p>Vigencia: <span className="text-gray-300">{c.dateFrom || "—"} → {c.dateTo || "—"}</span></p>
                <p>
                  Usos: <span className="text-gray-300">{c.usedCount}</span>
                  {c.maxUses > 0 && <span className="text-gray-500"> / {c.maxUses}</span>}
                  {exhausted && <span className="text-red-400 ml-1 font-semibold">Agotado</span>}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
                <button
                  onClick={() => openEdit(c)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => dispatch({ type: "DELETE_COUPON", payload: c.id })}
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

        {coupons.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No hay cupones creados
          </div>
        )}
      </div>

      {/* ── Modal crear/editar ───────────────── */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={close}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">
                {form.code ? `Editar cupón: ${form.code}` : "Nuevo cupón"}
              </h3>
              <button
                onClick={close}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* ── Código y nombre ───────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Código del cupón</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="DESCUENTO20"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nombre descriptivo</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Cupón de bienvenida"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* ── Tipo y valor ─────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "percentage" | "fixed" }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {form.type === "percentage" ? "Descuento (%)" : "Descuento ($)"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pedido mínimo ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.minOrder}
                    onChange={(e) => setForm((f) => ({ ...f, minOrder: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* ── Usos máximos ─────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Usos máximos</label>
                  <input
                    type="number"
                    min={0}
                    value={form.maxUses}
                    onChange={(e) => setForm((f) => ({ ...f, maxUses: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <p className="text-xs text-gray-600 mt-1">0 = ilimitado</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Usos actuales</label>
                  <input
                    type="number"
                    min={0}
                    value={form.usedCount}
                    onChange={(e) => setForm((f) => ({ ...f, usedCount: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* ── Aplica a ─────────────────── */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Aplica a</label>
                <div className="flex gap-2 mb-3">
                  {(["all", "categories", "products"] as const).map((opt) => {
                    const labels = { all: "Todos", categories: "Categorías", products: "Productos" };
                    return (
                      <button
                        key={opt}
                        onClick={() => setForm((f) => ({ ...f, applyTo: opt, categoryIds: [], productIds: [] }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          form.applyTo === opt
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:text-white"
                        }`}
                      >
                        {labels[opt]}
                      </button>
                    );
                  })}
                </div>

                {/* Category checkboxes */}
                {form.applyTo === "categories" && (
                  <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-lg p-2 space-y-1">
                    {categories
                      .filter((c) => c.id !== "all" && c.id !== "sin-tacc")
                      .map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer py-1 px-2 rounded hover:bg-gray-800"
                        >
                          <input
                            type="checkbox"
                            checked={form.categoryIds.includes(c.id)}
                            onChange={() => toggleCategoryId(c.id)}
                            className="accent-emerald-600"
                          />
                          {c.name}
                        </label>
                      ))}
                  </div>
                )}

                {/* Product checkboxes */}
                {form.applyTo === "products" && (
                  <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-lg p-2 space-y-1">
                    {products.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer py-1 px-2 rounded hover:bg-gray-800"
                      >
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

              {/* ── Vigencia (fechas) ────────── */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Vigencia</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Desde</label>
                    <input
                      type="date"
                      value={form.dateFrom}
                      onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={form.dateTo}
                      onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* ── Días activos ─────────────── */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Días activos <span className="text-xs text-gray-600">(vacío = todos)</span>
                </label>
                <div className="flex gap-2">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`w-10 h-10 rounded-lg text-xs font-semibold transition-colors ${
                        form.activeDays.includes(i)
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-800 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Horario ──────────────────── */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Horario <span className="text-xs text-gray-600">(vacío = todo el día)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Desde</label>
                    <input
                      type="time"
                      value={form.timeFrom}
                      onChange={(e) => setForm((f) => ({ ...f, timeFrom: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                    <input
                      type="time"
                      value={form.timeTo}
                      onChange={(e) => setForm((f) => ({ ...f, timeTo: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* ── Activo toggle ────────────── */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    form.active ? "bg-emerald-600" : "bg-gray-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      form.active ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="sr-only"
                  />
                </div>
                <span className="text-sm text-gray-300">Cupón activo</span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button
                onClick={close}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Guardar cupón
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
