import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface DayHours {
  open: string;
  close: string;
}

interface Holiday {
  date: string;
  reason: string;
}

interface ScheduleData {
  // Cada día puede tener múltiples turnos (ej. corte de almuerzo / cena).
  // null o array vacío = cerrado ese día.
  hours: Record<string, DayHours[] | null>;
  holidays: Holiday[];
}

// Acepta el formato legacy ({open, close}) y el nuevo (array). Devuelve [].
function normalizeDaySlots(value: unknown): DayHours[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(
      (s): s is DayHours =>
        !!s && typeof (s as DayHours).open === "string" && typeof (s as DayHours).close === "string"
    );
  }
  if (typeof value === "object" && value && "open" in value && "close" in value) {
    const v = value as DayHours;
    return [{ open: v.open, close: v.close }];
  }
  return [];
}

interface BranchData {
  id: number;
  name: string;
  address: string;
  address_url: string;
  phone: string;
  whatsapp: string;
  email: string;
  description: string;
  is_open: number;
  payment_config: PaymentFormData;
  schedule: ScheduleData;
  maps_enabled?: number;
}

interface PaymentFormData {
  efectivo: boolean;
  transferencia: boolean;
  mercadopago: boolean;
  whatsapp: boolean;
  deliveryMode: string;
  deliveryCost: number;
}

const DEFAULT_PAYMENT: PaymentFormData = {
  efectivo: true,
  transferencia: false,
  mercadopago: false,
  whatsapp: false,
  deliveryMode: "envio_retiro",
  deliveryCost: 0,
};

const DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
const DAY_LABELS: Record<string, string> = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves",
  viernes: "Viernes", sabado: "Sábado", domingo: "Domingo",
};

const DEFAULT_SCHEDULE: ScheduleData = {
  hours: Object.fromEntries(DAYS.map((d) => [d, null])),
  holidays: [],
};

