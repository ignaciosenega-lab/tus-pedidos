import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface StyleFormData {
  logo: string;
  favicon: string;
  banners: string[];
  fontFamily: string;
  headerBg: string;
  headerText: string;
  bodyBg: string;
  generalText: string;
  buttonBg: string;
  buttonText: string;
  menuBg: string;
  menuText: string;
  footerEnabled: boolean;
  footerBg: string;
  footerText: string;
}

const DEFAULT_STYLE: StyleFormData = {
  logo: "",
  favicon: "",
  banners: [],
  fontFamily: "",
  headerBg: "#1a1a2e",
  headerText: "#ffffff",
  bodyBg: "#0f0f1a",
  generalText: "#e0e0e0",
  buttonBg: "#10b981",
  buttonText: "#ffffff",
  menuBg: "#1a1a2e",
  menuText: "#e0e0e0",
  footerEnabled: false,
  footerBg: "#1a1a2e",
  footerText: "#e0e0e0",
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
        fontFamily: sc.fontFamily || "",
        headerBg: sc.headerBg || DEFAULT_STYLE.headerBg,
        headerText: sc.headerText || DEFAULT_STYLE.headerText,
        bodyBg: sc.bodyBg || DEFAULT_STYLE.bodyBg,
        generalText: sc.generalText || DEFAULT_STYLE.generalText,
        buttonBg: sc.buttonBg || DEFAULT_STYLE.buttonBg,
        buttonText: sc.buttonText || DEFAULT_STYLE.buttonText,
        menuBg: sc.menuBg || DEFAULT_STYLE.menuBg,
        menuText: sc.menuText || DEFAULT_STYLE.menuText,
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

  const colorFields: { key: keyof StyleFormData; label: string }[] = [
    { key: "headerBg", label: "Fondo del header" },
    { key: "headerText", label: "Texto del header" },
    { key: "bodyBg", label: "Fondo general" },
    { key: "generalText", label: "Texto general" },
    { key: "menuBg", label: "Fondo del menú" },
    { key: "menuText", label: "Texto del menú" },
    { key: "buttonBg", label: "Fondo de botones" },
    { key: "buttonText", label: "Texto de botones" },
    { key: "footerBg", label: "Fondo del footer" },
    { key: "footerText", label: "Texto del footer" },
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

      {/* Colores */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Colores</h3>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Fuente personalizada</label>
          <input type="text" value={form.fontFamily}
            onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            placeholder="Inter, Roboto, etc." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {colorFields.map(({ key, label }) => (
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

        <label className="flex items-center gap-3 cursor-pointer pt-2">
          <input type="checkbox" checked={form.footerEnabled}
            onChange={(e) => setForm({ ...form, footerEnabled: e.target.checked })}
            className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500" />
          <span className="text-sm text-gray-300">Mostrar footer</span>
        </label>
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
