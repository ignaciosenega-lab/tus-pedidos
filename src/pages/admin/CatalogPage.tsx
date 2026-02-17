import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import type { AdminProduct } from "../../types";
import { formatPrice } from "../../utils/money";

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
  toppings: Array<{
    id: number;
    name: string;
    price: number;
  }>;
}

export default function CatalogPage() {
  const { apiFetch } = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "alta" | "baja">("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [error, setError] = useState("");

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        apiFetch<Product[]>("/api/catalog/products"),
        apiFetch<Category[]>("/api/catalog/categories"),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filtered products
  const filtered = products.filter((p) => {
    if (filterStatus !== "all") {
      const isActive = filterStatus === "alta";
      if (p.is_active !== (isActive ? 1 : 0)) return false;
    }
    if (filterCat !== "all" && p.category_id !== Number(filterCat)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Toggle product status
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

  // Delete product
  async function deleteProduct(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await apiFetch(`/api/catalog/products/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Catálogo de productos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => alert("Importar CSV próximamente")}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar CSV
          </button>
          <button
            onClick={() => alert("Crear producto próximamente")}
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
                          <p className="text-white font-medium truncate">{p.name}</p>
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
                        onClick={() => alert("Editar producto próximamente")}
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
    </div>
  );
}
