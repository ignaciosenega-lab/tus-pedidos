import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";

interface AdminUser {
  id: number;
  username: string;
  role: "master" | "branch_admin" | "staff";
  branch_id: number | null;
  display_name: string;
  is_active: number;
  created_at: string;
}

const ROLE_LABELS = {
  master: "Master",
  branch_admin: "Admin de Sucursal",
  staff: "Personal",
};

export default function AdminUsersPage() {
  const { apiFetch } = useApi();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<AdminUser[]>("/api/users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(userId: number, currentActive: number) {
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: currentActive ? 0 : 1 }),
      });
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Error al cambiar estado");
    }
  }

  async function deleteUser(userId: number, username: string) {
    if (!confirm(`¿Eliminar el usuario "${username}"?`)) return;

    try {
      await apiFetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Error al eliminar usuario");
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando usuarios...</p>
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
          <h2 className="text-2xl font-bold text-white mb-2">Usuarios Admin</h2>
          <p className="text-gray-400">Gestiona los usuarios administradores del sistema</p>
        </div>
        <button
          onClick={() => alert("Crear usuario - próximamente")}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          + Nuevo Usuario
        </button>
      </div>

      {users.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sucursal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300">{user.id}</td>
                  <td className="px-4 py-3 text-sm text-white font-mono">{user.username}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{user.display_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        user.role === "master"
                          ? "bg-purple-900/30 text-purple-400"
                          : user.role === "branch_admin"
                          ? "bg-blue-900/30 text-blue-400"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {user.branch_id ? `#${user.branch_id}` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(user.id, user.is_active)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                        user.is_active
                          ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      {user.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => alert(`Editar usuario ${user.id} - próximamente`)}
                        className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.username)}
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
    </div>
  );
}
