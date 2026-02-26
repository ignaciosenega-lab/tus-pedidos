import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";

interface Menu {
  id: number;
  name: string;
  price_rule: "none" | "percentage";
  price_value: number;
  rounding: "none" | "round_10" | "round_50" | "round_100";
  branchCount: number;
}

interface MenuFormData {
  name: string;
  price_rule: "none" | "percentage";
  price_value: number;
  rounding: "none" | "round_10" | "round_50" | "round_100";
}

const ROUNDING_LABELS: Record<string, string> = {
  none: "Sin redondeo",
  round_10: "A $10",
  round_50: "A $50",
  round_100: "A $100",
};

export default function MenusPage() {
  const { apiFetch } = useApi();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState<MenuFormData>({
    name: "",
    price_rule: "none",
    price_value: 0,
    rounding: "none",
  });

  useEffect(() => { loadMenus(); }, []);

  async function loadMenus() {
    try {
      setLoading(true);
      const data = await apiFetch<Menu[]>("/api/menus");
      setMenus(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingMenu(null);
    setFormData({ name: "", price_rule: "none", price_value: 0, rounding: "none" });
    setShowModal(true);
  }

  function openEditModal(menu: Menu) {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      price_rule: menu.price_rule,
      price_value: menu.price_value,
      rounding: menu.rounding,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) { alert("Nombre es requerido"); return; }
    try {
      setSaving(true);
      if (editingMenu) {
        await apiFetch(`/api/menus/${editingMenu.id}`, { method: "PUT", body: JSON.stringify(formData) });
      } else {
        await apiFetch("/api/menus", { method: "POST", body: JSON.stringify(formData) });
      }
      setShowModal(false);
      loadMenus();
    } catch (err: any) {
      alert(err.message || "Error al guardar menú");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(menu: Menu) {
    try {
      await apiFetch(`/api/menus/${menu.id}/duplicate`, { method: "POST" });
      loadMenus();
    } catch (err: any) {
      alert(err.message || "Error al duplicar menú");
    }
  }

  async function handleDelete(menu: Menu) {
    if (!confirm(`¿Eliminar "${menu.name}"?`)) return;
    try {
      await apiFetch(`/api/menus/${menu.id}`, { method: "DELETE" });
      loadMenus();
    } catch (err: any) {
      alert(err.message || "Error al eliminar menú");
    }
  }

  function formatRule(menu: Menu): string {
    if (menu.price_rule === "none") return "Sin ajuste";
    return `+${menu.price_value}%`;
  }

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-gray-400 mt-4">Cargando menús...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Menús</h2>
          <p className="text-gray-400">Listas de precios que se asignan a sucursales</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          + Nuevo Menú
        </button>
      </div>

      {menus.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay menús creados</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Regla</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Redondeo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sucursales</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {menus.map((menu) => (
                <tr key={menu.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{menu.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      menu.price_rule === "none"
                        ? "bg-gray-700 text-gray-300"
                        : "bg-emerald-900/30 text-emerald-400"
                    }`}>
                      {formatRule(menu)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{ROUNDING_LABELS[menu.rounding]}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{menu.branchCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditModal(menu)} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                        Editar
                      </button>
                      <button onClick={() => handleDuplicate(menu)} className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                        Duplicar
                      </button>
                      <button
                        onClick={() => handleDelete(menu)}
                        disabled={menu.branchCount > 0}
                        className={`text-sm font-medium ${
                          menu.branchCount > 0
                            ? "text-gray-600 cursor-not-allowed"
                            : "text-red-400 hover:text-red-300"
                        }`}
                        title={menu.branchCount > 0 ? "No se puede eliminar: tiene sucursales asignadas" : ""}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-lg">
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{editingMenu ? "Editar Menú" : "Nuevo Menú"}</h3>
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
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Menú Interior"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Regla de precio</label>
                <select
                  value={formData.price_rule}
                  onChange={(e) => setFormData({ ...formData, price_rule: e.target.value as any })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="none">Sin ajuste (precios base)</option>
                  <option value="percentage">Porcentaje sobre precio base</option>
                </select>
              </div>

              {formData.price_rule === "percentage" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Porcentaje (%)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+</span>
                    <input
                      type="number"
                      value={formData.price_value}
                      onChange={(e) => setFormData({ ...formData, price_value: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-8 py-2 text-white focus:outline-none focus:border-emerald-500"
                      min={-99}
                      max={999}
                      step={1}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Ej: 25 para +25% sobre el precio base</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Redondeo</label>
                <select
                  value={formData.rounding}
                  onChange={(e) => setFormData({ ...formData, rounding: e.target.value as any })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="none">Sin redondeo</option>
                  <option value="round_10">Redondear a $10</option>
                  <option value="round_50">Redondear a $50</option>
                  <option value="round_100">Redondear a $100</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? "Guardando..." : editingMenu ? "Guardar Cambios" : "Crear Menú"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
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
