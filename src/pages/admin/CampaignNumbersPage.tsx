import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";

interface CampaignNumber {
  id: number;
  phone: string;
  friendly_name: string;
  twilio_sid: string;
  daily_limit: number;
  sent_today: number;
  status: string;
  created_at: string;
}

interface FormData {
  phone: string;
  friendly_name: string;
  twilio_sid: string;
  daily_limit: number;
  status: string;
}

export default function CampaignNumbersPage() {
  const { apiFetch } = useApi();
  const [numbers, setNumbers] = useState<CampaignNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CampaignNumber | null>(null);
  const [formData, setFormData] = useState<FormData>({
    phone: "", friendly_name: "", twilio_sid: "", daily_limit: 200, status: "active",
  });

  useEffect(() => { loadNumbers(); }, []);

  async function loadNumbers() {
    try {
      setLoading(true);
      const data = await apiFetch<CampaignNumber[]>("/api/campaigns/numbers");
      setNumbers(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormData({ phone: "", friendly_name: "", twilio_sid: "", daily_limit: 200, status: "active" });
    setShowModal(true);
  }

  function openEdit(num: CampaignNumber) {
    setEditing(num);
    setFormData({
      phone: num.phone,
      friendly_name: num.friendly_name,
      twilio_sid: num.twilio_sid,
      daily_limit: num.daily_limit,
      status: num.status,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.phone.trim()) { alert("Teléfono requerido"); return; }
    try {
      setSaving(true);
      if (editing) {
        await apiFetch(`/api/campaigns/numbers/${editing.id}`, { method: "PUT", body: JSON.stringify(formData) });
      } else {
        await apiFetch("/api/campaigns/numbers", { method: "POST", body: JSON.stringify(formData) });
      }
      setShowModal(false);
      loadNumbers();
    } catch (err: any) {
      alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNumber(num: CampaignNumber) {
    if (!confirm(`¿Eliminar el número "${num.friendly_name || num.phone}"?`)) return;
    try {
      await apiFetch(`/api/campaigns/numbers/${num.id}`, { method: "DELETE" });
      loadNumbers();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  }

  const statusColors: Record<string, string> = {
    active: "bg-emerald-900/30 text-emerald-400",
    paused: "bg-yellow-900/30 text-yellow-400",
    blocked: "bg-red-900/30 text-red-400",
  };

  if (loading) {
    return (
      <div className="max-w-4xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-gray-400 mt-4">Cargando números...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Números de Campaña</h2>
          <p className="text-gray-400">Números de WhatsApp para envíos masivos vía Twilio</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
          + Nuevo Número
        </button>
      </div>

      {numbers.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay números configurados</p>
          <p className="text-gray-600 text-sm mt-2">Agregá un número de WhatsApp Business conectado a Twilio</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Enviados hoy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {numbers.map((num) => (
                <tr key={num.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-mono">{num.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{num.friendly_name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {num.sent_today} / {num.daily_limit}
                    <div className="w-24 bg-gray-700 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min((num.sent_today / num.daily_limit) * 100, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusColors[num.status] || "bg-gray-700 text-gray-400"}`}>
                      {num.status === "active" ? "Activo" : num.status === "paused" ? "Pausado" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(num)} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">Editar</button>
                      <button onClick={() => deleteNumber(num)} className="text-sm text-red-400 hover:text-red-300 font-medium">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-md">
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{editing ? "Editar Número" : "Nuevo Número"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono <span className="text-red-400">*</span></label>
                <input type="text" value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  placeholder="+5491112345678" required />
                <p className="text-xs text-gray-500 mt-1">Formato internacional con código de país</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre amigable</label>
                <input type="text" value={formData.friendly_name}
                  onChange={(e) => setFormData({ ...formData, friendly_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Línea campañas 1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Twilio SID</label>
                <input type="text" value={formData.twilio_sid}
                  onChange={(e) => setFormData({ ...formData, twilio_sid: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="SM..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Límite diario</label>
                  <input type="number" value={formData.daily_limit}
                    onChange={(e) => setFormData({ ...formData, daily_limit: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    min="1" max="1000" />
                </div>
                {editing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
                    <select value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500">
                      <option value="active">Activo</option>
                      <option value="paused">Pausado</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                  {saving ? "Guardando..." : editing ? "Guardar" : "Agregar"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
