import { useEffect, useRef, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../store/authContext";
import { useBranchId } from "../../hooks/useBranchId";
import { formatPrice } from "../../utils/money";
import { parseMenuCsv } from "../../utils/csvMenuParser";

interface Category {
  id: number;
  name: string;
  sort_order: number;
  is_active: number;
}

interface Product {
  id: number;
  name: string;
  description: string;
  category_id: number;
  image_url: string;
  type: string;
  base_price: number;
  stock: number | null;
  is_active: number;
  is_featured: number;
  is_private: number;
  badges: string[];
  gallery: string[];
  variants: Array<{
    id: number;
    label: string;
    price: number;
    stock: number | null;
  }>;
  // Menús donde el producto está disponible. Vacío/undefined = todos los menús.
  exclusiveMenuIds?: number[];
  // Branch override fields
  is_available?: number;
  has_override?: boolean;
}

interface MenuOption {
  id: number;
  name: string;
}

export default function CatalogPage() {
  const { user } = useAuth();
  const isMaster = user?.role === "master";

  if (isMaster) {
    return <MasterCatalog />;
  }

  return <BranchCatalog />;
}

/* ══════════════════════════════════════════════════
   MASTER CATALOG — full editing (original behavior)
   ══════════════════════════════════════════════════ */
interface Topping {
  id?: number;
  name: string;
  price: number;
  sort_order?: number;
}

function MasterCatalog() {
  const { apiFetch } = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "alta" | "baja">("all");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [prods, cats, mns] = await Promise.all([
        apiFetch<Product[]>("/api/catalog/products"),
        apiFetch<Category[]>("/api/catalog/categories"),
        apiFetch<MenuOption[]>("/api/menus").catch(() => []),
      ]);
      setProducts(prods);
      setCategories(cats);
      setMenus(mns);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = products.filter((p) => {
    if (filterStatus !== "all") {
      const isActive = filterStatus === "alta";
      if (p.is_active !== (isActive ? 1 : 0)) return false;
    }
    if (filterCat !== "all" && p.category_id !== Number(filterCat)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function toggleStatus(product: Product) {
    try {
      const newStatus = product.is_active ? 0 : 1;
      await apiFetch(`/api/catalog/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: newStatus }),
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: newStatus } : p))
      );
    } catch (err: any) {
      alert("Error al cambiar estado: " + err.message);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await apiFetch(`/api/catalog/products/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  }

  async function saveProduct(data: {
    name: string;
    description: string;
    category_id: number;
    image_url: string;
    type: string;
    base_price: number;
    stock: number | null;
    is_featured: boolean;
    is_private: boolean;
    badges: string[];
    gallery: string[];
    variants: Array<{ label: string; price: number; stock: number | null; sort_order: number }>;
    toppings: Array<{ name: string; price: number; sort_order: number }>;
    exclusiveMenuIds: number[];
  }) {
    setSaving(true);
    try {
      if (editingProduct && editingProduct.id) {
        // Update existing
        const updated = await apiFetch<Product>(`/api/catalog/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? { ...updated, badges: updated.badges || [], gallery: updated.gallery || [], variants: updated.variants || [] } : p)));
      } else {
        // Create new
        const created = await apiFetch<Product>("/api/catalog/products", {
          method: "POST",
          body: JSON.stringify({ ...data, is_active: true }),
        });
        setProducts((prev) => [...prev, { ...created, badges: created.badges || [], gallery: created.gallery || [], variants: created.variants || [] }]);
      }
      setEditingProduct(null);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError("");

    try {
      const text = await file.text();

      // Convert DB categories (numeric id) to the format parseMenuCsv expects (string id)
      const existingCats = categories.map((c) => ({
        id: String(c.id),
        name: c.name,
      }));

      const result = parseMenuCsv(text, existingCats);

      if (result.rowCount === 0) {
        setError("El archivo CSV no contiene productos válidos.");
        return;
      }

      // Auto-snapshot pre import: si algo del CSV sale mal, queda fácil
      // restaurar desde Versiones. Falla silenciosa: si el endpoint no está
      // disponible (deploy viejo), seguimos.
      try {
        await apiFetch("/api/snapshots/auto?reason=csv-import", { method: "POST" });
      } catch {
        /* no rompemos el import si el snapshot falla */
      }

      // 1) Create new categories and build a map: csvStringId → numeric DB id
      const catIdMap = new Map<string, number>();

      // Map existing categories by name (lowercase) to their numeric id
      for (const c of categories) {
        catIdMap.set(c.name.toLowerCase(), c.id);
      }

      for (const newCat of result.categories) {
        const created = await apiFetch<{ id: number; name: string }>(
          "/api/catalog/categories",
          {
            method: "POST",
            body: JSON.stringify({ name: newCat.name }),
          }
        );
        catIdMap.set(newCat.name.toLowerCase(), created.id);
      }

      // 2) Create products using numeric category IDs
      let created = 0;
      for (const prod of result.products) {
        // Resolve the category name from the parsed product's categoryId
        const catEntry = [...existingCats, ...result.categories].find(
          (c) => c.id === prod.categoryId
        );
        const numericCatId = catEntry
          ? catIdMap.get(catEntry.name.toLowerCase())
          : undefined;

        if (!numericCatId) continue;

        await apiFetch("/api/catalog/products", {
          method: "POST",
          body: JSON.stringify({
            name: prod.name,
            description: prod.description,
            category_id: numericCatId,
            image_url: prod.imageUrl,
            type: prod.type,
            base_price: prod.basePrice ?? 0,
            stock: prod.stock ?? null,
            badges: prod.badges,
            is_active: prod.status === "alta",
            is_featured: prod.featured,
            is_private: prod.private,
            gallery: prod.gallery,
            variants: (prod.variants ?? []).map((v, i) => ({
              label: v.label,
              price: v.price,
              stock: v.stock ?? null,
              sort_order: i,
            })),
          }),
        });
        created++;
      }

      // 3) Reload catalog data
      await loadData();
      alert(`Importación exitosa: ${created} productos importados.`);
    } catch (err: any) {
      setError("Error al importar CSV: " + err.message);
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-selected
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  function catName(id: number) {
    return categories.find((c) => c.id === id)?.name ?? `Cat ${id}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando catálogo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvImport}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Catálogo Global</h2>
        <div className="flex gap-2">
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? "Importando..." : "Importar CSV"}
          </button>
          <button
            onClick={() => setEditingProduct({ id: 0, name: "", description: "", category_id: categories[0]?.id ?? 0, image_url: "", type: "simple", base_price: 0, stock: null, is_active: 1, is_featured: 0, is_private: 0, badges: [], gallery: [], variants: [] })}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            + Nuevo producto
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | "alta" | "baja")}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          <option value="all">Todos los estados</option>
          <option value="alta">Alta</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 hidden sm:table-cell">Categoría</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3 hidden md:table-cell">Stock</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 hidden md:table-cell">Dest.</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((p) => {
                const price =
                  p.type === "simple" ? p.base_price ?? 0 : p.variants?.[0]?.price ?? 0;
                const stockDisplay =
                  p.type === "simple"
                    ? `${p.stock ?? "∞"}`
                    : p.variants?.map((v) => `${v.label}:${v.stock ?? "∞"}`).join(", ") ?? "-";
                return (
                  <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url || "https://via.placeholder.com/40"}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {p.name}
                            {Array.isArray(p.exclusiveMenuIds) && p.exclusiveMenuIds.length > 0 && (
                              <span
                                className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full align-middle"
                                title={
                                  "Solo en menús: " +
                                  p.exclusiveMenuIds
                                    .map((mid) => menus.find((mm) => mm.id === mid)?.name || `#${mid}`)
                                    .join(", ")
                                }
                              >
                                🔒 {p.exclusiveMenuIds.length === 1
                                  ? menus.find((mm) => mm.id === p.exclusiveMenuIds![0])?.name || "1 menú"
                                  : `${p.exclusiveMenuIds.length} menús`}
                              </span>
                            )}
                          </p>
                          <p className="text-gray-500 text-xs truncate sm:hidden">{catName(p.category_id)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{catName(p.category_id)}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">{formatPrice(price)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{stockDisplay}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.is_active
                            ? "bg-emerald-900/40 text-emerald-400"
                            : "bg-red-900/40 text-red-400"
                        }`}
                      >
                        {p.is_active ? "ALTA" : "BAJA"}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-center">
                      {p.is_featured ? <span className="text-yellow-400 text-base">&#9733;</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingProduct(p)}
                        className="text-gray-400 hover:text-white transition-colors mr-2"
                        title="Editar"
                      >
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          categories={categories}
          menus={menus}
          saving={saving}
          onSave={saveProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PRODUCT EDIT MODAL
   ══════════════════════════════════════════════════ */
function ProductEditModal({
  product,
  categories,
  menus,
  saving,
  onSave,
  onClose,
}: {
  product: Product;
  categories: Category[];
  menus: MenuOption[];
  saving: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const { apiFetch } = useApi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [imageUrl, setImageUrl] = useState(product.image_url);
  const [imageMode, setImageMode] = useState<"url" | "upload">(product.image_url ? "url" : "url");
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState(product.type || "simple");
  const [basePrice, setBasePrice] = useState(product.base_price ?? 0);
  const [stock, setStock] = useState<string>(product.stock != null ? String(product.stock) : "");
  const [isFeatured, setIsFeatured] = useState(!!product.is_featured);
  const [isPrivate, setIsPrivate] = useState(!!product.is_private);
  const [variants, setVariants] = useState<Array<{ label: string; price: number; stock: string }>>(
    product.variants?.map((v) => ({ label: v.label, price: v.price, stock: v.stock != null ? String(v.stock) : "" })) || []
  );
  // Disponibilidad por menú: vacío = "Visible en todos los menús".
  const [exclusiveMenuIds, setExclusiveMenuIds] = useState<number[]>(
    Array.isArray(product.exclusiveMenuIds) ? [...product.exclusiveMenuIds] : []
  );
  const [restrictByMenu, setRestrictByMenu] = useState(
    Array.isArray(product.exclusiveMenuIds) && product.exclusiveMenuIds.length > 0
  );

  const isNew = !product.id;

  function toggleMenuId(id: number) {
    setExclusiveMenuIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return alert("El nombre es requerido");
    onSave({
      name: name.trim(),
      description: description.trim(),
      category_id: categoryId,
      image_url: imageUrl.trim(),
      type,
      base_price: type === "simple" ? basePrice : 0,
      stock: type === "simple" && stock !== "" ? Number(stock) : null,
      is_featured: isFeatured,
      is_private: isPrivate,
      badges: product.badges || [],
      gallery: product.gallery || [],
      variants: type === "options" ? variants.map((v, i) => ({
        label: v.label,
        price: v.price,
        stock: v.stock !== "" ? Number(v.stock) : null,
        sort_order: i,
      })) : [],
      toppings: [],
      // [] = visible para todas las sucursales (global).
      // [menuIds] = solo en sucursales con ese branches.menu_id.
      exclusiveMenuIds: restrictByMenu ? exclusiveMenuIds : [],
    });
  }

  function addVariant() {
    setVariants([...variants, { label: "", price: 0, stock: "" }]);
  }

  function removeVariant(idx: number) {
    setVariants(variants.filter((_, i) => i !== idx));
  }

  function updateVariant(idx: number, field: string, value: any) {
    setVariants(variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await apiFetch<{ url: string }>("/api/upload", {
        method: "POST",
        body: formData,
        rawBody: true,
      });
      setImageUrl(res.url);
    } catch (err: any) {
      alert("Error al subir imagen: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600";
  const labelClass = "block text-gray-400 text-xs font-semibold mb-1";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 mb-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">{isNew ? "Nuevo producto" : "Editar producto"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className={labelClass}>Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Nombre del producto" />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass + " h-20 resize-none"} placeholder="Descripción opcional" />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Categoría *</label>
            <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={inputClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Image */}
          <div>
            <label className={labelClass}>Imagen</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setImageMode("url")} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${imageMode === "url" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                URL
              </button>
              <button type="button" onClick={() => setImageMode("upload")} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${imageMode === "upload" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                Subir archivo
              </button>
            </div>
            {imageMode === "url" ? (
              <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} placeholder="https://..." />
            ) : (
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full bg-gray-800 border border-gray-700 border-dashed rounded-lg px-3 py-4 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
                >
                  {uploading ? "Subiendo..." : "Seleccionar imagen..."}
                </button>
              </div>
            )}
            {imageUrl && (
              <div className="mt-2 flex items-center gap-3">
                <img src={imageUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                <span className="text-gray-500 text-xs truncate flex-1">{imageUrl}</span>
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <label className={labelClass}>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              <option value="simple">Simple</option>
              <option value="options">Con variantes</option>
            </select>
          </div>

          {/* Simple: price + stock */}
          {type === "simple" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Precio</label>
                <input type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Stock (vacío = ilimitado)</label>
                <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} placeholder="∞" />
              </div>
            </div>
          )}

          {/* Variable: variants */}
          {type === "options" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + " mb-0"}>Variantes</label>
                <button type="button" onClick={addVariant} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">+ Agregar variante</button>
              </div>
              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <input type="text" placeholder="Etiqueta (ej: x5, x10)" value={v.label} onChange={(e) => updateVariant(idx, "label", e.target.value)} className={inputClass + " min-w-0"} />
                    <input type="number" step="0.01" placeholder="Precio" value={v.price} onChange={(e) => updateVariant(idx, "price", Number(e.target.value))} className={inputClass + " w-28"} />
                    <input type="number" placeholder="Stock" value={v.stock} onChange={(e) => updateVariant(idx, "stock", e.target.value)} className={inputClass + " w-20"} />
                    <button type="button" onClick={() => removeVariant(idx)} className="text-red-400 hover:text-red-300 text-sm shrink-0">&times;</button>
                  </div>
                ))}
                {variants.length === 0 && <p className="text-gray-500 text-xs">Sin variantes. Agregá al menos una.</p>}
              </div>
            </div>
          )}

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="accent-emerald-500" />
              Destacado
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-emerald-500" />
              Privado
            </label>
          </div>

          {/* Disponibilidad por menú */}
          {menus.length > 0 && (
            <div className="border-t border-gray-800 pt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Disponibilidad por menú
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`restrict-${product.id || "new"}`}
                    checked={!restrictByMenu}
                    onChange={() => setRestrictByMenu(false)}
                    className="mt-1 accent-emerald-500"
                  />
                  <span className="text-white">
                    Visible en todos los menús
                    <span className="block text-xs text-gray-400">
                      Por default. El producto aparece en todas las sucursales.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`restrict-${product.id || "new"}`}
                    checked={restrictByMenu}
                    onChange={() => setRestrictByMenu(true)}
                    className="mt-1 accent-emerald-500"
                  />
                  <span className="text-white">
                    Solo en menús específicos
                    <span className="block text-xs text-gray-400">
                      El producto aparece solo en sucursales con uno de los menús seleccionados.
                    </span>
                  </span>
                </label>
                {restrictByMenu && (
                  <div className="ml-6 mt-2 space-y-1.5 border border-gray-800 rounded-lg p-3 bg-gray-900/50">
                    {menus.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exclusiveMenuIds.includes(m.id)}
                          onChange={() => toggleMenuId(m.id)}
                          className="accent-emerald-500"
                        />
                        {m.name}
                      </label>
                    ))}
                    {exclusiveMenuIds.length === 0 && (
                      <p className="text-xs text-amber-400 mt-2">
                        ⚠ Sin menús seleccionados, el producto no se va a ver en ninguna sucursal.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
              {saving ? "Guardando..." : isNew ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   BRANCH CATALOG — view only + toggle availability
   ══════════════════════════════════════════════════ */
function BranchCatalog() {
  const { apiFetch } = useApi();
  const { branchId, loading: branchLoading } = useBranchId();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "alta" | "baja">("all");
  const [error, setError] = useState("");
  // Productos propios (exclusivos del menú de esta sucursal).
  const [ownProducts, setOwnProducts] = useState<Product[]>([]);
  const [editingOwn, setEditingOwn] = useState<Product | null>(null);
  const [savingOwn, setSavingOwn] = useState(false);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [branchId]);

  async function loadData() {
    try {
      setLoading(true);
      const [cat, own] = await Promise.all([
        apiFetch<{ products: Product[]; categories: Category[] }>(
          `/api/branches/${branchId}/catalog`
        ),
        apiFetch<Product[]>(`/api/branches/${branchId}/own-products`).catch(() => []),
      ]);
      setProducts(cat.products);
      setCategories(cat.categories);
      setOwnProducts(own);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function newOwnProduct(): Product {
    return {
      id: 0,
      name: "",
      description: "",
      category_id: categories[0]?.id ?? 0,
      image_url: "",
      type: "simple",
      base_price: 0,
      stock: null,
      is_active: 1,
      is_featured: 0,
      is_private: 0,
      badges: [],
      gallery: [],
      variants: [],
    };
  }

  async function saveOwnProduct(data: any) {
    setSavingOwn(true);
    try {
      if (editingOwn && editingOwn.id) {
        const updated = await apiFetch<Product>(
          `/api/branches/${branchId}/own-products/${editingOwn.id}`,
          { method: "PUT", body: JSON.stringify(data) }
        );
        setOwnProducts((prev) => prev.map((p) => (p.id === editingOwn.id ? updated : p)));
      } else {
        const created = await apiFetch<Product>(
          `/api/branches/${branchId}/own-products`,
          { method: "POST", body: JSON.stringify({ ...data, is_active: true }) }
        );
        setOwnProducts((prev) => [created, ...prev]);
      }
      setEditingOwn(null);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSavingOwn(false);
    }
  }

  async function deleteOwnProduct(id: number) {
    if (!confirm("¿Eliminar este producto propio? Esta acción no se puede deshacer.")) return;
    try {
      await apiFetch(`/api/branches/${branchId}/own-products/${id}`, { method: "DELETE" });
      setOwnProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  }

  const filtered = products.filter((p) => {
    if (filterStatus !== "all") {
      if (filterStatus === "alta" && !p.is_available) return false;
      if (filterStatus === "baja" && p.is_available) return false;
    }
    if (filterCat !== "all" && p.category_id !== Number(filterCat)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function toggleAvailability(product: Product) {
    try {
      const newAvailable = product.is_available ? 0 : 1;
      await apiFetch(`/api/branches/${branchId}/overrides/products`, {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          is_available: newAvailable,
        }),
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_available: newAvailable, has_override: true } : p
        )
      );
    } catch (err: any) {
      alert("Error al cambiar disponibilidad: " + err.message);
    }
  }

  function catName(id: number) {
    return categories.find((c) => c.id === id)?.name ?? `Cat ${id}`;
  }

  if (branchLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando catálogo...</div>
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
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Catálogo</h2>
          <p className="text-gray-400 text-sm">
            Podés activar o desactivar productos para tu sucursal. Los precios e imágenes se editan desde el catálogo global.
          </p>
        </div>
      </div>

      {/* Productos propios de la sucursal */}
      <div className="mb-8 bg-gray-900 border border-violet-900/40 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🔒 Productos propios
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Items exclusivos de tu sucursal. No los ven otras sucursales.
            </p>
          </div>
          <button
            onClick={() => setEditingOwn(newOwnProduct())}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
          >
            + Nuevo
          </button>
        </div>
        {ownProducts.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            Todavía no tenés productos propios. Crealos con "+ Nuevo".
          </div>
        ) : (
          <div className="space-y-2">
            {ownProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-gray-800/40 rounded-lg p-2.5"
              >
                <img
                  src={p.image_url || "https://via.placeholder.com/40"}
                  alt={p.name}
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {categories.find((c) => c.id === p.category_id)?.name ?? "—"} ·{" "}
                    <span className="text-emerald-400 font-semibold">
                      {formatPrice(p.type === "simple" ? p.base_price : p.variants?.[0]?.price ?? 0)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setEditingOwn(p)}
                  className="text-gray-400 hover:text-white transition-colors p-1.5"
                  title="Editar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteOwnProduct(p.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors p-1.5"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | "alta" | "baja")}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          <option value="all">Todos</option>
          <option value="alta">Disponible</option>
          <option value="baja">No disponible</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 hidden sm:table-cell">Categoría</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((p) => {
                const price =
                  p.type === "simple" ? p.base_price ?? 0 : p.variants?.[0]?.price ?? 0;
                const available = p.is_available !== 0;
                return (
                  <tr key={p.id} className={`hover:bg-gray-800/40 transition-colors ${!available ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url || "https://via.placeholder.com/40"}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{p.name}</p>
                          <p className="text-gray-500 text-xs truncate sm:hidden">{catName(p.category_id)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{catName(p.category_id)}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">{formatPrice(price)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAvailability(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          available
                            ? "bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60"
                            : "bg-red-900/40 text-red-400 hover:bg-red-900/60"
                        }`}
                      >
                        {available ? "DISPONIBLE" : "NO DISPONIBLE"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingOwn && (
        <ProductEditModal
          product={editingOwn}
          categories={categories}
          menus={[]}
          saving={savingOwn}
          onSave={saveOwnProduct}
          onClose={() => setEditingOwn(null)}
        />
      )}
    </div>
  );
}
