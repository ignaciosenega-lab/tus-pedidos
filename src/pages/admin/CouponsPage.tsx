import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface Coupon {
  id: number;
  branch_id: number;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  apply_to: string;
  categoryIds: number[];
  productIds: number[];
  first_purchase_only: number;
  active_days: number[];
  time_from: string;
  time_to: string;
  date_from: string;
  date_to: string;
  is_active: number;
  apply_all_branches: number;
  branch_ids: number[];
}

interface CatalogCategory {
  id: number;
  name: string;
}

interface CatalogProduct {
  id: number;
  name: string;
  category_id: number;
}

type ApplyTo = "all" | "categories" | "products";
type BranchScope = "this" | "all" | "selected";

interface CouponFormData {
  code: string;
  name: string;
  type: string;
  value: number;
  min_order: number;
  max_uses: number;
  apply_to: ApplyTo;
  categoryIds: number[];
  productIds: number[];
  first_purchase_only: boolean;
  date_from: string;
  date_to: string;
  branch_scope: BranchScope;
  branch_ids: number[];
}

export default function CouponsPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [formData, setFormData] = useState<CouponFormData>({
    code: "",
    name: "",
    type: "percentage",
    value: 10,
    min_order: 0,
    max_uses: 0,
    apply_to: "all",
    categoryIds: [],
    productIds: [],
    first_purchase_only: false,
    date_from: "",
    date_to: "",
    branch_scope: "this",
    branch_ids: [],
  });

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    loadCoupons();
  }, [branchId]);

  async function loadCoupons() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<Coupon[]>(`/api/branches/${branchId}/coupons`);
      setCoupons(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar cupones");
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalog() {
    if (catalogLoaded) return;
    try {
      const [cats, prods] = await Promise.all([
        apiFetch<CatalogCategory[]>("/api/catalog/categories"),
        apiFetch<CatalogProduct[]>("/api/catalog/products"),
      ]);
      setCategories(cats);
      setProducts(prods);
      setCatalogLoaded(true);
    } catch {
      // silently fail
    }
  }

  function getBranchScope(coupon: Coupon): BranchScope {
    if (coupon.apply_all_branches) return "all";
    if (coupon.branch_ids && coupon.branch_ids.length > 0) return "selected";
    return "this";
  }

  function openCreateModal() {
    loadCatalog();
    setEditingCoupon(null);
    setFormData({
      code: "",
      name: "",
      type: "percentage",
      value: 10,
      min_order: 0,
      max_uses: 0,
      apply_to: "all",
      categoryIds: [],
      productIds: [],
      first_purchase_only: false,
      date_from: "",
      date_to: "",
      branch_scope: "this",
      branch_ids: [],
    });
    setShowModal(true);
  }

  function openEditModal(coupon: Coupon) {
    loadCatalog();
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      min_order: coupon.min_order,
      max_uses: coupon.max_uses,
      apply_to: (coupon.apply_to || "all") as ApplyTo,
      categoryIds: coupon.categoryIds || [],
      productIds: coupon.productIds || [],
      first_purchase_only: !!coupon.first_purchase_only,
      date_from: coupon.date_from || "",
      date_to: coupon.date_to || "",
      branch_scope: getBranchScope(coupon),
      branch_ids: coupon.branch_ids || [],
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.code.trim()) {
      alert("El código es requerido");
      return;
    }

    const payload: any = {
      code: formData.code,
      name: formData.name,
      type: formData.type,
      value: formData.value,
      min_order: formData.min_order,
      max_uses: formData.max_uses,
      apply_to: formData.apply_to,
      categoryIds: formData.apply_to === "categories" ? formData.categoryIds : [],
      productIds: formData.apply_to === "products" ? formData.productIds : [],
      first_purchase_only: formData.first_purchase_only,
      date_from: formData.date_from,
      date_to: formData.date_to,
      apply_all_branches: formData.branch_scope === "all",
      branch_ids: formData.branch_scope === "selected" ? formData.branch_ids : [],
    };

    try {
      setSaving(true);
      if (editingCoupon) {
        await apiFetch(`/api/branches/${branchId}/coupons/${editingCoupon.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/branches/${branchId}/coupons`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      loadCoupons();
    } catch (err: any) {
      alert(err.message || "Error al guardar cupón");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await apiFetch(`/api/branches/${branchId}/coupons/${coupon.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      loadCoupons();
    } catch (err: any) {
      alert(err.message || "Error al cambiar estado");
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`¿Eliminar el cupón "${coupon.code}"?`)) return;
    try {
      await apiFetch(`/api/branches/${branchId}/coupons/${coupon.id}`, { method: "DELETE" });
      loadCoupons();
    } catch (err: any) {
      alert(err.message || "Error al eliminar cupón");
    }
  }

  function getBranchScopeLabel(coupon: Coupon): string {
    if (coupon.apply_all_branches) return "Todas las sucursales";
    if (coupon.branch_ids && coupon.branch_ids.length > 0) {
      const names = coupon.branch_ids
        .map((bid) => branches.find((b) => b.id === bid)?.name)
        .filter(Boolean);
      return names.length > 0 ? names.join(", ") : `${coupon.branch_ids.length} sucursal(es)`;
    }
    return "Solo esta sucursal";
  }

  function getApplyToLabel(coupon: Coupon): string {
    if (coupon.apply_to === "categories") {
      const count = coupon.categoryIds?.length || 0;
      return `${count} categoría${count !== 1 ? "s" : ""}`;
    }
    if (coupon.apply_to === "products") {
      const count = coupon.productIds?.length || 0;
      return `${count} producto${count !== 1 ? "s" : ""}`;
    }
    return "Todos";
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

  function toggleCategorySelection(cid: number) {
    setFormData((prev) => {
      const has = prev.categoryIds.includes(cid);
      return {
        ...prev,
        categoryIds: has
          ? prev.categoryIds.filter((id) => id !== cid)
          : [...prev.categoryIds, cid],
      };
    });
  }

  function toggleProductSelection(pid: number) {
    setFormData((prev) => {
      const has = prev.productIds.includes(pid);
      return {
        ...prev,
        productIds: has
          ? prev.productIds.filter((id) => id !== pid)
          : [...prev.productIds, pid],
      };
    });
  }

  if (branchLoading || loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando cupones...</p>
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
          <h2 className="text-2xl font-bold text-white mb-1">Cupones</h2>
          <p className="text-gray-400">Gestiona los cupones de descuento</p>
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
            + Nuevo Cupón
          </button>
        </div>
      </div>

      {coupons.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay cupones configurados</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Descuento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Aplica a</th>
                {isMaster && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sucursales</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Vigencia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-block bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm text-emerald-400 font-mono font-medium">
                      {coupon.code}
                    </span>
                    {!!coupon.first_purchase_only && (
                      <span className="ml-2 inline-block bg-purple-900/30 text-purple-400 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        1ra compra
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">{coupon.name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-emerald-400 font-medium">
                    {coupon.type === "percentage" ? `${coupon.value}%` : `$${coupon.value.toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{getApplyToLabel(coupon)}</td>
                  {isMaster && (
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">
                      {getBranchScopeLabel(coupon)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {coupon.used_count}{coupon.max_uses > 0 ? ` / ${coupon.max_uses}` : " / \u221E"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {coupon.date_from && coupon.date_to
                      ? `${coupon.date_from} \u2192 ${coupon.date_to}`
                      : "Sin límite"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(coupon)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                        coupon.is_active
                          ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}>
                      {coupon.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditModal(coupon)}
                        className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                        Editar
                      </button>
                      <button onClick={() => deleteCoupon(coupon)}
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
                {editingCoupon ? "Editar Cupón" : "Nuevo Cupón"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Código <span className="text-red-400">*</span>
                  </label>
                  <input type="text" value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="DESCUENTO10" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                  <input type="text" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Descuento de bienvenida" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <select value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {formData.type === "percentage" ? "Descuento (%)" : "Monto ($)"}
                  </label>
                  <input type="number" value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    min="0" step={formData.type === "percentage" ? "1" : "50"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Pedido mín. ($)</label>
                  <input type="number" value={formData.min_order}
                    onChange={(e) => setFormData({ ...formData, min_order: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    min="0" step="100" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Usos máximos (0 = ilimitado)</label>
                <input type="number" value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  min="0" />
              </div>

              {/* Apply scope */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Aplicar a</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="coupon_apply_to" value="all"
                      checked={formData.apply_to === "all"}
                      onChange={() => setFormData({ ...formData, apply_to: "all", categoryIds: [], productIds: [] })}
                      className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                    <span className="text-sm text-gray-300">Todos los productos</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="coupon_apply_to" value="categories"
                      checked={formData.apply_to === "categories"}
                      onChange={() => setFormData({ ...formData, apply_to: "categories", productIds: [] })}
                      className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                    <span className="text-sm text-gray-300">Categorías específicas</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="coupon_apply_to" value="products"
                      checked={formData.apply_to === "products"}
                      onChange={() => setFormData({ ...formData, apply_to: "products", categoryIds: [] })}
                      className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                    <span className="text-sm text-gray-300">Productos específicos</span>
                  </label>
                </div>

                {formData.apply_to === "categories" && (
                  <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 p-3 space-y-2 max-h-40 overflow-y-auto">
                    {categories.length === 0 ? (
                      <p className="text-sm text-gray-500">No hay categorías</p>
                    ) : (
                      categories.map((cat) => (
                        <label key={cat.id} className="flex items-center gap-2">
                          <input type="checkbox"
                            checked={formData.categoryIds.includes(cat.id)}
                            onChange={() => toggleCategorySelection(cat.id)}
                            className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-sm text-gray-300">{cat.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {formData.apply_to === "products" && (
                  <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 p-3 space-y-2 max-h-48 overflow-y-auto">
                    {products.length === 0 ? (
                      <p className="text-sm text-gray-500">No hay productos</p>
                    ) : (
                      categories.map((cat) => {
                        const catProducts = products.filter((p) => p.category_id === cat.id);
                        if (catProducts.length === 0) return null;
                        return (
                          <div key={cat.id}>
                            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{cat.name}</p>
                            {catProducts.map((prod) => (
                              <label key={prod.id} className="flex items-center gap-2 ml-2 mb-1">
                                <input type="checkbox"
                                  checked={formData.productIds.includes(prod.id)}
                                  onChange={() => toggleProductSelection(prod.id)}
                                  className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-emerald-600 focus:ring-emerald-500" />
                                <span className="text-sm text-gray-300">{prod.name}</span>
                              </label>
                            ))}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* First purchase only */}
              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox"
                    checked={formData.first_purchase_only}
                    onChange={(e) => setFormData({ ...formData, first_purchase_only: e.target.checked })}
                    className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm text-gray-300 font-medium">Solo primera compra</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  El cupón solo se podrá usar una vez por cliente (se valida por teléfono)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Válido desde</label>
                  <input type="date" value={formData.date_from}
                    onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Válido hasta</label>
                  <input type="date" value={formData.date_to}
                    onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              {/* Branch scope selector (master only) */}
              {isMaster && branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sucursales afectadas</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="coupon_branch_scope" value="this"
                        checked={formData.branch_scope === "this"}
                        onChange={() => setFormData({ ...formData, branch_scope: "this", branch_ids: [] })}
                        className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                      <span className="text-sm text-gray-300">Solo {branches.find((b) => b.id === branchId)?.name || "esta sucursal"}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="coupon_branch_scope" value="all"
                        checked={formData.branch_scope === "all"}
                        onChange={() => setFormData({ ...formData, branch_scope: "all", branch_ids: [] })}
                        className="w-4 h-4 text-emerald-600 bg-gray-800 border-gray-700 focus:ring-emerald-500" />
                      <span className="text-sm text-gray-300">Todas las sucursales</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="coupon_branch_scope" value="selected"
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
                  {saving ? "Guardando..." : editingCoupon ? "Guardar Cambios" : "Crear Cupón"}
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