export default function ConfigPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressUrl, setAddressUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [payment, setPayment] = useState<PaymentFormData>(DEFAULT_PAYMENT);
  const [schedule, setSchedule] = useState<ScheduleData>(DEFAULT_SCHEDULE);
  const [mapsEnabled, setMapsEnabled] = useState(false);
  const [savingMaps, setSavingMaps] = useState(false);

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
      const data = await apiFetch<BranchData>(`/api/branches/${branchId}`);
      setName(data.name || "");
      setAddress(data.address || "");
      setAddressUrl(data.address_url || "");
      setPhone(data.phone || "");
      setWhatsapp(data.whatsapp || "");
      setEmail(data.email || "");
      setDescription(data.description || "");
      setIsOpen(!!data.is_open);
      setMapsEnabled(!!data.maps_enabled);
      const pc = typeof data.payment_config === "object" && data.payment_config ? data.payment_config : {};
      setPayment({ ...DEFAULT_PAYMENT, ...pc });
      const sc = typeof data.schedule === "object" && data.schedule ? (data.schedule as any) : DEFAULT_SCHEDULE;
      // Normalizamos cada día al formato array de slots; convierte el shape
      // legacy ({open, close}) en [{open, close}] sin tocar el server.
      const rawHours = (sc.hours || {}) as Record<string, unknown>;
      const normalizedHours: Record<string, DayHours[] | null> = { ...DEFAULT_SCHEDULE.hours };
      for (const day of DAYS) {
        const slots = normalizeDaySlots(rawHours[day]);
        normalizedHours[day] = slots.length > 0 ? slots : null;
      }
      setSchedule({ hours: normalizedHours, holidays: sc.holidays || [] });
    } catch (err: any) {
      setError(err.message || "Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  }

  async function toggleMaps(next: boolean) {
    setSavingMaps(true);
    setError(null);
    try {
      const res = await apiFetch<{ enabled: boolean }>("/api/config/maps-enabled", {
        method: "POST",
        body: JSON.stringify({ enabled: next }),
      });
      setMapsEnabled(res.enabled);
    } catch (err: any) {
      setError(err.message || "Error al cambiar el buscador de direcciones");
    } finally {
      setSavingMaps(false);
    }
  }

  async function handleSave() {
    if (!branchId) return;
    try {
      setSaving(true);
      setSuccess(false);
      await apiFetch(`/api/branches/${branchId}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          address,
          address_url: addressUrl,
          phone,
          whatsapp,
          email,
          description,
          is_open: isOpen,
          payment_config: payment,
          schedule,
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

  if (branchLoading || loading) {
    return (
      <div className="max-w-4xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-4">Cargando configuración...</p>
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

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Configuración</h2>
          <p className="text-gray-400">Configuración general de la sucursal</p>
        </div>
        {isMaster && branches.length > 0 && (
          <select
            value={branchId}
            onChange={(e) => setBranchId(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {success && (
        <div className="bg-emerald-900/20 border border-emerald-900/50 rounded-lg p-3 text-emerald-400 text-sm">
          Configuración guardada correctamente
        </div>
      )}

      {/* Info General */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Información General</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre de la sucursal</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Dirección</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            placeholder="Av. Principal 123" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Link Google Maps</label>
          <input type="url" value={addressUrl} onChange={(e) => setAddressUrl(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            placeholder="https://maps.google.com/..." />
        </div>

        {/* Toggle del buscador de direcciones con Google Maps (checkout) */}
        <div className="flex items-start justify-between gap-4 bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-200">
              Buscador de direcciones (Google Maps)
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Prendido: el cliente busca su dirección con autocompletado y mapa (requiere que
              la facturación de Google Maps esté al día). Apagado: el cliente escribe la
              dirección a mano — usalo si el mapa no carga o para no consumir la API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleMaps(!mapsEnabled)}
            disabled={savingMaps}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 ${
              mapsEnabled
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            {savingMaps ? "..." : mapsEnabled ? "Activado" : "Desactivado"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="11 1234-5678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">WhatsApp</label>
            <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="5491123456789" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            placeholder="Breve descripción de la sucursal" />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className={`relative w-11 h-6 rounded-full transition-colors ${isOpen ? "bg-emerald-600" : "bg-gray-700"}`}
            onClick={() => setIsOpen(!isOpen)}>
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isOpen ? "translate-x-5" : ""}`} />
          </div>
          <span className="text-sm text-gray-300">{isOpen ? "Sucursal abierta" : "Sucursal cerrada"}</span>
        </label>
      </div>

      {/* Medios de Pago */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Medios de Pago</h3>

        <div className="space-y-3">
          {([
            { key: "efectivo", label: "Efectivo" },
            { key: "transferencia", label: "Transferencia bancaria" },
            { key: "mercadopago", label: "MercadoPago" },
            { key: "whatsapp", label: "Coordinar por WhatsApp" },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={payment[key]}
                onChange={(e) => setPayment({ ...payment, [key]: e.target.checked })}
                className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-gray-300">{label}</span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Modo de entrega</label>
            <select value={payment.deliveryMode}
              onChange={(e) => setPayment({ ...payment, deliveryMode: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
              <option value="envio_retiro">Envío y retiro</option>
              <option value="solo_retiro">Solo retiro</option>
              <option value="solo_envio">Solo envío</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Costo de envío base ($)</label>
            <input type="number" value={payment.deliveryCost}
              onChange={(e) => setPayment({ ...payment, deliveryCost: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              min="0" step="50" />
          </div>
        </div>
      </div>

      {/* Horarios */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Horarios de Atención</h3>
        <p className="text-sm text-gray-400">
          Configurá los turnos de apertura para cada día. Podés agregar más de un turno por día
          (por ejemplo, almuerzo y cena). Si un día no tiene turnos, la sucursal estará cerrada.
        </p>

        <div className="space-y-2">
          {DAYS.map((day) => {
            const slots = schedule.hours[day] ?? [];
            const enabled = slots.length > 0;

            const updateSlots = (next: DayHours[] | null) => {
              const newHours = { ...schedule.hours };
              newHours[day] = next && next.length > 0 ? next : null;
              setSchedule({ ...schedule, hours: newHours });
            };

            return (
              <div
                key={day}
                className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-b-0"
              >
                {/* Toggle del día */}
                <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer pt-1.5">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateSlots([{ open: "19:00", close: "23:00" }]);
                      } else {
                        updateSlots(null);
                      }
                    }}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className={`text-sm ${enabled ? "text-white font-medium" : "text-gray-500"}`}>
                    {DAY_LABELS[day]}
                  </span>
                </label>

                {/* Slots del día */}
                {enabled ? (
                  <div className="flex-1 space-y-1.5">
                    {slots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={slot.open}
                          onChange={(e) => {
                            const next = slots.map((s, i) =>
                              i === idx ? { ...s, open: e.target.value } : s
                            );
                            updateSlots(next);
                          }}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-gray-500 text-sm">a</span>
                        <input
                          type="time"
                          value={slot.close}
                          onChange={(e) => {
                            const next = slots.map((s, i) =>
                              i === idx ? { ...s, close: e.target.value } : s
                            );
                            updateSlots(next);
                          }}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateSlots(slots.filter((_, i) => i !== idx))}
                          title="Quitar turno"
                          aria-label={`Quitar turno ${idx + 1} de ${DAY_LABELS[day]}`}
                          className="ml-1 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        // Sugerencia inteligente: el siguiente turno arranca
                        // 1h después del cierre del último, o 12:00–15:00 si es el primero.
                        const last = slots[slots.length - 1];
                        const fallback = { open: "12:00", close: "15:00" };
                        const next = last
                          ? { open: last.close, close: last.close }
                          : fallback;
                        updateSlots([...slots, next]);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors mt-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar horario
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-gray-600 italic pt-1.5">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fechas Especiales de Cierre */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-2">Fechas Especiales de Cierre</h3>
        <p className="text-sm text-gray-400">Agregá fechas en las que la sucursal estará cerrada (feriados, vacaciones, etc.)</p>

        {schedule.holidays.length > 0 && (
          <div className="space-y-2">
            {schedule.holidays.map((holiday, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2.5">
                <span className="text-sm text-white font-medium">
                  {holiday.date ? new Date(holiday.date + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : ""}
                </span>
                <span className="text-sm text-gray-400 flex-1">{holiday.reason}</span>
                <button
                  onClick={() => {
                    const newHolidays = schedule.holidays.filter((_, i) => i !== idx);
                    setSchedule({ ...schedule, holidays: newHolidays });
                  }}
                  className="text-red-400 hover:text-red-300 text-sm font-medium"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Fecha</label>
            <input
              type="date"
              id="holiday-date"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Motivo</label>
            <input
              type="text"
              id="holiday-reason"
              placeholder="Ej: Navidad, Vacaciones..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => {
              const dateInput = document.getElementById("holiday-date") as HTMLInputElement;
              const reasonInput = document.getElementById("holiday-reason") as HTMLInputElement;
              if (!dateInput.value || !reasonInput.value) {
                alert("Completá la fecha y el motivo");
                return;
              }
              setSchedule({
                ...schedule,
                holidays: [...schedule.holidays, { date: dateInput.value, reason: reasonInput.value }],
              });
              dateInput.value = "";
              reasonInput.value = "";
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">
          {saving ? "Guardando..." : "Guardar Configuración"}
        </button>
      </div>
    </div>
  );
}
