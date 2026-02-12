import { useState } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import type { UserStatus, AppUser } from "../../types";
import { formatPrice } from "../../utils/money";

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: "activo", label: "Activo", color: "bg-emerald-900/40 text-emerald-400" },
  { value: "inactivo", label: "Inactivo", color: "bg-yellow-900/40 text-yellow-400" },
  { value: "bloqueado", label: "Bloqueado", color: "bg-red-900/40 text-red-400" },
];

export default function UsersPage() {
  const { users } = useAdmin();
  const dispatch = useAdminDispatch();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | UserStatus>("all");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const filtered = users.filter((u) => {
    if (filterStatus !== "all" && u.status !== filterStatus) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  /* CRM metrics */
  const totalClients = users.length;
  const activeClients = users.filter((u) => u.status === "activo").length;
  const totalRevenue = users.reduce((sum, u) => sum + u.totalSpent, 0);

  function statusBadge(status: UserStatus) {
    const opt = STATUS_OPTIONS.find((s) => s.value === status)!;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${opt.color}`}>
        {opt.label}
      </span>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Gestión de clientes</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total clientes</p>
          <p className="text-white text-2xl font-bold">{totalClients}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Clientes activos</p>
          <p className="text-emerald-400 text-2xl font-bold">{activeClients}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Facturación total</p>
          <p className="text-emerald-400 text-2xl font-bold">{formatPrice(totalRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | UserStatus)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          <option value="all">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="bloqueado">Bloqueados</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 hidden sm:table-cell">Teléfono</th>
                <th className="px-4 py-3 hidden md:table-cell">Total gastado</th>
                <th className="px-4 py-3 hidden md:table-cell">Último pedido</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{u.name}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{u.phone}</td>
                  <td className="px-4 py-3 text-emerald-400 font-medium hidden md:table-cell">
                    {formatPrice(u.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {u.lastOrderDate ?? "-"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="text-gray-400 hover:text-white transition-colors mr-2"
                      title="Ver perfil"
                    >
                      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── User detail modal ────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Perfil del cliente</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{selectedUser.name}</p>
                  <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Teléfono</p>
                  <p className="text-white">{selectedUser.phone}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Registrado</p>
                  <p className="text-white">{selectedUser.registeredAt}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Total gastado</p>
                  <p className="text-emerald-400 font-bold">{formatPrice(selectedUser.totalSpent)}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Último pedido</p>
                  <p className="text-white">{selectedUser.lastOrderDate ?? "Nunca"}</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3 text-sm">
                <p className="text-gray-500 text-xs mb-1">Dirección</p>
                <p className="text-white">{selectedUser.address}</p>
              </div>

              {/* Status change */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Estado del cliente</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        dispatch({ type: "UPDATE_USER_STATUS", payload: { id: selectedUser.id, status: opt.value } });
                        setSelectedUser({ ...selectedUser, status: opt.value });
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                        selectedUser.status === opt.value
                          ? `${opt.color} border-transparent`
                          : "border-gray-700 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
