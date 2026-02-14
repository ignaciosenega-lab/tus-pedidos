import { useState } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import type { StyleConfig } from "../../types";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-lg border border-gray-700 bg-transparent cursor-pointer"
      />
      <div className="flex-1">
        <p className="text-sm text-gray-300">{label}</p>
        <p className="text-xs text-gray-500 font-mono">{value}</p>
      </div>
    </div>
  );
}

async function uploadImage(file: File): Promise<string | null> {
  const token = localStorage.getItem("tuspedidos_token");
  if (!token) return null;
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
      return url;
    }
  } catch { /* ignore */ }
  return null;
}

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}

function ImageUploadField({ label, value, onChange, hint }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-400">{label}</label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <div className="flex gap-3 items-start">
        {/* Preview */}
        <div className="w-20 h-20 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-contain" />
          ) : (
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="URL de la imagen o subí un archivo"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <div className="flex gap-2">
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${uploading ? "bg-gray-700 text-gray-400" : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"}`}>
              {uploading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Subiendo...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Subir imagen
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const url = await uploadImage(file);
                  if (url) onChange(url);
                  setUploading(false);
                  e.target.value = "";
                }}
              />
            </label>
            {value && (
              <button
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StylesPage() {
  const { styleConfig, businessConfig } = useAdmin();
  const dispatch = useAdminDispatch();
  const [form, setForm] = useState<StyleConfig>({ ...styleConfig });
  const [logo, setLogo] = useState(businessConfig.logo);
  const [favicon, setFavicon] = useState(businessConfig.favicon);
  const [saved, setSaved] = useState(false);

  function save() {
    dispatch({ type: "UPDATE_STYLE_CONFIG", payload: form });
    dispatch({ type: "UPDATE_BUSINESS_CONFIG", payload: { ...businessConfig, logo, favicon } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update<K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Personalización visual</h2>

      <div className="space-y-6">
        {/* ── Logo y Favicon ───────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Identidad visual</h3>
          <ImageUploadField
            label="Logo"
            value={logo}
            onChange={setLogo}
            hint="Recomendado: PNG transparente, 200x200px o superior"
          />
          <ImageUploadField
            label="Favicon"
            value={favicon}
            onChange={setFavicon}
            hint="Recomendado: PNG o ICO, 32x32px o 64x64px"
          />
        </section>
        {/* ── Tipografía ─────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Tipografía</h3>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Font family (CSS)</label>
            <input
              value={form.fontFamily}
              onChange={(e) => update("fontFamily", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Inter, system-ui, sans-serif"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Google Fonts URL (opcional)</label>
            <input
              value={form.fontUrl}
              onChange={(e) => update("fontUrl", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="https://fonts.googleapis.com/css2?family=..."
            />
          </div>
        </section>

        {/* ── Cabecera ───────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Cabecera</h3>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Fondo cabecera" value={form.headerBg} onChange={(v) => update("headerBg", v)} />
            <ColorField label="Texto cabecera" value={form.headerText} onChange={(v) => update("headerText", v)} />
          </div>
        </section>

        {/* ── Menú ───────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Menú / Sidebar</h3>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Fondo menú" value={form.menuBg} onChange={(v) => update("menuBg", v)} />
            <ColorField label="Texto menú" value={form.menuText} onChange={(v) => update("menuText", v)} />
          </div>
        </section>

        {/* ── Fondo y paneles ────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Fondo, paneles y popups</h3>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Fondo general" value={form.bodyBg} onChange={(v) => update("bodyBg", v)} />
            <ColorField label="Fondo paneles" value={form.panelBg} onChange={(v) => update("panelBg", v)} />
            <ColorField label="Fondo popups" value={form.popupBg} onChange={(v) => update("popupBg", v)} />
          </div>
        </section>

        {/* ── Textos ─────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Textos</h3>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Texto general" value={form.generalText} onChange={(v) => update("generalText", v)} />
            <ColorField label="Títulos" value={form.titleText} onChange={(v) => update("titleText", v)} />
          </div>
        </section>

        {/* ── Botones ────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Botones</h3>
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Fondo botón" value={form.buttonBg} onChange={(v) => update("buttonBg", v)} />
            <ColorField label="Texto botón" value={form.buttonText} onChange={(v) => update("buttonText", v)} />
          </div>
          {/* Preview */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
            <button
              style={{ backgroundColor: form.buttonBg, color: form.buttonText }}
              className="px-6 py-2 rounded-lg text-sm font-semibold"
            >
              Botón de ejemplo
            </button>
          </div>
        </section>

        {/* ── Footer ─────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Pie de página</h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-11 h-6 rounded-full transition-colors ${form.footerEnabled ? "bg-emerald-600" : "bg-gray-700"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.footerEnabled ? "left-[22px]" : "left-0.5"}`} />
              <input type="checkbox" checked={form.footerEnabled} onChange={(e) => update("footerEnabled", e.target.checked)} className="sr-only" />
            </div>
            <span className="text-sm text-gray-300">Mostrar pie de página</span>
          </label>

          {form.footerEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Fondo footer" value={form.footerBg} onChange={(v) => update("footerBg", v)} />
              <ColorField label="Texto footer" value={form.footerText} onChange={(v) => update("footerText", v)} />
            </div>
          )}
        </section>

        {/* Save */}
        <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
          {saved ? "Guardado!" : "Guardar estilos"}
        </button>
      </div>
    </div>
  );
}
