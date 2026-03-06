import { useState, useEffect, useRef } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";

interface Contact {
  id: number;
  phone: string;
  name: string;
  source: string;
  opted_out: number;
  opted_out_at: string | null;
  branch_id: number | null;
  created_at: string;
}

export default function CampaignContactsPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, isMaster } = useBranchId();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [addPhone, setAddPhone] = useState("");
  const [addName, setAddName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadContacts(); }, [search, sourceFilter]);

  async function loadContacts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sourceFilter) params.set("source", sourceFilter);
      params.set("limit", "200");
      const data = await apiFetch<{ contacts: Contact[]; total: number }>(`/api/campaigns/contacts?${params}`);
      setContacts(data.contacts);
      setTotal(data.total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!addPhone.trim()) { alert("Teléfono requerido"); return; }
    try {
      setSaving(true);
      await apiFetch("/api/campaigns/contacts", {
        method: "POST",
        body: JSON.stringify({ phone: addPhone, name: addName, branch_id: branchId }),
      });
      setShowAddModal(false);
      setAddPhone("");
      setAddName("");
      loadContacts();
    } catch (err: any) {
      alert(err.message || "Error al agregar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(c: Contact) {
    if (!confirm(`¿Eliminar contacto "${c.name || c.phone}"?`)) return;
    try {
      await apiFetch(`/api/campaigns/contacts/${c.id}`, { method: "DELETE" });
      loadContacts();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  }

  async function syncFromCustomers() {
    try {
      setSyncing(true);
      setSyncResult(null);
      const data = await apiFetch<{ imported: number; skipped: number; total: number }>(
        "/api/campaigns/contacts/sync",
        { method: "POST", body: JSON.stringify({ branch_id: isMaster ? null : branchId }) }
      );
      setSyncResult(`${data.imported} contactos importados, ${data.skipped} omitidos (ya existían)`);
      loadContacts();
    } catch (err: any) {
      setSyncResult("Error: " + (err.message || "Error al sincronizar"));
    } finally {
      setSyncing(false);
    }
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { alert("CSV vacío o sin datos"); return; }

      // Parse header
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const phoneIdx = header.findIndex((h) => ["phone", "telefono", "teléfono", "celular", "tel"].includes(h));
      const nameIdx = header.findIndex((h) => ["name", "nombre", "nombre completo"].includes(h));

      if (phoneIdx === -1) {
        alert("El CSV debe tener una columna 'phone' o 'telefono'");
        return;
      }

      const contacts: { phone: string; name: string }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
        const phone = cols[phoneIdx];
        const name = nameIdx >= 0 ? cols[nameIdx] || "" : "";
        if (phone) contacts.push({ phone, name });
      }

      if (contacts.length === 0) { alert("No se encontraron contactos válidos en el CSV"); return; }

      try {
        setSaving(true);
        const data = await apiFetch<{ imported: number; skipped: number }>("/api/campaigns/contacts/import", {
          method: "POST",
          body: JSON.stringify({ contacts, branch_id: isMaster ? null : branchId }),
        });
        alert(`${data.imported} contactos importados, ${data.skipped} omitidos`);
        loadContacts();
      } catch (err: any) {
        alert(err.message || "Error al importar");
      } finally {
        setSaving(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  const sourceLabels: Record<string, string> = { manual: "Manual", import: "CSV", customer: "Cliente" };
  const sourceColors: Record<string, string> = {
    manual: "bg-blue-900/30 text-blue-400",
    import: "bg-purple-900/30 text-purple-400",
    customer: "bg-emerald-900/30 text-emerald-400",
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="max-w-5xl">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-gray-400 mt-4">Cargando contactos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Contactos de Campaña</h2>
          <p className="text-gray-400">{total} contactos en total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncFromCustomers} disabled={syncing}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors">
            {syncing ? "Sincronizando..." : "Sincronizar clientes"}
          </button>
          <label className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer">
            Importar CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
          </label>
          <button onClick={() => { setShowAddModal(true); setAddPhone(""); setAddName(""); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            + Agregar
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${syncResult.startsWith("Error") ? "bg-red-900/20 border border-red-900/50 text-red-400" : "bg-emerald-900/20 border border-emerald-900/50 text-emerald-400"}`}>
          {syncResult}
          <button onClick={() => setSyncResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">Cerrar</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          placeholder="Buscar por nombre o teléfono..." />
        <select value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500">
          <option value="">Todas las fuentes</option>
          <option value="manual">Manual</option>
          <option value="import">CSV</option>
          <option value="customer">Clientes</option>
        </select>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500">{search || sourceFilter ? "No se encontraron contactos" : "No hay contactos"}</p>
          <p className="text-gray-600 text-sm mt-2">Importá clientes existentes o cargá un CSV</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fuente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{c.name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 font-mono">{c.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceColors[c.source] || "bg-gray-700 text-gray-400"}`}>
                      {sourceLabels[c.source] || c.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.opted_out ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/30 text-red-400">Opt-out</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/30 text-emerald-400">Activo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteContact(c)}
                      className="text-sm text-red-400 hover:text-red-300 font-medium">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add contact modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-sm">
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Agregar Contacto</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={addContact} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono <span className="text-red-400">*</span></label>
                <input type="text" value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  placeholder="5491112345678" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input type="text" value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Juan Pérez" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                  {saving ? "Guardando..." : "Agregar"}
                </button>
                <button type="button" onClick={() => setShowAddModal(false)}
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
