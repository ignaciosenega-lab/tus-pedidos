import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface Promotion {
  id: number;
  branch_id: number;
  name: string;
  percentage: number;
  apply_to_all: number;
  date_from: string;
  date_to: string;
  weekly_repeat: number;
  is_active: number;
  apply_all_branches: number;
  productIds: number[];
  branch_ids: number[];
}

type BranchScope = "this" | "all" | "selected";

interface PromoFormData {
  name: string;
  percentage: number;
  apply_to_all: boolean;
  date_from: string;
  date_to: string;
  weekly_repeat: boolean;
  branch_scope: BranchScope;
  branch_ids: number[];
}

export default function PromotionsPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState<PromoFormData>({
    name: "",
    percentage: 10,
    apply_to_all: true,
    date_from: "",
    date_to: "",
    weekly_repeat: false,
    branch_scope: "this",
    branch_ids: [],
  });

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    loadPromos();
  }, [branchId]);

  async function loadPromos() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<Promotion[]>(`/api/branches/${branchId}/promotions`);
      setPromos(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar promociones");
    } finally {
      setLoading(false);
    }
  }

  function getBranchScope(promo: Promotion): BranchScope {
    if (promo.apply_all_branches) return "all";
    if (promo.branch_ids && promo.branch_ids.length > 0) return "selected";
    return "this";
  }

  function openCreateModal() {
    setEditingPromo(null);
    setFormData({
      name: "",
      percentage: 10,
      apply_to_all: true,
      date_from: "",
      date_to: "",
      weekly_repeat: false,
      branch_scope: "this",
      branch_ids: [],
    });
    setShowModal(true);
  }

  function openEditModal(promo: Promotion) {
    setEditingPromo(promo);
    setFormData({
      name: promo.name,
      percentage: promo.percentage,
      apply_to_all: !!promo.apply_to_all,
      date_from: promo.date_from || "",
      date_to: promo.date_to || "",
      weekly_repeat: !!promo.weekly_repeat,
      branch_scope: getBranchScope(promo),
      branch_ids: promo.branch_ids || [],
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("El nombre es requerido");
      return;
    }

    const payload: any = {
      name: formData.name,
      percentage: formData.percentage,
      apply_to_all: formData.apply_to_all,
      date_from: formData.date_from,
      date_to: formData.date_to,
      weekly_repeat: formData.weekly_repeat,
      apply_all_branches: formData.branch_scope === "all",
      branch_ids: formData.branch_scope === "selected" ? formData.branch_ids : [],
    };

    try {
      setSaving(true);
      if (editingPromo) {
        await apiFetch(`/api/branches/${branchId}/promotions/${editingPromo.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/branches/${branchId}/promotions`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      loadPromos();
    } catch (err: any) {
      alert(err.message || "Error al guardar promoción");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    try {
      await apiFetch(`/api/branches/${branchId}/promotions/${promo.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !promo.is_active }),
      });
      loadPromos();
    } catch (err: any) {
      alert(err.message || "Error al cambiar estado");
    }
  }

  async function deletePromo(promo: Promotion) {
    if (!confirm(`¿Eliminar la promoción "${promo.name}"?`)) return;
    try {
      await apiFetch(`/api/branches/${branchId}/promotions/${promo.id}`, { method: "DELETE" });
      loadPromos();
    } catch (err: any) {
      alert(err.message || "Error al eliminar promoción");
    }
  }

  function getBranchScopeLabel(promo: Promotion): string {
    if (promo.apply_all_branches) return "Todas las sucursales";
    if (promo.branch_ids && promo.branch_ids.length > 0) {
      const names = promo.branch_ids
        .map((bid) => branches.find((b) => b.id === bid)?.name)
        .filter(Boolean);
      return names.length > 0 ? names.join(", ") : `${promo.branch_ids.length} sucursal(es)`;
    }
    return "Solo esta sucursal";
  }

  function toggleBranchSelection(bid: number) {
    setFormData((prev) => {
      const has = prev.branch_ids.includes(bid);
      return {
        ...prev,
        branch_ids: has
          ? prev.branch_ids.filter((id) => id !== bid)
          : [...prev.branch_ids, bid],
      };
    });
  }

  if (branchLoading || loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando promociones...</p>
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
          <h2 className="text-2xl font-bold text-white mb-1">Promociones</h2>
          <p className="text-gray-400">Gestiona las promociones de tu sucursal</p>
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
            + Nueva Promoción
          </button>
        </div>
      </div>

      {promos.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay promociones configuradas</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Descuento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Productos</th>
                {isMaster && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sucursales</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Vigencia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {promos.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{promo.name}</td>
                  <td className="px-4 py-3 text-sm text-emerald-400 font-medium">{promo.percentage}%</td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {promo.apply_to_all ? "Todos" : `${promo.productIds?.length || 0} productos`}
                  </td>
                  {isMaster && (
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">
                      {getBranchScopeLabel(promo)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {promo.date_from && promo.date_to
                      ? `${promo.date_from} → ${promo.date_to}`
                      : promo.weekly_repeat ? "Semanal" : "Sin límite"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(promo)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                        promo.is_active
                          ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}>
                      {promo.is_active ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditModal(promo)}
                        className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                        Editar
                      </button>
                      <button onClick={() => deletePromo(promo)}
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
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
              <h3 className="text-xl font-bold text-white">
                {editingPromo ? "Editar Promoción" : "Nueva Promoción"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input type="text" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Promo 2x1, Descuento fin de semana..." required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descuento (%)</label>
                <input type="number" value={formData.percentage}
                  onChange={(e) => setFormData({ ...formData, percentage: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  min="0" max="100" step="1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Desde</label>
                  <input type="date" value={formData.date_from}
                    onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Hasta</label>
                  <input type="date" value={formData.date_to}
                    onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.apply_to_all}
                    onChange={(e) => setFormData({ ...formData, apply_to_all: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm text-gray-300">Aplicar a todos los productos</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.weekly_repeat}
                    onChange={(e) => setFormData({ ...formData, weekly_repeat: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm text-gray-300">Repetir semanalmente</span>
                </label>
              </div>

              {/* Branch scope selector (master only) */}
              {isMaster && branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sucursales afectadas</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="branch_scope" value="this"
                        checked={formData.branch_scope === "this"}
                        onChange={() => setFormData({ ...formData, branch_scope: "this", branch_ids: [] })}
                        className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                      <span className="text-sm text-gray-300">Solo {branches.find((b) => b.id === branchId)?.name || "esta sucursal"}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="branch_scope" value="all"
                        checked={formData.branch_scope === "all"}
                        onChange={() => setFormData({ ...formData, branch_scope: "all", branch_ids: [] })}
                        className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                      <span className="text-sm text-gray-300">Todas las sucursales</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="branch_scope" value="selected"
                        checked={formData.branch_scope === "selected"}
                        onChange={() => setFormData({ ...formData, branch_scope: "selected" })}
                        className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                      <span className="text-sm text-gray-300">Sucursales específicas</span>
                    </label>
                  </div>

                  {formData.branch_scope === "selected" && (
                    <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 p-3 space-y-2 max-h-40 overflow-y-auto">
                      {branches.map((b) => (
                        <label key={b.id} className="flex items-center gap-2">
                          <input type="checkbox"
                            checked={formData.branch_ids.includes(b.id)}
                            onChange={() => toggleBranchSelection(b.id)}
                            className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-sm text-gray-300">{b.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
                  {saving ? "Guardando..." : editingPromo ? "Guardar Cambios" : "Crear Promoción"}
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
