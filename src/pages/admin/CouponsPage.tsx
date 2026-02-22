import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface Coupon {
  id: number;
  branch_id: number;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  apply_to: string;
  active_days: number[];
  time_from: string;
  time_to: string;
  date_from: string;
  date_to: string;
  is_active: number;
}

interface CouponFormData {
  code: string;
  name: string;
  type: string;
  value: number;
  min_order: number;
  max_uses: number;
  apply_to: string;
  date_from: string;
  date_to: string;
}

export default function CouponsPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<CouponFormData>({
    code: "",
    name: "",
    type: "percentage",
    value: 10,
    min_order: 0,
    max_uses: 0,
    apply_to: "all",
    date_from: "",
    date_to: "",
  });

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    loadCoupons();
  }, [branchId]);

  async function loadCoupons() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<Coupon[]>(`/api/branches/${branchId}/coupons`);
      setCoupons(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar cupones");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingCoupon(null);
    setFormData({
      code: "",
      name: "",
      type: "percentage",
      value: 10,
      min_order: 0,
      max_uses: 0,
      apply_to: "all",
      date_from: "",
      date_to: "",
    });
    setShowModal(true);
  }

  function openEditModal(coupon: Coupon) {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      min_order: coupon.min_order,
      max_uses: coupon.max_uses,
      apply_to: coupon.apply_to || "all",
      date_from: coupon.date_from || "",
      date_to: coupon.date_to || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.code.trim()) {
      alert("El código es requerido");
      return;
    }

    try {
      setSaving(true);
      if (editingCoupon) {
        await apiFetch(`/api/branches/${branchId}/coupons/${editingCoupon.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch(`/api/branches/${branchId}/coupons`, {
          method: "POST",
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      loadCoupons();
    } catch (err: any) {
      alert(err.message || "Error al guardar cupón");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await apiFetch(`/api/branches/${branchId}/coupons/${coupon.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      loadCoupons();
    } catch (err: any) {
      alert(err.message || "Error al cambiar estado");
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`¿Eliminar el cupón "${coupon.code}"?`)) return;
    try {
      await apiFetch(`/api/branches/${branchId}/coupons/${coupon.id}`, { method: "DELETE" });
      loadCoupons();
    } catch (err: any) {
      alert(err.message || "Error al eliminar cupón");
    }
  }

  if (branchLoading || loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando cupones...</p>
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

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Cupones</h2>
          <p className="text-gray-400">Gestiona los cupones de descuento</p>
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
          <button onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            + Nuevo Cupón
          </button>
        </div>
      </div>

      {coupons.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay cupones configurados</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Descuento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Vigencia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-block bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm text-emerald-400 font-mono font-medium">
                      {coupon.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">{coupon.name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-emerald-400 font-medium">
                    {coupon.type === "percentage" ? `${coupon.value}%` : `$${coupon.value.toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {coupon.used_count}{coupon.max_uses > 0 ? ` / ${coupon.max_uses}` : " / ∞"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {coupon.date_from && coupon.date_to
                      ? `${coupon.date_from} → ${coupon.date_to}`
                      : "Sin límite"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(coupon)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                        coupon.is_active
                          ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}>
                      {coupon.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditModal(coupon)}
                        className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                        Editar
                      </button>
                      <button onClick={() => deleteCoupon(coupon)}
                        className="text-sm text-red-400 hover:text-red-300 font-medium">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-lg">
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingCoupon ? "Editar Cupón" : "Nuevo Cupón"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Código <span className="text-red-400">*</span>
                  </label>
                  <input type="text" value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="DESCUENTO10" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                  <input type="text" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Descuento de bienvenida" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <select value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {formData.type === "percentage" ? "Descuento (%)" : "Monto ($)"}
                  </label>
                  <input type="number" value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    min="0" step={formData.type === "percentage" ? "1" : "50"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Pedido mín. ($)</label>
                  <input type="number" value={formData.min_order}
                    onChange={(e) => setFormData({ ...formData, min_order: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    min="0" step="100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Usos máximos (0 = ilimitado)</label>
                  <input type="number" value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Aplica a</label>
                  <select value={formData.apply_to}
                    onChange={(e) => setFormData({ ...formData, apply_to: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                    <option value="all">Todo el pedido</option>
                    <option value="delivery">Solo envío</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Válido desde</label>
                  <input type="date" value={formData.date_from}
                    onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Válido hasta</label>
                  <input type="date" value={formData.date_to}
                    onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
                  {saving ? "Guardando..." : editingCoupon ? "Guardar Cambios" : "Crear Cupón"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
