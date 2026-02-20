import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface DeliveryZone {
  id: number;
  branch_id: number;
  name: string;
  polygon: any[];
  cost: number;
  is_active: number;
  color: string;
}

interface ZoneFormData {
  name: string;
  cost: number;
  color: string;
  is_active: boolean;
}

export default function DeliveryZonesPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState<ZoneFormData>({
    name: "",
    cost: 0,
    color: "#3B82F6",
    is_active: true,
  });

  useEffect(() => {
    if (!branchId) return;
    loadZones();
  }, [branchId]);

  async function loadZones() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<DeliveryZone[]>(`/api/branches/${branchId}/zones`);
      setZones(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar zonas");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingZone(null);
    setFormData({ name: "", cost: 0, color: "#3B82F6", is_active: true });
    setShowModal(true);
  }

  function openEditModal(zone: DeliveryZone) {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      cost: zone.cost,
      color: zone.color || "#3B82F6",
      is_active: !!zone.is_active,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("El nombre es requerido");
      return;
    }

    try {
      setSaving(true);
      if (editingZone) {
        await apiFetch(`/api/branches/${branchId}/zones/${editingZone.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch(`/api/branches/${branchId}/zones`, {
          method: "POST",
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      loadZones();
    } catch (err: any) {
      alert(err.message || "Error al guardar zona");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(zone: DeliveryZone) {
    try {
      await apiFetch(`/api/branches/${branchId}/zones/${zone.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !zone.is_active }),
      });
      loadZones();
    } catch (err: any) {
      alert(err.message || "Error al cambiar estado");
    }
  }

  async function deleteZone(zone: DeliveryZone) {
    if (!confirm(`¿Eliminar la zona "${zone.name}"?`)) return;
    try {
      await apiFetch(`/api/branches/${branchId}/zones/${zone.id}`, { method: "DELETE" });
      loadZones();
    } catch (err: any) {
      alert(err.message || "Error al eliminar zona");
    }
  }

  if (branchLoading || loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando zonas de envío...</p>
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
          <h2 className="text-2xl font-bold text-white mb-1">Zonas de Envío</h2>
          <p className="text-gray-400">Gestiona las zonas y costos de envío</p>
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
            + Nueva Zona
          </button>
        </div>
      </div>

      {zones.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay zonas de envío configuradas</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Costo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Color</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {zones.map((zone) => (
                <tr key={zone.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{zone.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">${zone.cost.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded border border-gray-600" style={{ backgroundColor: zone.color }} />
                      <span className="text-xs text-gray-400 font-mono">{zone.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(zone)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                        zone.is_active
                          ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}>
                      {zone.is_active ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditModal(zone)}
                        className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                        Editar
                      </button>
                      <button onClick={() => deleteZone(zone)}
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
                {editingZone ? "Editar Zona" : "Nueva Zona de Envío"}
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
                  placeholder="Zona Centro" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Costo ($)</label>
                  <input type="number" value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    min="0" step="50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-12 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                    <input type="text" value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-gray-300">Zona activa</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
                  {saving ? "Guardando..." : editingZone ? "Guardar Cambios" : "Crear Zona"}
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
