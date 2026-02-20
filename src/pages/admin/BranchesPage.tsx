import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";

interface Branch {
  id: number;
  slug: string;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  is_open: number;
  is_active: number;
  created_at: string;
}

interface BranchFormData {
  slug: string;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  is_open: boolean;
}

export default function BranchesPage() {
  const { apiFetch } = useApi();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<BranchFormData>({
    slug: "",
    name: "",
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    is_open: true,
  });

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

  async function toggleOpen(id: number, currentOpen: number) {
    try {
      await apiFetch(`/api/branches/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_open: !currentOpen }),
      });
      loadBranches();
    } catch (err: any) {
      alert(err.message || "Error al cambiar estado");
    }
  }

  async function deleteBranch(id: number, name: string) {
    if (!confirm(`¿Eliminar la sucursal "${name}"? Se eliminarán todos sus datos asociados.`)) return;
    try {
      await apiFetch(`/api/branches/${id}`, { method: "DELETE" });
      loadBranches();
    } catch (err: any) {
      alert(err.message || "Error al eliminar sucursal");
    }
  }

  function openCreateModal() {
    setFormData({
      slug: "",
      name: "",
      address: "",
      phone: "",
      whatsapp: "",
      email: "",
      is_open: true,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.slug.trim() || !formData.name.trim()) {
      alert("Slug y nombre son requeridos");
      return;
    }

    try {
      setSaving(true);
      await apiFetch("/api/branches", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setShowModal(false);
      loadBranches();
    } catch (err: any) {
      alert(err.message || "Error al crear sucursal");
    } finally {
      setSaving(false);
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
          onClick={openCreateModal}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Abierta</th>
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
                    <button
                      onClick={() => toggleOpen(branch.id, branch.is_open)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        branch.is_open
                          ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                          : "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      }`}
                    >
                      {branch.is_open ? "Abierta" : "Cerrada"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => alert(`Editar sucursal ${branch.id} - próximamente`)}
                        className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteBranch(branch.id, branch.name)}
                        className="text-sm text-red-400 hover:text-red-300 font-medium"
                      >
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

      {/* Create Branch Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Nueva Sucursal</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Slug <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="sucursal-centro"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">URL-friendly (solo minúsculas, números y guiones)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nombre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Sucursal Centro"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Av. Principal 123"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="11 1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="5491123456789"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="sucursal@ejemplo.com"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_open}
                    onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-300">Sucursal abierta</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? "Creando..." : "Crear Sucursal"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
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
