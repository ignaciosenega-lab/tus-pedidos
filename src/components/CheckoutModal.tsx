import { useState, useCallback } from "react";
import { useCart, useCartDispatch } from "../store/cartContext";
import { useStorefront } from "../hooks/useStorefront";
import { getDateOptions, getTimeSlots } from "../utils/dateTime";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "../utils/whatsapp";
import GoogleAddressPicker from "./GoogleAddressPicker";
import { findDeliveryZone } from "../utils/kmlParser";
import type { CheckoutData } from "../types";

interface AppliedCoupon {
  code: string;
  name: string;
  discount: number;
}

interface Props {
  onClose: () => void;
  isStoreOpen: boolean;
  appliedCoupon?: AppliedCoupon | null;
}

export default function CheckoutModal({ onClose, isStoreOpen, appliedCoupon }: Props) {
  const { items } = useCart();
  const dispatch = useCartDispatch();
  const { businessConfig, branchId, deliveryZones, delayMinutes } = useStorefront();

  const dateOptions = getDateOptions();

  const [form, setForm] = useState<CheckoutData>({
    name: "",
    phone: "",
    deliveryType: "delivery",
    address: "",
    lat: null,
    lng: null,
    floor: "",
    date: dateOptions[0]?.value || "",
    time: "",
    instructions: "",
    paymentMethod: "Efectivo",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outsideZone, setOutsideZone] = useState(false);
  const timeSlots = getTimeSlots(delayMinutes, form.date);

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
    if (key === "deliveryType" && value === "pickup") {
      setOutsideZone(false);
    }
    // Reset time when date changes so an unavailable slot isn't kept
    if (key === "date") {
      const newSlots = getTimeSlots(delayMinutes, value as string);
      setForm((prev) => {
        if (prev.time && !newSlots.some((s) => s.value === prev.time)) {
          return { ...prev, [key]: value, time: "" };
        }
        return prev;
      });
    }
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

      // Check if address is inside a delivery zone
      if (deliveryZones.length > 0) {
        const zone = findDeliveryZone(deliveryZones, { lat: result.lat, lng: result.lng });
        setOutsideZone(!zone);
      } else {
        setOutsideZone(false);
      }
    },
    [deliveryZones]
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

  async function handleSend() {
    if (!validate()) return;

    const discount = appliedCoupon?.discount || 0;
    const couponCode = appliedCoupon?.code || null;
    const message = buildWhatsAppMessage(items, form, businessConfig.address, appliedCoupon || undefined);
    const url = buildWhatsAppUrl(businessConfig.whatsapp || businessConfig.phone, message);

    // Calculate total
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Track order_placed analytics event
    if (branchId) {
      const sid = sessionStorage.getItem("_tp_sid") || "";
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, eventType: "order_placed", sessionId: sid }),
      }).catch(() => {});
    }

    // Save order to database and validate coupon
    if (branchId) {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId,
            customerName: form.name,
            customerPhone: form.phone,
            deliveryType: form.deliveryType,
            address: form.address,
            lat: form.lat,
            lng: form.lng,
            floor: form.floor,
            date: form.date,
            time: form.time,
            instructions: form.instructions,
            paymentMethod: form.paymentMethod,
            items: items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              variantLabel: i.variantLabel,
              price: i.price,
              quantity: i.quantity,
            })),
            subtotal,
            deliveryCost: 0,
            discount,
            total: Math.max(0, subtotal - discount),
            couponCode,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          if (data.error) {
            setErrors({ coupon: data.error });
            return;
          }
        }
      } catch {
        // If network fails, proceed anyway
      }
    }

    window.open(url, "_blank");
    dispatch({ type: "CLEAR" });
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--panel-bg)",
    color: "var(--general-text)",
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ backgroundColor: "var(--popup-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-xl font-bold" style={{ color: "var(--title-text)" }}>
            Enviar por Whatsapp
          </h2>
          <button
            onClick={onClose}
            className="opacity-60 hover:opacity-100 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-opacity"
            style={{ color: "var(--general-text)" }}
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium mb-1 opacity-70" style={{ color: "var(--general-text)" }}>
              Nombre
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ...inputStyle, "--tw-ring-color": "var(--btn-bg)" } as React.CSSProperties}
              placeholder="Tu nombre"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Celular */}
          <div>
            <label className="block text-sm font-medium mb-1 opacity-70" style={{ color: "var(--general-text)" }}>
              Celular
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ...inputStyle, "--tw-ring-color": "var(--btn-bg)" } as React.CSSProperties}
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
                className="mt-1"
                style={{ accentColor: "var(--btn-bg)" }}
              />
              <span className="text-sm" style={{ color: "var(--general-text)" }}>
                Retiro en sucursal{" "}
                <a
                  href={businessConfig.addressUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--btn-bg)" }}
                  className="underline"
                >
                  {businessConfig.address}
                </a>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="deliveryType"
                checked={form.deliveryType === "delivery"}
                onChange={() => updateField("deliveryType", "delivery")}
                className="mt-1"
                style={{ accentColor: "var(--btn-bg)" }}
              />
              <span className="text-sm" style={{ color: "var(--general-text)" }}>
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

              {outsideZone && (
                <div className="flex items-start gap-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                  <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-300">
                      No llegamos a esta dirección
                    </p>
                    <p className="text-xs text-yellow-400/80 mt-0.5">
                      Tu dirección está fuera de nuestra zona de envío. Podés contactar al local por WhatsApp para consultar opciones de entrega.
                    </p>
                  </div>
                </div>
              )}

              {/* Piso / Depto / Lote */}
              <div>
                <label className="block text-sm font-medium mb-1 opacity-70" style={{ color: "var(--general-text)" }}>
                  Piso / Departamento / Lote
                </label>
                <input
                  type="text"
                  value={form.floor}
                  onChange={(e) => updateField("floor", e.target.value)}
                  className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ ...inputStyle, "--tw-ring-color": "var(--btn-bg)" } as React.CSSProperties}
                  placeholder="Ej: 3ro A / Lote 12"
                />
              </div>
            </>
          )}

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium mb-1 opacity-70" style={{ color: "var(--general-text)" }}>
              Fecha
            </label>
            <select
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ...inputStyle, "--tw-ring-color": "var(--btn-bg)" } as React.CSSProperties}
            >
              {dateOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hora */}
          <div>
            <label className="block text-sm font-medium mb-1 opacity-70" style={{ color: "var(--general-text)" }}>
              Hora
            </label>
            <select
              value={form.time}
              onChange={(e) => updateField("time", e.target.value)}
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ...inputStyle, "--tw-ring-color": "var(--btn-bg)" } as React.CSSProperties}
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
            <label className="block text-sm font-medium mb-1 opacity-70" style={{ color: "var(--general-text)" }}>
              Indicaciones de entrega
            </label>
            <input
              type="text"
              value={form.instructions}
              onChange={(e) => updateField("instructions", e.target.value)}
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ...inputStyle, "--tw-ring-color": "var(--btn-bg)" } as React.CSSProperties}
              placeholder="Tocar timbre, dejar en portería, etc."
            />
          </div>

          {/* Forma de pago */}
          <div>
            <label className="block text-sm font-medium mb-1 opacity-70" style={{ color: "var(--general-text)" }}>
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
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ ...inputStyle, "--tw-ring-color": "var(--btn-bg)" } as React.CSSProperties}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-white/20 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--general-text)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            className="flex-1 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            Enviar!
          </button>
          {errors.coupon && (
            <p className="text-red-400 text-sm text-center w-full mt-2">{errors.coupon}</p>
          )}
        </div>
      </div>
    </div>
  );
}
