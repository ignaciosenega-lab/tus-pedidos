import { useState } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import type { BusinessConfig } from "../../types";

export default function ConfigPage() {
  const { businessConfig } = useAdmin();
  const dispatch = useAdminDispatch();
  const [form, setForm] = useState<BusinessConfig>({ ...businessConfig });
  const [saved, setSaved] = useState(false);

  function save() {
    dispatch({ type: "UPDATE_BUSINESS_CONFIG", payload: form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateField<K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateSocial(idx: number, field: "platform" | "url", value: string) {
    const links = [...form.socialLinks];
    links[idx] = { ...links[idx], [field]: value };
    setForm((f) => ({ ...f, socialLinks: links }));
  }

  function addSocial() {
    setForm((f) => ({ ...f, socialLinks: [...f.socialLinks, { platform: "", url: "" }] }));
  }

  function removeSocial(idx: number) {
    setForm((f) => ({ ...f, socialLinks: f.socialLinks.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Configuración del negocio</h2>

      <div className="space-y-6">
        {/* ── Datos generales ────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Datos generales</h3>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Título del negocio</label>
            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Descripción</label>
            <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email de notificaciones</label>
              <input value={form.email} onChange={(e) => updateField("email", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">URL del sitio</label>
              <input value={form.url} onChange={(e) => updateField("url", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Dirección</label>
              <input value={form.address} onChange={(e) => updateField("address", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Link Google Maps</label>
              <input value={form.addressUrl} onChange={(e) => updateField("addressUrl", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Teléfono (WhatsApp)</label>
              <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">WhatsApp</label>
              <input value={form.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
          </div>

          {/* Open/Closed toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-11 h-6 rounded-full transition-colors ${form.isOpen ? "bg-emerald-600" : "bg-gray-700"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.isOpen ? "left-[22px]" : "left-0.5"}`} />
              <input type="checkbox" checked={form.isOpen} onChange={(e) => updateField("isOpen", e.target.checked)} className="sr-only" />
            </div>
            <span className="text-sm text-gray-300">
              Local {form.isOpen ? <span className="text-emerald-400 font-medium">Abierto</span> : <span className="text-red-400 font-medium">Cerrado</span>}
            </span>
          </label>
        </section>

        {/* ── Imágenes ───────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Imágenes y branding</h3>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Logo (URL)</label>
            <input value={form.logo} onChange={(e) => updateField("logo", e.target.value)} placeholder="https://..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Favicon (URL)</label>
            <input value={form.favicon} onChange={(e) => updateField("favicon", e.target.value)} placeholder="https://..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
          </div>
        </section>

        {/* ── Redes sociales ──────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Redes sociales</h3>
          {form.socialLinks.map((link, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={link.platform}
                placeholder="Plataforma"
                onChange={(e) => updateSocial(i, "platform", e.target.value)}
                className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <input
                value={link.url}
                placeholder="https://..."
                onChange={(e) => updateSocial(i, "url", e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button onClick={() => removeSocial(i)} className="text-red-400 hover:text-red-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button onClick={addSocial} className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
            + Agregar red social
          </button>
        </section>

        {/* Save */}
        <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
          {saved ? "Guardado!" : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
