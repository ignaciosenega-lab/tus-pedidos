import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";

interface Snapshot {
  id: number;
  name: string;
  created_at: string;
  created_by: string | null;
  source: "manual" | "auto";
  reason: string | null;
  size_bytes: number;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string): string {
  // s viene en formato "YYYY-MM-DD HH:MM:SS" (hora local del server).
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SnapshotsPage() {
  const { apiFetch } = useApi();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState<"all" | "manual" | "auto">("all");

  // Recuperar una categoría puntual desde un snapshot (sin rollback completo).
  const [recoverName, setRecoverName] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverData, setRecoverData] = useState<
    | { categoryId: number; categoryName: string; found: { snapshotId: number; name: string; created_at: string; count: number }[] }
    | null
  >(null);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);

  async function searchCategoryRecover() {
    const q = recoverName.trim();
    if (!q || recoverLoading) return;
    setRecoverLoading(true);
    setRecoverMsg(null);
    setRecoverData(null);
    try {
      const data = await apiFetch<any>(`/api/snapshots/recover-category?category=${encodeURIComponent(q)}`);
      setRecoverData(data);
      if (!data.found || data.found.length === 0) {
        setRecoverMsg(`No se encontraron productos de "${data.categoryName || q}" en ningún punto guardado.`);
      }
    } catch (e: any) {
      setRecoverMsg("Error: " + e.message);
    } finally {
      setRecoverLoading(false);
    }
  }

  async function applyCategoryRecover(snapshotId: number, categoryId: number, count: number, when: string) {
    if (!window.confirm(`Vas a recuperar ${count} producto(s) de esta categoría desde el punto del ${formatDate(when)}.\n\nNo se borra ni se pisa nada más. ¿Continuar?`)) return;
    setWorking(true);
    try {
      const res = await apiFetch<any>(`/api/snapshots/${snapshotId}/recover-category`, {
        method: "POST",
        body: JSON.stringify({ categoryId }),
      });
      alert(`Listo: se recuperaron ${res.restored} producto(s):\n` + (res.products || []).map((p: any) => "· " + p.name).join("\n"));
      setRecoverData(null);
      setRecoverName("");
      await loadSnapshots();
    } catch (e: any) {
      alert("Error al recuperar: " + e.message);
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    loadSnapshots();
  }, []);

  async function loadSnapshots() {
    try {
      setLoading(true);
      const data = await apiFetch<Snapshot[]>("/api/snapshots");
      setSnapshots(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Error al cargar puntos");
    } finally {
      setLoading(false);
    }
  }

  async function createSnapshot() {
    if (creating) return;
    setCreating(true);
    try {
      await apiFetch("/api/snapshots", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() || undefined }),
      });
      setNewName("");
      setShowCreate(false);
      await loadSnapshots();
    } catch (e: any) {
      alert("Error al crear punto: " + e.message);
    } finally {
      setCreating(false);
    }
  }

  async function restoreSnapshot(s: Snapshot) {
    const msg =
      `Vas a reemplazar TODA la configuración actual (productos, promos, cupones, ` +
      `menús, horarios, zonas de envío) con la del punto:\n\n"${s.name}"\n\n` +
      `Los pedidos y los clientes NO se tocan. Antes de aplicarlo, el sistema crea ` +
      `un punto automático del estado actual por si querés volver.\n\n¿Continuar?`;
    if (!window.confirm(msg)) return;
    setWorking(true);
    try {
      await apiFetch(`/api/snapshots/${s.id}/restore`, { method: "POST" });
      alert("Restaurado. La página se va a recargar para reflejar los cambios.");
      window.location.reload();
    } catch (e: any) {
      alert("Error al restaurar: " + e.message);
      setWorking(false);
    }
  }

  async function deleteSnapshot(s: Snapshot) {
    if (!window.confirm(`¿Eliminar el punto "${s.name}"? Esta acción no se puede deshacer.`)) return;
    setWorking(true);
    try {
      await apiFetch(`/api/snapshots/${s.id}`, { method: "DELETE" });
      await loadSnapshots();
    } catch (e: any) {
      alert("Error al eliminar: " + e.message);
    } finally {
      setWorking(false);
    }
  }

  const filtered = snapshots.filter((s) => filter === "all" || s.source === filter);

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Puntos de restauración</h2>
          <p className="text-gray-400 text-sm mt-1">
            Guardá un punto antes de hacer cambios grandes. Si algo sale mal, restaurá en un click y volvés al estado anterior. Los pedidos del cliente no se tocan.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
        >
          + Crear punto
        </button>
      </div>

      {/* Recuperar una categoría puntual (sin rollback completo) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h3 className="text-white font-semibold text-sm">Recuperar una categoría</h3>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          ¿Se borraron los productos de una categoría? Buscala y restaurá solo esa, desde el punto donde todavía estaban — sin tocar el resto.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={recoverName}
            onChange={(e) => setRecoverName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchCategoryRecover()}
            placeholder="Nombre de la categoría (ej. Bebidas)"
            className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={searchCategoryRecover}
            disabled={recoverLoading || !recoverName.trim()}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {recoverLoading ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {recoverMsg && <p className="text-xs text-amber-400 mt-3">{recoverMsg}</p>}
        {recoverData && recoverData.found.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-400">
              "{recoverData.categoryName}" encontrada en {recoverData.found.length} punto(s). Recuperá desde el más reciente que la tenga completa:
            </p>
            {recoverData.found.map((f) => (
              <div key={f.snapshotId} className="flex items-center justify-between gap-3 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-200 min-w-0">
                  {formatDate(f.created_at)} · <span className="text-emerald-400 font-semibold">{f.count} producto(s)</span>
                </span>
                <button
                  onClick={() => applyCategoryRecover(f.snapshotId, recoverData.categoryId, f.count, f.created_at)}
                  disabled={working}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  Recuperar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-2 mb-4">
        {(["all", "manual", "auto"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f === "all" ? "Todos" : f === "manual" ? "📌 Manuales" : "🕐 Automáticos"}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} {filtered.length === 1 ? "punto" : "puntos"}
        </span>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-gray-800 rounded-xl">
          {filter === "all" ? "Todavía no hay puntos. Creá el primero con + Crear punto." : "No hay puntos en este filtro."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg leading-none">
                    {s.source === "manual" ? "📌" : "🕐"}
                  </span>
                  <h3 className="text-white font-semibold truncate">{s.name}</h3>
                  {s.source === "auto" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-700/50 text-gray-300 px-1.5 py-0.5 rounded-full">
                      AUTO
                    </span>
                  )}
                  {s.reason && (
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                      · {s.reason}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(s.created_at)}
                  {s.created_by && ` · por ${s.created_by}`}
                  {` · ${formatBytes(s.size_bytes)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => restoreSnapshot(s)}
                  disabled={working}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  Restaurar
                </button>
                <button
                  onClick={() => deleteSnapshot(s)}
                  disabled={working}
                  className="text-gray-500 hover:text-red-400 disabled:opacity-50 p-1.5"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de crear punto */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Crear punto de restauración</h3>
            <p className="text-sm text-gray-400 mb-4">
              Vas a guardar un snapshot del estado actual de productos, promos, cupones, menús y horarios.
            </p>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nombre (opcional)
            </label>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createSnapshot();
                if (e.key === "Escape") setShowCreate(false);
              }}
              placeholder="Antes de promos del finde, Catálogo de mayo, etc."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si lo dejás vacío, se nombra con fecha y hora.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={createSnapshot}
                disabled={creating}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold"
              >
                {creating ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
