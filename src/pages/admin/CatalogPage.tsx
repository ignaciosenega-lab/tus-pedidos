import { useRef, useState } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import type { AdminProduct, Topping } from "../../types";
import { formatPrice } from "../../utils/money";
import { parseMenuCsv, type CsvImportResult } from "../../utils/csvMenuParser";

const EMPTY_PRODUCT: AdminProduct = {
  id: "",
  name: "",
  description: "",
  categoryId: "",
  imageUrl: "",
  type: "simple",
  basePrice: 0,
  stock: 0,
  variants: [],
  badges: [],
  status: "alta",
  featured: false,
  private: false,
  gallery: [],
  toppings: [],
};

export default function CatalogPage() {
  const { products, categories } = useAdmin();
  const dispatch = useAdminDispatch();

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "alta" | "baja">("all");
  const [editing, setEditing] = useState<AdminProduct | null>(null);

  /* ── CSV Import ──────────────────────────── */
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<CsvImportResult | null>(null);

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = parseMenuCsv(text, categories);
      setCsvPreview(result);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function confirmCsvImport() {
    if (!csvPreview) return;
    dispatch({
      type: "IMPORT_CSV",
      payload: {
        products: csvPreview.products,
        categories: csvPreview.categories,
      },
    });
    setCsvPreview(null);
  }

  /* ── Filtered list ─────────────────────────── */
  const filtered = products.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterCat !== "all" && p.categoryId !== filterCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  /* ── Form state ────────────────────────────── */
  const [form, setForm] = useState<AdminProduct>(EMPTY_PRODUCT);

  function openNew() {
    setForm({ ...EMPTY_PRODUCT, id: `prod-${Date.now()}` });
    setEditing({} as AdminProduct);
  }

  function openEdit(p: AdminProduct) {
    setForm({ ...p });
    setEditing(p);
  }

  function closeForm() {
    setEditing(null);
  }

  function saveProduct() {
    if (!form.name.trim()) return;
    dispatch({ type: "UPSERT_PRODUCT", payload: form });
    closeForm();
  }

  function addTopping() {
    const t: Topping = { id: `top-${Date.now()}`, name: "", price: 0 };
    setForm((f) => ({ ...f, toppings: [...f.toppings, t] }));
  }

  function updateTopping(idx: number, field: keyof Topping, value: string | number) {
    setForm((f) => ({
      ...f,
      toppings: f.toppings.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    }));
  }

  function removeTopping(idx: number) {
    setForm((f) => ({ ...f, toppings: f.toppings.filter((_, i) => i !== idx) }));
  }

  /* ── Category name helper ──────────────────── */
  function catName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? id;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Catálogo de productos</h2>
        <div className="flex gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvFile}
            className="hidden"
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar CSV
          </button>
          <button
            onClick={openNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            + Nuevo producto
          </button>
        </div>
      </div>

      {/* Filters */}
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
          {categories
            .filter((c) => c.id !== "all")
            .map((c) => (
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

      {/* Table */}
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
                  p.type === "simple" ? p.basePrice ?? 0 : p.variants?.[0]?.price ?? 0;
                const stockDisplay =
                  p.type === "simple"
                    ? `${p.stock ?? 0}`
                    : p.variants?.map((v) => `${v.label}:${v.stock}`).join(", ") ?? "-";
                return (
                  <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{p.name}</p>
                          <p className="text-gray-500 text-xs truncate sm:hidden">{catName(p.categoryId)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{catName(p.categoryId)}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">{formatPrice(price)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{stockDisplay}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => dispatch({ type: "TOGGLE_PRODUCT_STATUS", payload: p.id })}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.status === "alta"
                            ? "bg-emerald-900/40 text-emerald-400"
                            : "bg-red-900/40 text-red-400"
                        }`}
                      >
                        {p.status.toUpperCase()}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-center">
                      {p.featured && <span className="text-yellow-400 text-base">&#9733;</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-gray-400 hover:text-white transition-colors mr-2"
                        title="Editar"
                      >
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => dispatch({ type: "DELETE_PRODUCT", payload: p.id })}
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

      {/* ── CSV Preview Modal ──────────────────── */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setCsvPreview(null)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-white">Vista previa del CSV</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {csvPreview.rowCount} productos encontrados
                  {csvPreview.categories.length > 0 && (
                    <> &middot; {csvPreview.categories.length} categorías nuevas</>
                  )}
                </p>
              </div>
              <button onClick={() => setCsvPreview(null)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            {/* New categories */}
            {csvPreview.categories.length > 0 && (
              <div className="px-5 pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Categorías nuevas a crear</p>
                <div className="flex flex-wrap gap-2">
                  {csvPreview.categories.map((c) => (
                    <span key={c.id} className="bg-emerald-900/40 text-emerald-400 text-xs px-2.5 py-1 rounded-full">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Product list */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Precio / Variantes</th>
                      <th className="px-3 py-2">Foto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {csvPreview.products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-800/40">
                        <td className="px-3 py-2">
                          <p className="text-white font-medium text-xs">{p.name}</p>
                          {p.description && (
                            <p className="text-gray-500 text-xs truncate max-w-[200px]">{p.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{p.categoryId}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.type === "simple"
                              ? "bg-blue-900/40 text-blue-400"
                              : "bg-purple-900/40 text-purple-400"
                          }`}>
                            {p.type === "simple" ? "Simple" : "Variantes"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.type === "simple" ? (
                            <span className="text-emerald-400">{formatPrice(p.basePrice ?? 0)}</span>
                          ) : (
                            <div className="space-y-0.5">
                              {(p.variants ?? []).map((v) => (
                                <div key={v.id} className="text-gray-300">
                                  <span className="text-gray-500">{v.label}</span>{" "}
                                  <span className="text-emerald-400">{formatPrice(v.price)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!p.imageUrl.includes("placehold") ? (
                            <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <span className="text-gray-600 text-xs">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button
                onClick={() => setCsvPreview(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCsvImport}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Importar {csvPreview.rowCount} productos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit / Create Modal ──────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeForm}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">
                {form.id.startsWith("prod-") ? "Nuevo producto" : "Editar producto"}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                />
              </div>

              {/* Category + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Categoría</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="">Seleccionar</option>
                    {categories
                      .filter((c) => c.id !== "all")
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "simple" | "options" }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="simple">Agregar directo</option>
                    <option value="options">Con opciones/variantes</option>
                  </select>
                </div>
              </div>

              {/* Price + Stock (simple) */}
              {form.type === "simple" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Precio</label>
                    <input
                      type="number"
                      value={form.basePrice ?? 0}
                      onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Stock</label>
                    <input
                      type="number"
                      value={form.stock ?? 0}
                      onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              )}

              {/* Variants (options) */}
              {form.type === "options" && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Variantes</label>
                  <div className="space-y-2">
                    {(form.variants ?? []).map((v, i) => (
                      <div key={v.id} className="flex gap-2 items-center">
                        <input
                          value={v.label}
                          placeholder="Label (x5)"
                          onChange={(e) => {
                            const variants = [...(form.variants ?? [])];
                            variants[i] = { ...v, label: e.target.value };
                            setForm((f) => ({ ...f, variants }));
                          }}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <input
                          type="number"
                          value={v.price}
                          placeholder="Precio"
                          onChange={(e) => {
                            const variants = [...(form.variants ?? [])];
                            variants[i] = { ...v, price: Number(e.target.value) };
                            setForm((f) => ({ ...f, variants }));
                          }}
                          className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <input
                          type="number"
                          value={v.stock}
                          placeholder="Stock"
                          onChange={(e) => {
                            const variants = [...(form.variants ?? [])];
                            variants[i] = { ...v, stock: Number(e.target.value) };
                            setForm((f) => ({ ...f, variants }));
                          }}
                          className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <button
                          onClick={() => setForm((f) => ({ ...f, variants: (f.variants ?? []).filter((_, j) => j !== i) }))}
                          className="text-red-400 hover:text-red-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        variants: [...(f.variants ?? []), { id: `v-${Date.now()}`, label: "", price: 0, stock: 0 }],
                      }))
                    }
                    className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                  >
                    + Agregar variante
                  </button>
                </div>
              )}

              {/* Image */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Imagen del producto</label>
                <div className="flex gap-3 items-start">
                  {/* Preview */}
                  {form.imageUrl && (
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-700"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      value={form.imageUrl}
                      onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      placeholder="URL de imagen (https://...)"
                    />
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors w-fit">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Subir imagen
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const token = localStorage.getItem("tuspedidos_token");
                          if (!token) return;
                          const fd = new FormData();
                          fd.append("image", file);
                          try {
                            const res = await fetch("/api/upload", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                              body: fd,
                            });
                            if (res.ok) {
                              const { url } = await res.json();
                              setForm((f) => ({ ...f, imageUrl: url }));
                            }
                          } catch { /* ignore */ }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Badges + Flags */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.badges?.includes("sin_tacc") ?? false}
                    onChange={(e) => {
                      const has = form.badges?.includes("sin_tacc");
                      const badges = e.target.checked
                        ? [...(form.badges ?? []), "sin_tacc" as const]
                        : (form.badges ?? []).filter((b) => b !== "sin_tacc");
                      setForm((f) => ({ ...f, badges: has && !e.target.checked ? badges : badges }));
                    }}
                    className="accent-emerald-600"
                  />
                  Sin TACC
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.badges?.includes("nuevo") ?? false}
                    onChange={(e) => {
                      const badges = e.target.checked
                        ? [...(form.badges ?? []), "nuevo" as const]
                        : (form.badges ?? []).filter((b) => b !== "nuevo");
                      setForm((f) => ({ ...f, badges }));
                    }}
                    className="accent-emerald-600"
                  />
                  Nuevo
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                    className="accent-yellow-500"
                  />
                  Destacado
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.private}
                    onChange={(e) => setForm((f) => ({ ...f, private: e.target.checked }))}
                    className="accent-gray-500"
                  />
                  Privado
                </label>
              </div>

              {/* Toppings */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Opciones / Toppings</label>
                <div className="space-y-2">
                  {form.toppings.map((t, i) => (
                    <div key={t.id} className="flex gap-2 items-center">
                      <input
                        value={t.name}
                        placeholder="Nombre"
                        onChange={(e) => updateTopping(i, "name", e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <input
                        type="number"
                        value={t.price}
                        placeholder="Precio"
                        onChange={(e) => updateTopping(i, "price", Number(e.target.value))}
                        className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button onClick={() => removeTopping(i)} className="text-red-400 hover:text-red-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addTopping} className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
                  + Agregar topping
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button onClick={closeForm} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={saveProduct} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
