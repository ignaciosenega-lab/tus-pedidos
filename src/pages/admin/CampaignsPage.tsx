import { useState, useEffect, useRef } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface Campaign {
  id: number;
  branch_id: number | null;
  name: string;
  template_sid: string;
  message_body: string;
  greeting_variants: string[];
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  replied_count: number;
  created_at: string;
}

interface CampaignMessage {
  id: number;
  contact_name: string;
  contact_phone: string;
  number_name: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}

interface CampaignStats {
  status: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  replied_count: number;
  started_at: string | null;
  completed_at: string | null;
}

interface FormData {
  name: string;
  template_sid: string;
  message_body: string;
  greeting_variants: string;
  contact_scope: string;
}

export default function CampaignsPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: branchLoading } = useBranchId();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "", template_sid: "", message_body: "", greeting_variants: "", contact_scope: "all",
  });

  // Detail view
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [msgFilter, setMsgFilter] = useState("");
  const pollingRef = useRef<number | null>(null);

  useEffect(() => { loadCampaigns(); }, [branchId]);

  // Polling for running campaigns
  useEffect(() => {
    if (selectedCampaign && stats?.status === "running") {
      pollingRef.current = window.setInterval(() => {
        loadStats(selectedCampaign.id);
      }, 10000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedCampaign, stats?.status]);

  async function loadCampaigns() {
    try {
      setLoading(true);
      const data = await apiFetch<Campaign[]>("/api/campaigns");
      setCampaigns(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(id: number) {
    try {
      const data = await apiFetch<CampaignStats>(`/api/campaigns/${id}/stats`);
      setStats(data);
    } catch {
      // silently fail
    }
  }

  async function loadMessages(id: number, statusFilter = "") {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<{ messages: CampaignMessage[]; total: number }>(`/api/campaigns/${id}/messages?${params}`);
      setMessages(data.messages);
      setMsgTotal(data.total);
    } catch {
      // silently fail
    }
  }

  function openDetail(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setMsgFilter("");
    loadStats(campaign.id);
    loadMessages(campaign.id);
  }

  function closeDetail() {
    setSelectedCampaign(null);
    setStats(null);
    setMessages([]);
    if (pollingRef.current) clearInterval(pollingRef.current);
  }

  function openCreate() {
    setEditing(null);
    setFormData({ name: "", template_sid: "", message_body: "", greeting_variants: "", contact_scope: "all" });
    setShowModal(true);
  }

  function openEdit(campaign: Campaign) {
    setEditing(campaign);
    setFormData({
      name: campaign.name,
      template_sid: campaign.template_sid,
      message_body: campaign.message_body,
      greeting_variants: (campaign.greeting_variants || []).join("\n"),
      contact_scope: "all",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) { alert("Nombre requerido"); return; }
    if (!formData.template_sid && !formData.message_body) {
      alert("Ingresá un Template SID o un mensaje");
      return;
    }

    const variants = formData.greeting_variants.split("\n").map((s) => s.trim()).filter(Boolean);
    const payload = {
      name: formData.name,
      template_sid: formData.template_sid,
      message_body: formData.message_body,
      greeting_variants: variants,
      branch_id: branchId,
    };

    try {
      setSaving(true);
      if (editing) {
        await apiFetch(`/api/campaigns/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/campaigns", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      loadCampaigns();
    } catch (err: any) {
      alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function startCampaign(campaign: Campaign) {
    if (!confirm(`¿Iniciar la campaña "${campaign.name}"?`)) return;
    try {
      await apiFetch(`/api/campaigns/${campaign.id}/start`, {
        method: "POST",
        body: JSON.stringify({ contact_scope: "all" }),
      });
      loadCampaigns();
      if (selectedCampaign?.id === campaign.id) loadStats(campaign.id);
    } catch (err: any) {
      alert(err.message || "Error al iniciar");
    }
  }

  async function pauseCampaign(campaign: Campaign) {
    try {
      await apiFetch(`/api/campaigns/${campaign.id}/pause`, { method: "POST" });
      loadCampaigns();
      if (selectedCampaign?.id === campaign.id) loadStats(campaign.id);
    } catch (err: any) {
      alert(err.message || "Error al pausar");
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!confirm(`¿Eliminar la campaña "${campaign.name}"?`)) return;
    try {
      await apiFetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      loadCampaigns();
      if (selectedCampaign?.id === campaign.id) closeDetail();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-700 text-gray-300",
    scheduled: "bg-blue-900/30 text-blue-400",
    running: "bg-emerald-900/30 text-emerald-400",
    paused: "bg-yellow-900/30 text-yellow-400",
    completed: "bg-purple-900/30 text-purple-400",
    cancelled: "bg-red-900/30 text-red-400",
  };

  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    scheduled: "Programada",
    running: "Enviando",
    paused: "Pausada",
    completed: "Completada",
    cancelled: "Cancelada",
  };

  const msgStatusLabels: Record<string, string> = {
    queued: "En cola",
    sent: "Enviado",
    delivered: "Entregado",
    read: "Leído",
    failed: "Fallido",
    undelivered: "No entregado",
  };

  const msgStatusColors: Record<string, string> = {
    queued: "text-gray-400",
    sent: "text-blue-400",
    delivered: "text-emerald-400",
    read: "text-purple-400",
    failed: "text-red-400",
    undelivered: "text-orange-400",
  };

  if (branchLoading || loading) {
    return (
      <div className="max-w-6xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-gray-400 mt-4">Cargando campañas...</p>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedCampaign && stats) {
    const progress = stats.total_contacts > 0
      ? Math.round(((stats.sent_count + stats.failed_count) / stats.total_contacts) * 100)
      : 0;

    return (
      <div className="max-w-6xl">
        <button onClick={closeDetail} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a campañas
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{selectedCampaign.name}</h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${statusColors[stats.status]}`}>
              {statusLabels[stats.status] || stats.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(stats.status === "draft" || stats.status === "paused" || stats.status === "scheduled") && (
              <button onClick={() => startCampaign(selectedCampaign)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
                {stats.status === "paused" ? "Reanudar" : "Iniciar"}
              </button>
            )}
            {stats.status === "running" && (
              <button onClick={() => pauseCampaign(selectedCampaign)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors">
                Pausar
              </button>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Total", value: stats.total_contacts, color: "text-white" },
            { label: "Enviados", value: stats.sent_count, color: "text-blue-400" },
            { label: "Entregados", value: stats.delivered_count, color: "text-emerald-400" },
            { label: "Leídos", value: stats.read_count, color: "text-purple-400" },
            { label: "Respondidos", value: stats.replied_count, color: "text-cyan-400" },
            { label: "Fallidos", value: stats.failed_count, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Progreso</span>
            <span className="text-sm text-white font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Message log */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Log de mensajes ({msgTotal})</h3>
          <div className="flex items-center gap-2">
            <select value={msgFilter}
              onChange={(e) => { setMsgFilter(e.target.value); loadMessages(selectedCampaign.id, e.target.value); }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500">
              <option value="">Todos</option>
              <option value="sent">Enviados</option>
              <option value="delivered">Entregados</option>
              <option value="read">Leídos</option>
              <option value="failed">Fallidos</option>
            </select>
            <button onClick={() => loadMessages(selectedCampaign.id, msgFilter)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors">
              Actualizar
            </button>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-500">No hay mensajes todavía</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Contacto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Teléfono</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Enviado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {messages.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-2.5 text-sm text-white">{m.contact_name || "-"}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-300 font-mono">{m.contact_phone}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-400">{m.number_name || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-sm font-medium ${msgStatusColors[m.status] || "text-gray-400"}`}>
                        {msgStatusLabels[m.status] || m.status}
                      </span>
                      {m.error_message && (
                        <p className="text-xs text-red-400/70 mt-0.5 truncate max-w-[200px]">{m.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {m.sent_at ? new Date(m.sent_at).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Campaign list view
  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Campañas WhatsApp</h2>
          <p className="text-gray-400">Envíos masivos por WhatsApp vía Twilio</p>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && branches.length > 0 && (
            <select value={branchId || ""}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            + Nueva Campaña
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">No hay campañas creadas</p>
          <p className="text-gray-600 text-sm mt-2">Creá tu primera campaña de WhatsApp</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const progress = campaign.total_contacts > 0
              ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_contacts) * 100)
              : 0;

            return (
              <div key={campaign.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => openDetail(campaign)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-medium">{campaign.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[campaign.status]}`}>
                      {statusLabels[campaign.status] || campaign.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {(campaign.status === "draft" || campaign.status === "paused") && (
                      <button onClick={() => startCampaign(campaign)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors">
                        {campaign.status === "paused" ? "Reanudar" : "Iniciar"}
                      </button>
                    )}
                    {campaign.status === "running" && (
                      <button onClick={() => pauseCampaign(campaign)}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-medium transition-colors">
                        Pausar
                      </button>
                    )}
                    {campaign.status === "draft" && (
                      <>
                        <button onClick={() => openEdit(campaign)}
                          className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">Editar</button>
                        <button onClick={() => deleteCampaign(campaign)}
                          className="text-sm text-red-400 hover:text-red-300 font-medium">Eliminar</button>
                      </>
                    )}
                  </div>
                </div>

                {campaign.total_contacts > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{campaign.sent_count} enviados / {campaign.total_contacts} total</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-emerald-400">{campaign.delivered_count} entregados</span>
                      <span className="text-purple-400">{campaign.read_count} leídos</span>
                      <span className="text-cyan-400">{campaign.replied_count} respondidos</span>
                      {campaign.failed_count > 0 && <span className="text-red-400">{campaign.failed_count} fallidos</span>}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-600 mt-2">
                  Creada {new Date(campaign.created_at).toLocaleDateString("es-AR")}
                  {campaign.started_at && ` \u00b7 Iniciada ${new Date(campaign.started_at).toLocaleDateString("es-AR")}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
              <h3 className="text-xl font-bold text-white">{editing ? "Editar Campaña" : "Nueva Campaña"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre de campaña <span className="text-red-400">*</span></label>
                <input type="text" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Promo fin de semana" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Template SID (Twilio)</label>
                <input type="text" value={formData.template_sid}
                  onChange={(e) => setFormData({ ...formData, template_sid: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="HXxxxxxxxxxx (opcional)" />
                <p className="text-xs text-gray-500 mt-1">Si usás un template pre-aprobado, ingresá su SID</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Mensaje (si no usás template)</label>
                <textarea value={formData.message_body}
                  onChange={(e) => setFormData({ ...formData, message_body: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 h-28 resize-none"
                  placeholder={"{{nombre}}, tenemos una promo especial para vos!\n\nUsá el código DESCUENTO20 y obtené un 20% OFF."} />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: {"{{nombre}}"}, {"{{telefono}}"}, {"{{saludo}}"}, {"{{intro}}"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Variantes de saludo (una por línea)</label>
                <textarea value={formData.greeting_variants}
                  onChange={(e) => setFormData({ ...formData, greeting_variants: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 h-20 resize-none"
                  placeholder={"Hola!\nBuenas!\n¡Hola, qué tal!"} />
                <p className="text-xs text-gray-500 mt-1">Se elige una al azar por cada mensaje para evitar detección</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                  {saving ? "Guardando..." : editing ? "Guardar" : "Crear Campaña"}
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
