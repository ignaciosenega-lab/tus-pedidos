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

interface Branch {
  id: number;
  slug: string;
  name: string;
}

interface UserFormData {
  username: string;
  password: string;
  display_name: string;
  role: "master" | "branch_admin" | "staff";
  branch_id: number | null;
}

const ROLE_LABELS = {
  master: "Master",
  branch_admin: "Admin de Sucursal",
  staff: "Personal",
};

export default function AdminUsersPage() {
  const { apiFetch } = useApi();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    password: "",
    display_name: "",
    role: "branch_admin",
    branch_id: null,
  });

  useEffect(() => {
    loadUsers();
    loadBranches();
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

  async function loadBranches() {
    try {
      const data = await apiFetch<Branch[]>("/api/branches");
      setBranches(data);
    } catch {
      // silently fail - branches are optional for form
    }
  }

  function openCreateModal() {
    setEditingUser(null);
    setShowPassword(false);
    setFormData({
      username: "",
      password: "",
      display_name: "",
      role: "branch_admin",
      branch_id: branches.length > 0 ? branches[0].id : null,
    });
    setShowModal(true);
  }

  function openEditModal(user: AdminUser) {
    setEditingUser(user);
    setShowPassword(false);
    setFormData({
      username: user.username,
      password: "",
      display_name: user.display_name,
      role: user.role,
      branch_id: user.branch_id,
    });
    setShowModal(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.username.trim()) {
      alert("El usuario es requerido");
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      alert("La contraseña es requerida");
      return;
    }
    if (formData.role !== "master" && !formData.branch_id) {
      alert("Debe seleccionar una sucursal para este rol");
      return;
    }

    try {
      setSaving(true);
      if (editingUser) {
        const body: Record<string, unknown> = {
          username: formData.username,
          display_name: formData.display_name,
          role: formData.role,
          branch_id: formData.branch_id,
        };
        if (formData.password.trim()) {
          body.password = formData.password;
        }
        await apiFetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/users", {
          method: "POST",
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      alert(err.message || (editingUser ? "Error al actualizar usuario" : "Error al crear usuario"));
    } finally {
      setSaving(false);
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
          onClick={openCreateModal}
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
                        onClick={() => openEditModal(user)}
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

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-lg">
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{editingUser ? "Editar Usuario Admin" : "Nuevo Usuario Admin"}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Usuario <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="usuario123"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Contraseña {!editingUser && <span className="text-red-400">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white focus:outline-none focus:border-emerald-500"
                      placeholder={editingUser ? "Sin cambios" : "••••••••"}
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nombre para mostrar
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Rol <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const role = e.target.value as UserFormData["role"];
                    setFormData({
                      ...formData,
                      role,
                      branch_id: role === "master" ? null : (formData.branch_id || (branches.length > 0 ? branches[0].id : null)),
                    });
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="master">Master (acceso total)</option>
                  <option value="branch_admin">Admin de Sucursal</option>
                  <option value="staff">Personal</option>
                </select>
              </div>

              {formData.role !== "master" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Sucursal <span className="text-red-400">*</span>
                  </label>
                  {branches.length === 0 ? (
                    <p className="text-sm text-yellow-400">No hay sucursales creadas. Crea una primero.</p>
                  ) : (
                    <select
                      value={formData.branch_id || ""}
                      onChange={(e) => setFormData({ ...formData, branch_id: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.slug})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? "Guardando..." : editingUser ? "Guardar Cambios" : "Crear Usuario"}
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
