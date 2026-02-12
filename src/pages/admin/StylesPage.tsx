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

export default function StylesPage() {
  const { styleConfig } = useAdmin();
  const dispatch = useAdminDispatch();
  const [form, setForm] = useState<StyleConfig>({ ...styleConfig });
  const [saved, setSaved] = useState(false);

  function save() {
    dispatch({ type: "UPDATE_STYLE_CONFIG", payload: form });
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
