import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface Prize {
  id: number;
  branch_id: number;
  label: string;
  type: "percentage" | "fixed";
  value: number;
  max_discount: number;
  min_order: number;
  weight: number;
  color: string;
  sort_order: number;
  is_active: number;
  probability: number;
}

interface BranchWheelConfig {
  wheel_enabled: number;
  wheel_expires_minutes: number;
  wheel_cooldown_hours: number;
}

interface WheelStats {
  spins: number;
  redeemed: number;
  cost: number;
  uniqueCustomers: number;
  redemptionRate: number;
  byPrize: {
    prize_label: string;
    prize_type: string;
    prize_value: number;
    spins: number;
    redeemed: number;
    cost: number;
  }[];
  withWheel: { orders: number; revenue: number; cost: number; aov: number };
  control: { orders: number; revenue: number; aov: number };
}

const EMPTY_FORM = {
  label: "",
  type: "percentage" as "percentage" | "fixed",
  value: 10,
  max_discount: 0,
  min_order: 0,
  weight: 10,
  color: "#10b981",
  sort_order: 0,
};

const money = (n: number) =>
  "$" + Math.round(n || 0).toLocaleString("es-AR");

export default function WheelPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster } = useBranchId();

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [config, setConfig] = useState<BranchWheelConfig>({
    wheel_enabled: 0,
    wheel_expires_minutes: 60,
    wheel_cooldown_hours: 24,
  });
  const [stats, setStats] = useState<WheelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [avgTicket, setAvgTicket] = useState(12000);

  useEffect(() => {
    if (!branchId) { setLoading(false); return; }
    loadAll();
  }, [branchId]);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [p, b, s] = await Promise.all([
        apiFetch<Prize[]>(`/api/branches/${branchId}/wheel-prizes`),
        apiFetch<BranchWheelConfig>(`/api/branches/${branchId}`),
        apiFetch<WheelStats>(`/api/branches/${branchId}/wheel-stats`).catch(() => null),
      ]);
      setPrizes(p);
      setConfig({
        wheel_enabled: b.wheel_enabled ?? 0,
        wheel_expires_minutes: b.wheel_expires_minutes ?? 60,
        wheel_cooldown_hours: b.wheel_cooldown_hours ?? 24,
      });
      if (s) setStats(s);
    } catch (err: any) {
      setError(err.message || "Error al cargar la ruleta");
    } finally {
      setLoading(false);
    }
  }

  // Un gajo solo entra en el sorteo si está activo, tiene peso y tiene valor.
  // Es el mismo filtro que aplica el server.
  const playable = prizes.filter((p) => p.is_active && p.weight > 0 && p.value > 0);

  // Cuánto cuesta, en promedio, cada giro. Es el número que evita cargar un
  // 50% con peso alto sin darse cuenta de lo que implica.
  const expectedCost = playable.reduce((sum, p) => {
    const discount =
      p.type === "percentage"
        ? Math.min(
            (avgTicket * p.value) / 100,
            p.max_discount > 0 ? p.max_discount : Infinity
          )
        : p.value;
    return sum + p.probability * discount;
  }, 0);

  async function saveConfig(next: Partial<BranchWheelConfig>) {
    const merged = { ...config, ...next };
    setConfig(merged);
    try {
      await apiFetch(`/api/branches/${branchId}`, {
        method: "PUT",
        body: JSON.stringify({
          wheel_enabled: !!merged.wheel_enabled,
          wheel_expires_minutes: merged.wheel_expires_minutes,
          wheel_cooldown_hours: merged.wheel_cooldown_hours,
        }),
      });
    } catch (err: any) {
      alert(err.message || "Error al guardar la configuración");
      loadAll();
    }
  }

  async function savePrize() {
    if (!form.label.trim()) return alert("Poné el texto del gajo");
    if (form.value <= 0) return alert("El valor del premio tiene que ser mayor a 0");
    try {
      setSaving(true);
      const url = editing
        ? `/api/branches/${branchId}/wheel-prizes/${editing.id}`
        : `/api/branches/${branchId}/wheel-prizes`;
      await apiFetch(url, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setShowModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.message || "Error al guardar el premio");
    } finally {
      setSaving(false);
    }
  }

  async function togglePrize(p: Prize) {
    try {
      await apiFetch(`/api/branches/${branchId}/wheel-prizes/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      loadAll();
    } catch (err: any) {
      alert(err.message || "Error al cambiar el estado");
    }
  }

  async function deletePrize(p: Prize) {
    if (!confirm(`¿Eliminar el gajo "${p.label}"?`)) return;
    try {
      const r = await apiFetch<{ softDeleted: boolean }>(
        `/api/branches/${branchId}/wheel-prizes/${p.id}`,
        { method: "DELETE" }
      );
      if (r.softDeleted) {
        alert(
          "El premio ya salió sorteado alguna vez, así que se desactivó en vez de borrarse. " +
            "Así los giros viejos y las estadísticas siguen teniendo sentido."
        );
      }
      loadAll();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: prizes.length + 1 });
    setShowModal(true);
  }

  function openEdit(p: Prize) {
    setEditing(p);
    setForm({
      label: p.label,
      type: p.type,
      value: p.value,
      max_discount: p.max_discount,
      min_order: p.min_order,
      weight: p.weight,
      color: p.color,
      sort_order: p.sort_order,
    });
    setShowModal(true);
  }

  const canEnable = playable.length >= 2;

  if (loading) {
    return <div className="p-6 text-gray-400">Cargando…</div>;
  }

  if (!branchId) {
    return (
      <div className="p-6 text-gray-400">
        No hay ninguna sucursal seleccionada.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Ruleta de premios</h2>
          <p className="text-sm text-gray-400 mt-1">
            El cliente gira una vez, justo antes de mandar el pedido, y gana un descuento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && branches.length > 0 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            + Nuevo gajo
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Estado de la ruleta ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-white font-bold">Estado</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-lg">
              Con la ruleta prendida, el botón "Girar y ganar" aparece en el checkout
              solo para los clientes que <strong>no</strong> tienen ya un cupón o una
              promoción aplicada. Nunca se apilan descuentos.
            </p>
          </div>
          <button
            onClick={() => saveConfig({ wheel_enabled: config.wheel_enabled ? 0 : 1 })}
            disabled={!config.wheel_enabled && !canEnable}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              config.wheel_enabled
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            {config.wheel_enabled ? "Activada" : "Desactivada"}
          </button>
        </div>

        {!canEnable && (
          <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 text-amber-300 text-xs">
            Cargá al menos 2 gajos activos con valor y peso mayores a 0 para poder prender la ruleta.
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              El premio vence a los (minutos)
            </label>
            <input
              type="number"
              min={5}
              value={config.wheel_expires_minutes}
              onChange={(e) => setConfig({ ...config, wheel_expires_minutes: Number(e.target.value) })}
              onBlur={() => saveConfig({})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Si el cliente gira y no manda el pedido en ese tiempo, el premio caduca.
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              No vuelve a girar por (horas)
            </label>
            <input
              type="number"
              min={0}
              value={config.wheel_cooldown_hours}
              onChange={(e) => setConfig({ ...config, wheel_cooldown_hours: Number(e.target.value) })}
              onBlur={() => saveConfig({})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Dentro de esta ventana, el mismo celular recibe siempre el premio que ya
              le tocó — aunque refresque, cierre el navegador o borre los datos.
            </p>
          </div>
        </div>
      </div>

      {/* ── Costo esperado ── */}
      {playable.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-white font-bold mb-1">Cuánto te va a costar</h3>
          <p className="text-xs text-gray-400 mb-4">
            Promedio de descuento por cada giro, según los pesos que cargaste.
          </p>
          <div className="flex items-end gap-6 flex-wrap">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ticket promedio</label>
              <input
                type="number"
                value={avgTicket}
                onChange={(e) => setAvgTicket(Number(e.target.value))}
                className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-gray-400">Costo promedio por giro</div>
              <div className="text-2xl font-bold text-white">{money(expectedCost)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Sobre el ticket</div>
              <div
                className={`text-2xl font-bold ${
                  expectedCost / avgTicket > 0.15 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {avgTicket > 0 ? ((expectedCost / avgTicket) * 100).toFixed(1) : "0"}%
              </div>
            </div>
          </div>
          {expectedCost / avgTicket > 0.15 && (
            <div className="mt-4 bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-red-300 text-xs">
              Estás regalando más del 15% del ticket en promedio. Bajá el peso de los
              premios grandes o ponéles un tope en pesos.
            </div>
          )}
        </div>
      )}

      {/* ── Gajos ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h3 className="text-white font-bold">Gajos ({prizes.length})</h3>
        </div>
        {prizes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Todavía no cargaste ningún premio.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  {["Gajo", "Premio", "Tope", "Mínimo", "Peso", "Probabilidad", "Estado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {prizes.map((p) => (
                  <tr key={p.id} className={p.is_active ? "" : "opacity-40"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-white text-sm">{p.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {p.type === "percentage" ? `${p.value}%` : money(p.value)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {p.max_discount > 0 ? money(p.max_discount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {p.min_order > 0 ? money(p.min_order) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.weight}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">
                      {(p.probability * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePrize(p)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          p.is_active
                            ? "bg-emerald-900/50 text-emerald-300"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {p.is_active ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(p)} className="text-blue-400 hover:text-blue-300 text-sm mr-3">
                        Editar
                      </button>
                      <button onClick={() => deletePrize(p)} className="text-red-400 hover:text-red-300 text-sm">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Resultados ── */}
      {stats && stats.spins > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-5">
          <h3 className="text-white font-bold">Resultados</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Giros", value: stats.spins.toLocaleString("es-AR") },
              { label: "Premios usados", value: stats.redeemed.toLocaleString("es-AR") },
              { label: "Tasa de canje", value: `${(stats.redemptionRate * 100).toFixed(0)}%` },
              { label: "Costo real", value: money(stats.cost) },
            ].map((k) => (
              <div key={k.label}>
                <div className="text-xs text-gray-400">{k.label}</div>
                <div className="text-xl font-bold text-white">{k.value}</div>
              </div>
            ))}
          </div>

          {stats.withWheel.orders > 0 && stats.control.orders > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-2">
                Ticket promedio: pedidos con ruleta vs pedidos sin ningún descuento
              </div>
              <div className="flex gap-8">
                <div>
                  <div className="text-xs text-gray-500">Con ruleta ({stats.withWheel.orders})</div>
                  <div className="text-lg font-bold text-emerald-400">{money(stats.withWheel.aov)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Sin descuento ({stats.control.orders})</div>
                  <div className="text-lg font-bold text-gray-300">{money(stats.control.aov)}</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                La comparación es contra pedidos sin ningún descuento a propósito: como la
                ruleta solo se ofrece a esos clientes, compararla contra el total de pedidos
                daría un número engañoso.
              </p>
            </div>
          )}

          {stats.byPrize.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase">
                    <th className="text-left py-2">Premio</th>
                    <th className="text-left py-2">Salió</th>
                    <th className="text-left py-2">Usado</th>
                    <th className="text-left py-2">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {stats.byPrize.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 text-white">{r.prize_label}</td>
                      <td className="py-2 text-gray-300">{r.spins}</td>
                      <td className="py-2 text-gray-300">{r.redeemed}</td>
                      <td className="py-2 text-gray-300">{money(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de alta/edición ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold">{editing ? "Editar gajo" : "Nuevo gajo"}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Texto del gajo</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="10% OFF"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">Es lo que el cliente lee en la ruleta.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="percentage">Porcentaje</option>
                    <option value="fixed">Monto fijo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {form.type === "percentage" ? "Porcentaje" : "Monto en $"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              {form.type === "percentage" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tope en $ (0 = sin tope)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.max_discount}
                    onChange={(e) => setForm({ ...form, max_discount: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Sin tope, un 20% sobre un pedido grande puede costarte mucho más de lo que esperabas.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pedido mínimo en $</label>
                  <input
                    type="number"
                    min={0}
                    value={form.min_order}
                    onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Peso</label>
                  <input
                    type="number"
                    min={0}
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 -mt-2">
                El peso no es un porcentaje: es cuántas "chances" tiene este gajo frente a
                los demás. Si cargás 50, 30 y 20, salen 50%, 30% y 20% de las veces.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Color</label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Orden</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-700 py-2 rounded-lg text-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={savePrize}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-2 rounded-lg text-white text-sm font-medium"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
