import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";
import type { StyleConfig } from "../../types";

type StyleFormData = Omit<StyleConfig, "fontUrl"> & {
  logo: string;
  favicon: string;
  banners: string[];
};

const DEFAULT_STYLE: StyleFormData = {
  logo: "",
  favicon: "",
  banners: [],
  fontFamily: "system-ui, -apple-system, sans-serif",
  headerBg: "#111827",
  headerText: "#ffffff",
  bodyBg: "#000000",
  panelBg: "#1f2937",
  popupBg: "#111827",
  generalText: "#d1d5db",
  titleText: "#ffffff",
  menuBg: "#111827",
  menuText: "#d1d5db",
  buttonBg: "#10b981",
  buttonText: "#ffffff",
  footerEnabled: false,
  footerBg: "#111827",
  footerText: "#9ca3af",
};

export default function StylesPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<StyleFormData>(DEFAULT_STYLE);
  const [newBanner, setNewBanner] = useState("");

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    loadBranch();
  }, [branchId]);

  async function loadBranch() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<any>(`/api/branches/${branchId}`);
      const sc = typeof data.style_config === "object" && data.style_config ? data.style_config : {};
      setForm({
        logo: data.logo || "",
        favicon: data.favicon || "",
        banners: Array.isArray(data.banners) ? data.banners : [],
        fontFamily: sc.fontFamily || DEFAULT_STYLE.fontFamily,
        headerBg: sc.headerBg || DEFAULT_STYLE.headerBg,
        headerText: sc.headerText || DEFAULT_STYLE.headerText,
        bodyBg: sc.bodyBg || DEFAULT_STYLE.bodyBg,
        panelBg: sc.panelBg || DEFAULT_STYLE.panelBg,
        popupBg: sc.popupBg || DEFAULT_STYLE.popupBg,
        generalText: sc.generalText || DEFAULT_STYLE.generalText,
        titleText: sc.titleText || DEFAULT_STYLE.titleText,
        menuBg: sc.menuBg || DEFAULT_STYLE.menuBg,
        menuText: sc.menuText || DEFAULT_STYLE.menuText,
        buttonBg: sc.buttonBg || DEFAULT_STYLE.buttonBg,
        buttonText: sc.buttonText || DEFAULT_STYLE.buttonText,
        footerEnabled: sc.footerEnabled || false,
        footerBg: sc.footerBg || DEFAULT_STYLE.footerBg,
        footerText: sc.footerText || DEFAULT_STYLE.footerText,
      });
    } catch (err: any) {
      setError(err.message || "Error al cargar diseño");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!branchId) return;
    try {
      setSaving(true);
      setSuccess(false);
      const { logo, favicon, banners, ...styleFields } = form;
      await apiFetch(`/api/branches/${branchId}`, {
        method: "PUT",
        body: JSON.stringify({
          logo,
          favicon,
          banners,
          style_config: styleFields,
        }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function addBanner() {
    if (!newBanner.trim()) return;
    setForm({ ...form, banners: [...form.banners, newBanner.trim()] });
    setNewBanner("");
  }

  function removeBanner(index: number) {
    setForm({ ...form, banners: form.banners.filter((_, i) => i !== index) });
  }

  if (branchLoading || loading) {
    return (
      <div className="max-w-4xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando diseño...</p>
        </div>
      </div>
    );
  }

  if (!branchId) {
    return (
      <div className="max-w-4xl">
        <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-4 text-yellow-400">
          No hay sucursal asignada. Contacta al administrador master.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-red-400">{error}</div>
      </div>
    );
  }

  const colorSections: { title: string; fields: { key: keyof StyleFormData; label: string }[] }[] = [
    {
      title: "Header",
      fields: [
        { key: "headerBg", label: "Fondo" },
        { key: "headerText", label: "Texto" },
      ],
    },
    {
      title: "Cuerpo / Fondo",
      fields: [
        { key: "bodyBg", label: "Fondo general" },
        { key: "generalText", label: "Texto general" },
        { key: "titleText", label: "Títulos" },
      ],
    },
    {
      title: "Paneles y Modales",
      fields: [
        { key: "panelBg", label: "Fondo de tarjetas" },
        { key: "popupBg", label: "Fondo de modales" },
      ],
    },
    {
      title: "Menú de categorías",
      fields: [
        { key: "menuBg", label: "Fondo" },
        { key: "menuText", label: "Texto" },
      ],
    },
    {
      title: "Botones",
      fields: [
        { key: "buttonBg", label: "Fondo" },
        { key: "buttonText", label: "Texto" },
      ],
    },
    {
      title: "Footer",
      fields: [
        { key: "footerBg", label: "Fondo" },
        { key: "footerText", label: "Texto" },
      ],
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Diseño</h2>
          <p className="text-gray-400">Personaliza la apariencia de la tienda</p>
        </div>
        {isMaster && branches.length > 0 && (
          <select value={branchId}
            onChange={(e) => setBranchId(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {success && (
        <div className="bg-emerald-900/20 border border-emerald-900/50 rounded-lg p-3 text-emerald-400 text-sm">
          Diseño guardado correctamente
        </div>
      )}

      {/* Logo y Favicon */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Logo y Favicon</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">URL del Logo</label>
            <input type="text" value={form.logo}
              onChange={(e) => setForm({ ...form, logo: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="https://..." />
            {form.logo && (
              <img src={form.logo} alt="Logo preview" className="mt-2 h-12 object-contain rounded bg-gray-800 p-1" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">URL del Favicon</label>
            <input type="text" value={form.favicon}
              onChange={(e) => setForm({ ...form, favicon: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="https://..." />
            {form.favicon && (
              <img src={form.favicon} alt="Favicon preview" className="mt-2 h-8 object-contain rounded bg-gray-800 p-1" />
            )}
          </div>
        </div>
      </div>

      {/* Banners */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Banners</h3>

        {form.banners.length > 0 && (
          <div className="space-y-2">
            {form.banners.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <img src={url} alt={`Banner ${i + 1}`} className="h-10 w-20 object-cover rounded bg-gray-800" />
                <span className="flex-1 text-sm text-gray-400 truncate">{url}</span>
                <button onClick={() => removeBanner(i)}
                  className="text-red-400 hover:text-red-300 text-sm font-medium">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input type="text" value={newBanner}
            onChange={(e) => setNewBanner(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBanner())}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            placeholder="URL de imagen del banner" />
          <button onClick={addBanner}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
            Agregar
          </button>
        </div>
      </div>

      {/* Fuente */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Tipografía</h3>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Fuente personalizada</label>
          <input type="text" value={form.fontFamily}
            onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            placeholder="Inter, Roboto, etc." />
        </div>
      </div>

      {/* Colores por sección */}
      {colorSections.map((section) => (
        <div key={section.title} className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-2">{section.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.fields.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                <div className="flex gap-2">
                  <input type="color" value={form[key] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="h-10 w-12 bg-gray-800 border border-gray-700 rounded cursor-pointer" />
                  <input type="text" value={form[key] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            ))}
          </div>
          {section.title === "Footer" && (
            <label className="flex items-center gap-3 cursor-pointer pt-2">
              <input type="checkbox" checked={form.footerEnabled}
                onChange={(e) => setForm({ ...form, footerEnabled: e.target.checked })}
                className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-gray-300">Mostrar footer</span>
            </label>
          )}
        </div>
      ))}

      {/* Preview */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Vista previa</h3>
        <div className="rounded-lg overflow-hidden border border-gray-700">
          {/* Header preview */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: form.headerBg, color: form.headerText }}>
            <span className="font-bold">Mi Tienda</span>
            <span className="text-sm px-3 py-1 rounded-full"
              style={{ backgroundColor: form.buttonBg, color: form.buttonText }}>
              Carrito
            </span>
          </div>
          {/* Body preview */}
          <div className="p-4 space-y-3" style={{ backgroundColor: form.bodyBg }}>
            <p className="font-bold" style={{ color: form.titleText }}>Título de ejemplo</p>
            <p className="text-sm" style={{ color: form.generalText }}>Este es un texto de ejemplo para ver cómo quedan los colores.</p>
            {/* Card preview */}
            <div className="rounded-lg p-3" style={{ backgroundColor: form.panelBg }}>
              <p className="font-medium text-sm" style={{ color: form.titleText }}>Producto</p>
              <p className="text-xs mt-1" style={{ color: form.generalText }}>Descripción del producto</p>
              <button className="mt-2 text-xs px-3 py-1 rounded-lg font-medium"
                style={{ backgroundColor: form.buttonBg, color: form.buttonText }}>
                Agregar
              </button>
            </div>
          </div>
          {/* Footer preview */}
          {form.footerEnabled && (
            <div className="px-4 py-2 text-xs text-center"
              style={{ backgroundColor: form.footerBg, color: form.footerText }}>
              Footer de ejemplo
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
          {saving ? "Guardando..." : "Guardar Diseño"}
        </button>
      </div>
    </div>
  );
}
