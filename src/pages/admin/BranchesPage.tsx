import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";

interface Branch {
  id: number;
  slug: string;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  is_open: number;
  is_active: number;
  created_at: string;
}

export default function BranchesPage() {
  const { apiFetch } = useApi();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, []);

  async function loadBranches() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<Branch[]>("/api/branches");
      setBranches(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar sucursales");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: number, currentActive: number) {
    try {
      await apiFetch(`/api/branches/${id}/toggle`, {
        method: "PATCH",
      });
      loadBranches();
    } catch (err: any) {
      alert(err.message || "Error al cambiar estado");
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando sucursales...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl">
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Sucursales</h2>
          <p className="text-gray-400">Gestiona las sucursales del sistema multi-tenant</p>
        </div>
        <button
          onClick={() => alert("Crear sucursal - próximamente")}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          + Nueva Sucursal
        </button>
      </div>

      {branches.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay sucursales registradas</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Dirección</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Activa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {branches.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300">{branch.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 font-mono">{branch.slug}</td>
                  <td className="px-4 py-3 text-sm text-white font-medium">{branch.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{branch.address || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{branch.phone || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        branch.is_open
                          ? "bg-green-900/30 text-green-400"
                          : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {branch.is_open ? "Abierta" : "Cerrada"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(branch.id, branch.is_active)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                        branch.is_active
                          ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      {branch.is_active ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => alert(`Editar sucursal ${branch.id} - próximamente`)}
                      className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
