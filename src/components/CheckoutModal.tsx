import { useState, useCallback } from "react";
import { useCart, useCartDispatch } from "../store/cartContext";
import { storeConfig } from "../data/seed";
import { getDateOptions, getTimeSlots } from "../utils/dateTime";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "../utils/whatsapp";
import GoogleAddressPicker from "./GoogleAddressPicker";
import type { CheckoutData } from "../types";

interface Props {
  onClose: () => void;
  isStoreOpen: boolean;
}

export default function CheckoutModal({ onClose, isStoreOpen }: Props) {
  const { items } = useCart();
  const dispatch = useCartDispatch();

  const [form, setForm] = useState<CheckoutData>({
    name: "",
    phone: "",
    deliveryType: "delivery",
    address: "",
    lat: null,
    lng: null,
    floor: "",
    date: "",
    time: "",
    instructions: "",
    paymentMethod: "Efectivo",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const dateOptions = getDateOptions();
  const timeSlots = getTimeSlots();

  function updateField<K extends keyof CheckoutData>(
    key: K,
    value: CheckoutData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const handleAddressSelect = useCallback(
    (result: { address: string; lat: number; lng: number }) => {
      setForm((prev) => ({
        ...prev,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.address;
        return next;
      });
    },
    []
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) errs.name = "Nombre requerido";
    if (!form.phone.trim()) errs.phone = "Celular requerido";

    if (form.deliveryType === "delivery") {
      if (!form.address.trim()) errs.address = "Dirección requerida";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSend() {
    if (!isStoreOpen) return;
    if (!validate()) return;

    const message = buildWhatsAppMessage(items, form, storeConfig.address);
    const url = buildWhatsAppUrl(storeConfig.phone, message);

    window.open(url, "_blank");
    dispatch({ type: "CLEAR" });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">
            Enviar por Whatsapp
          </h2>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm text-gray-300 font-medium mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              placeholder="Tu nombre"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Celular */}
          <div>
            <label className="block text-sm text-gray-300 font-medium mb-1">
              Celular
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              placeholder="11 2345 6789"
            />
            {errors.phone && (
              <p className="text-red-400 text-xs mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Delivery type */}
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="deliveryType"
                checked={form.deliveryType === "pickup"}
                onChange={() => updateField("deliveryType", "pickup")}
                className="mt-1 accent-emerald-600"
              />
              <span className="text-sm text-gray-300">
                Retiro en sucursal{" "}
                <a
                  href={storeConfig.addressUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline"
                >
                  {storeConfig.address}
                </a>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="deliveryType"
                checked={form.deliveryType === "delivery"}
                onChange={() => updateField("deliveryType", "delivery")}
                className="mt-1 accent-emerald-600"
              />
              <span className="text-sm text-gray-300">
                Envío a domicilio
              </span>
            </label>
          </div>

          {/* Address (only for delivery) */}
          {form.deliveryType === "delivery" && (
            <>
              <GoogleAddressPicker
                value={form.address}
                onSelect={handleAddressSelect}
              />
              {errors.address && (
                <p className="text-red-400 text-xs">{errors.address}</p>
              )}

              {/* Piso / Depto / Lote */}
              <div>
                <label className="block text-sm text-gray-300 font-medium mb-1">
                  Piso / Departamento / Lote
                </label>
                <input
                  type="text"
                  value={form.floor}
                  onChange={(e) => updateField("floor", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                  placeholder="Ej: 3ro A / Lote 12"
                />
              </div>
            </>
          )}

          {/* Fecha */}
          <div>
            <label className="block text-sm text-gray-300 font-medium mb-1">
              Fecha
            </label>
            <select
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
            >
              <option value="">Lo antes posible</option>
              {dateOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hora */}
          <div>
            <label className="block text-sm text-gray-300 font-medium mb-1">
              Hora
            </label>
            <select
              value={form.time}
              onChange={(e) => updateField("time", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
            >
              <option value="">Lo antes posible</option>
              {timeSlots.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Indicaciones */}
          <div>
            <label className="block text-sm text-gray-300 font-medium mb-1">
              Indicaciones de entrega
            </label>
            <input
              type="text"
              value={form.instructions}
              onChange={(e) => updateField("instructions", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              placeholder="Tocar timbre, dejar en portería, etc."
            />
          </div>

          {/* Forma de pago */}
          <div>
            <label className="block text-sm text-gray-300 font-medium mb-1">
              Formas de pago
            </label>
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                updateField(
                  "paymentMethod",
                  e.target.value as "Efectivo" | "Transferencia"
                )
              }
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>

          {/* Store closed warning */}
          {!isStoreOpen && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-center">
              <p className="text-red-400 font-semibold text-sm">
                Local cerrado - No se pueden enviar pedidos en este momento
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!isStoreOpen}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
              isStoreOpen
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            Enviar!
          </button>
        </div>
      </div>
    </div>
  );
}
