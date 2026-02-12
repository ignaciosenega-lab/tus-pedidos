import { useState } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import type { PaymentConfig } from "../../types";

export default function OperationsPage() {
  const { paymentConfig } = useAdmin();
  const dispatch = useAdminDispatch();
  const [form, setForm] = useState<PaymentConfig>({ ...paymentConfig });
  const [saved, setSaved] = useState(false);

  function save() {
    dispatch({ type: "UPDATE_PAYMENT_CONFIG", payload: form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key: keyof Pick<PaymentConfig, "efectivo" | "transferencia" | "mercadopago" | "whatsapp">) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  const paymentMethods = [
    { key: "efectivo" as const, label: "Efectivo", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
    { key: "transferencia" as const, label: "Transferencia", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
    { key: "mercadopago" as const, label: "MercadoPago", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    { key: "whatsapp" as const, label: "WhatsApp", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  ];

  const deliveryModes = [
    { value: "envio_retiro" as const, label: "Envío + Retiro", desc: "Ambas opciones disponibles" },
    { value: "solo_retiro" as const, label: "Solo retiro", desc: "Solo retiro en sucursal" },
    { value: "solo_envio" as const, label: "Solo envíos", desc: "Solo delivery a domicilio" },
  ];

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Pagos, envíos y operación</h2>

      <div className="space-y-6">
        {/* ── Medios de pago ──────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3 mb-4">Medios de pago</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {paymentMethods.map((pm) => (
              <button
                key={pm.key}
                onClick={() => toggle(pm.key)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                  form[pm.key]
                    ? "border-emerald-600 bg-emerald-900/20"
                    : "border-gray-700 bg-gray-800/50 opacity-60"
                }`}
              >
                <svg className={`w-6 h-6 ${form[pm.key] ? "text-emerald-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={pm.icon} />
                </svg>
                <div className="text-left flex-1">
                  <p className={`font-medium text-sm ${form[pm.key] ? "text-white" : "text-gray-500"}`}>{pm.label}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form[pm.key] ? "border-emerald-500 bg-emerald-600" : "border-gray-600"}`}>
                  {form[pm.key] && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Modalidad de entrega ───────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3 mb-4">Modalidad de entrega</h3>
          <div className="space-y-2">
            {deliveryModes.map((dm) => (
              <label
                key={dm.value}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  form.deliveryMode === dm.value
                    ? "border-emerald-600 bg-emerald-900/20"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="deliveryMode"
                  checked={form.deliveryMode === dm.value}
                  onChange={() => setForm((f) => ({ ...f, deliveryMode: dm.value }))}
                  className="accent-emerald-600"
                />
                <div>
                  <p className="text-white font-medium text-sm">{dm.label}</p>
                  <p className="text-gray-500 text-xs">{dm.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── Costo de envío ─────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3 mb-4">Costo de envío</h3>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-lg">$</span>
            <input
              type="number"
              value={form.deliveryCost}
              onChange={(e) => setForm((f) => ({ ...f, deliveryCost: Number(e.target.value) }))}
              className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <span className="text-gray-500 text-sm">por pedido</span>
          </div>
        </section>

        {/* Save */}
        <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
          {saved ? "Guardado!" : "Guardar operación"}
        </button>
      </div>
    </div>
  );
}
