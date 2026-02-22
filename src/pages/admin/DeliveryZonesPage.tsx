import { useState, useEffect, useRef } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface DeliveryZone {
  id: number;
  branch_id: number;
  name: string;
  polygon: number[][];
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

const COLOR_PALETTE = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

function parseKml(kmlText: string): { name: string; polygon: number[][] }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, "text/xml");
  const placemarks = doc.querySelectorAll("Placemark");
  const zones: { name: string; polygon: number[][] }[] = [];

  placemarks.forEach((pm) => {
    const nameEl = pm.querySelector("name");
    const coordsEl = pm.querySelector("coordinates");
    if (!coordsEl) return;

    const name = nameEl?.textContent?.trim() || "Zona importada";
    const raw = coordsEl.textContent?.trim() || "";
    const points = raw
      .split(/\s+/)
      .filter(Boolean)
      .map((coord) => {
        const [lng, lat] = coord.split(",").map(Number);
        return [lat, lng];
      })
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

    if (points.length >= 3) {
      zones.push({ name, polygon: points });
    }
  });

  return zones;
}

export default function DeliveryZonesPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState<ZoneFormData>({
    name: "",
    cost: 0,
    color: "#3B82F6",
    is_active: true,
  });

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
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

  async function handleKmlImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const parsed = parseKml(text);

      if (parsed.length === 0) {
        alert("No se encontraron polígonos válidos en el archivo KML.\nAsegurate de que el archivo tenga al menos un polígono con 3 o más puntos.");
        return;
      }

      let created = 0;
      for (let i = 0; i < parsed.length; i++) {
        const zone = parsed[i];
        const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
        await apiFetch(`/api/branches/${branchId}/zones`, {
          method: "POST",
          body: JSON.stringify({
            name: zone.name,
            polygon: zone.polygon,
            cost: 0,
            is_active: true,
            color,
          }),
        });
        created++;
      }

      alert(`Se importaron ${created} zona${created !== 1 ? "s" : ""} correctamente.\nRecordá asignarles un costo de envío.`);
      loadZones();
    } catch (err: any) {
      alert(err.message || "Error al importar archivo KML");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".kml,.xml"
            onChange={handleKmlImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? "Importando..." : "Importar KML"}
          </button>
          <button onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            + Nueva Zona
          </button>
        </div>
      </div>

      {/* KML help */}
      <div className="bg-blue-900/20 border border-blue-900/40 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <p className="text-blue-300 font-medium mb-1">Importar zonas desde Google My Maps</p>
            <ol className="text-blue-400/80 space-y-0.5 list-decimal list-inside">
              <li>Abrí <span className="text-blue-300">Google My Maps</span> y dibujá tus polígonos de zona</li>
              <li>Hacé clic en los 3 puntos del menú y seleccioná <span className="text-blue-300">"Exportar a KML/KMZ"</span></li>
              <li>Elegí <span className="text-blue-300">"Exportar como KML"</span> (no KMZ)</li>
              <li>Subí el archivo .kml con el botón <span className="text-blue-300">"Importar KML"</span></li>
            </ol>
          </div>
        </div>
      </div>

      {zones.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-gray-500 mb-2">No hay zonas de envío configuradas</p>
          <p className="text-gray-600 text-sm">Creá una zona manualmente o importá un archivo KML</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Costo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Color</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Polígono</th>
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
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {zone.polygon && zone.polygon.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 text-xs">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        {zone.polygon.length} puntos
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">Sin polígono</span>
                    )}
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

              {editingZone && editingZone.polygon && editingZone.polygon.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-sm text-gray-400">
                    <span className="text-emerald-400 font-medium">{editingZone.polygon.length} puntos</span> en el polígono
                  </p>
                </div>
              )}

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
