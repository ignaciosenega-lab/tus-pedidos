import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";
import CustomerMapModal from "../../components/CustomerMapModal";

interface AppUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  neighborhood: string;
  order_count: number;
  total_spent: number;
  created_at: string;
  registered_at?: string;
}

export default function UsersPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewAll, setViewAll] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapData, setMapData] = useState<{ customers: any[]; branchAddress: string } | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {
    if (!branchId && !viewAll) {
      setLoading(false);
      return;
    }
    loadUsers();
  }, [branchId, viewAll]);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const effectiveBranchId = branchId || branches[0]?.id;
      if (!effectiveBranchId) return;
      const url = viewAll && isMaster
        ? `/api/branches/${effectiveBranchId}/customers?all=1`
        : `/api/branches/${effectiveBranchId}/customers`;
      const data = await apiFetch<AppUser[]>(url);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }

  async function openMap() {
    const effectiveBranchId = branchId || branches[0]?.id;
    if (!effectiveBranchId) return;
    setMapLoading(true);
    try {
      const data = await apiFetch<{ customers: any[]; branchAddress: string }>(
        `/api/branches/${effectiveBranchId}/customers/map`
      );
      setMapData(data);
      setShowMap(true);
    } catch {
      // silently fail
    } finally {
      setMapLoading(false);
    }
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q)
    );
  });

  if (branchLoading || loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  if (!branchId && !viewAll) {
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
          <h2 className="text-2xl font-bold text-white mb-1">Clientes</h2>
          <p className="text-gray-400">
            {viewAll
              ? `Todos los clientes (${users.length})`
              : `Clientes de ${branches.find((b) => b.id === branchId)?.name || "esta sucursal"} (${users.length})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && branches.length > 0 && (
            <select
              value={viewAll ? "all" : String(branchId)}
              onChange={(e) => {
                if (e.target.value === "all") {
                  setViewAll(true);
                } else {
                  setViewAll(false);
                  setBranchId(Number(e.target.value));
                }
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Map button */}
      <button
        onClick={openMap}
        disabled={mapLoading}
        className="w-full mb-4 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        {mapLoading ? "Cargando mapa..." : "Ver mapa de clientes"}
      </button>

      <div className="mb-4">
        <input type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          placeholder="Buscar por nombre, email o teléfono..." />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">
            {search ? "No se encontraron clientes con ese criterio" : "No hay clientes registrados"}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Dirección</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Barrio</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Compras</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total gastado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{user.name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{user.email || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{user.phone || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">{user.address || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{user.neighborhood || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 text-center">{user.order_count || 0}</td>
                  <td className="px-4 py-3 text-sm text-emerald-400 font-medium">
                    ${user.total_spent ? user.total_spent.toLocaleString("es-AR") : "0"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {(user.registered_at || user.created_at)
                      ? new Date(user.registered_at || user.created_at).toLocaleDateString("es-AR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Map modal */}
      {showMap && mapData && (
        <CustomerMapModal
          customers={mapData.customers}
          branchAddress={mapData.branchAddress}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
