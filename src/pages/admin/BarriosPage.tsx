import { useState, useEffect, useRef } from "react";
import { useApi } from "../../hooks/useApi";
import { useBranchId } from "../../hooks/useBranchId";
import { parseKML } from "../../utils/kmlParser";
import { loadGoogleMaps, isGoogleMapsUsable, mapsUnavailableMessage } from "../../utils/loadGoogleMaps";
import { geocodeAddressDetailed } from "../../utils/geocodeCache";

/**
 * Barrios cerrados / countries.
 *
 * Existe porque el campo "Barrio" de Clientes no sirve para agrupar: sale de
 * cortar la dirección por comas, así que "Ruta 58 km 15,5 Santa Rita" termina
 * como barrio "5 Santa Rita".
 *
 * Acá el barrio se define por su NOMBRE (y sus variantes escritas), y opcional-
 * mente por un POLÍGONO importado de Google My Maps, que gana cuando el pedido
 * tiene coordenadas.
 */

interface Barrio {
  id: number;
  name: string;
  aliases: string[];
  polygon: [number, number][];
  is_active: number;
  color: string;
  lat: number | null;
  lng: number | null;
  radio_m: number;
}

interface Sugerido {
  texto: string;
  direcciones: number;
}

const PALETA = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

export default function BarriosPage() {
  const { apiFetch } = useApi();
  const { branchId, branches, setBranchId, isMaster, loading: cargandoSucursal } = useBranchId();

  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [sugeridos, setSugeridos] = useState<Sugerido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [contexto, setContexto] = useState("");
  const [ubicando, setUbicando] = useState(false);
  const [ubicarMsg, setUbicarMsg] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const [editando, setEditando] = useState<Barrio | null>(null);
  const [nombre, setNombre] = useState("");
  const [aliasTexto, setAliasTexto] = useState("");
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (branchId) cargar();
  }, [branchId]);

  async function cargar() {
    if (!branchId) return;
    setCargando(true);
    setError(null);
    try {
      const [bs, sug] = await Promise.all([
        apiFetch<{ contexto: string; barrios: Barrio[] }>(`/api/branches/${branchId}/barrios`),
        apiFetch<{ sugeridos: Sugerido[] }>(`/api/branches/${branchId}/barrios/sugeridos`),
      ]);
      setBarrios(bs.barrios || []);
      setContexto(bs.contexto || "");
      setSugeridos(sug.sugeridos || []);
    } catch (e: any) {
      setError(e.message || "Error al cargar barrios");
    } finally {
      setCargando(false);
    }
  }

  function abrirNuevo(nombreInicial = "") {
    setEditando(null);
    setNombre(nombreInicial);
    setAliasTexto("");
    setModal(true);
  }

  function abrirEdicion(b: Barrio) {
    setEditando(b);
    setNombre(b.name);
    setAliasTexto((b.aliases || []).join(", "));
    setModal(true);
  }

  async function guardar() {
    if (!nombre.trim() || !branchId) return;
    setGuardando(true);
    try {
      const aliases = aliasTexto
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (editando) {
        await apiFetch(`/api/branches/${branchId}/barrios/${editando.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: nombre.trim(), aliases }),
        });
      } else {
        await apiFetch(`/api/branches/${branchId}/barrios`, {
          method: "POST",
          body: JSON.stringify({
            name: nombre.trim(),
            aliases,
            color: PALETA[barrios.length % PALETA.length],
          }),
        });
      }
      setModal(false);
      await cargar();
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(b: Barrio) {
    if (!branchId) return;
    if (!confirm(`¿Borrar "${b.name}"? Los pedidos no se tocan, solo dejan de agruparse.`)) return;
    await apiFetch(`/api/branches/${branchId}/barrios/${b.id}`, { method: "DELETE" });
    cargar();
  }

  // Le pregunta a Google dónde queda cada barrio y guarda el centro. Es lo que
  // hace que el agrupamiento funcione: las direcciones que entran por el
  // buscador vienen como calle y altura, sin el nombre del country, así que
  // buscar el nombre en el texto no encuentra nada. Con el centro y un radio,
  // se clasifica por dónde vive el cliente y no por cómo escribió.
  async function ubicarTodos() {
    if (!branchId) return;
    const faltan = barrios.filter((b) => b.lat === null && b.polygon.length < 3);
    if (!faltan.length) {
      setUbicarMsg("Todos los barrios ya tienen ubicación.");
      return;
    }
    if (!isGoogleMapsUsable()) {
      setUbicarMsg(mapsUnavailableMessage(true) || "Google Maps no está disponible.");
      return;
    }
    setUbicando(true);
    setUbicarMsg(null);
    let ok = 0;
    const sinSuerte: string[] = [];
    try {
      await loadGoogleMaps([], { ignorarToggle: true });
      for (let i = 0; i < faltan.length; i++) {
        const b = faltan[i];
        setUbicarMsg(`Ubicando… ${i + 1}/${faltan.length}`);
        const r = await geocodeAddressDetailed(b.name, { contexto });
        if (r.coords) {
          await apiFetch(`/api/branches/${branchId}/barrios/${b.id}`, {
            method: "PUT",
            body: JSON.stringify({ lat: r.coords.lat, lng: r.coords.lng }),
          });
          ok++;
        } else {
          sinSuerte.push(b.name);
        }
        await new Promise((res) => setTimeout(res, 120));
      }
      setUbicarMsg(
        `${ok} ubicado${ok === 1 ? "" : "s"}` +
          (sinSuerte.length ? ` · Google no encontró: ${sinSuerte.join(", ")}` : "")
      );
      await cargar();
    } catch (e: any) {
      setUbicarMsg(e.message || "No se pudieron ubicar");
    } finally {
      setUbicando(false);
    }
  }

  async function cambiarRadio(b: Barrio, metros: number) {
    if (!branchId) return;
    await apiFetch(`/api/branches/${branchId}/barrios/${b.id}`, {
      method: "PUT",
      body: JSON.stringify({ radio_m: metros }),
    });
    setBarrios((prev) => prev.map((x) => (x.id === b.id ? { ...x, radio_m: metros } : x)));
  }

  // Mismo flujo que Zonas de Envío: se exporta el KML de My Maps y se sube acá.
  async function importarKml(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo || !branchId) return;
    setImportando(true);
    try {
      const texto = await archivo.text();
      const encontrados = parseKML(texto);
      if (!encontrados.length) {
        alert("No se encontraron polígonos en el archivo.\nAsegurate de exportar como KML (no KMZ) y de que cada barrio tenga al menos 3 puntos.");
        return;
      }
      let n = 0;
      for (const z of encontrados) {
        // Si ya existe un barrio con ese nombre, se le agrega el contorno en
        // vez de duplicarlo: lo más común es cargar primero el nombre y dibujar
        // el polígono después.
        const existente = barrios.find(
          (b) => b.name.trim().toLowerCase() === z.name.trim().toLowerCase()
        );
        if (existente) {
          await apiFetch(`/api/branches/${branchId}/barrios/${existente.id}`, {
            method: "PUT",
            body: JSON.stringify({ polygon: z.polygon }),
          });
        } else {
          await apiFetch(`/api/branches/${branchId}/barrios`, {
            method: "POST",
            body: JSON.stringify({
              name: z.name,
              aliases: [],
              polygon: z.polygon,
              color: PALETA[(barrios.length + n) % PALETA.length],
            }),
          });
        }
        n++;
      }
      alert(`Listo: ${n} barrio${n === 1 ? "" : "s"} con contorno.`);
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al importar el KML");
    } finally {
      setImportando(false);
      if (archivoRef.current) archivoRef.current.value = "";
    }
  }

  if (cargandoSucursal || cargando) {
    return (
      <div className="max-w-5xl">
        <div className="text-center py-12 text-gray-400">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Barrios cerrados</h2>
          <p className="text-gray-400 text-sm mt-1">
            Agrupá los clientes por country o barrio privado para saber cuántos tenés en cada uno.
            El conteo aparece en Métricas. Si esta sucursal no tiene barrios cerrados, dejá la
            lista vacía y no cambia nada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMaster && branches.length > 0 && (
            <select
              value={branchId || ""}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={ubicarTodos}
            disabled={ubicando || !barrios.length}
            title="Le pregunta a Google dónde queda cada barrio y guarda el centro. Una consulta por barrio, una sola vez."
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {ubicando ? "Ubicando…" : "Ubicar todos"}
          </button>
          <input ref={archivoRef} type="file" accept=".kml,.xml" onChange={importarKml} className="hidden" />
          <button
            onClick={() => archivoRef.current?.click()}
            disabled={importando}
            title="Dibujá los barrios en Google My Maps, exportá como KML y subilo. El contorno es opcional: sin él, el barrio se reconoce por el nombre."
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {importando ? "Importando…" : "Importar KML"}
          </button>
          <button
            onClick={() => abrirNuevo()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold whitespace-nowrap"
          >
            + Nuevo barrio
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {ubicarMsg && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-gray-300 text-sm mb-4">
          {ubicarMsg}
        </div>
      )}

      {/* Los nombres salen de las direcciones reales: no hay que inventarlos. */}
      {sugeridos.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <h3 className="text-white font-semibold text-sm">Encontrados en tus direcciones</h3>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Nombres que se repiten en las direcciones de esta sucursal y todavía no están cargados.
            Tocá uno para agregarlo.
          </p>
          <div className="flex flex-wrap gap-2">
            {sugeridos.map((s) => (
              <button
                key={s.texto}
                onClick={() => abrirNuevo(s.texto)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-200"
              >
                {s.texto}
                <span className="text-gray-500 ml-2">{s.direcciones}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {barrios.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">Todavía no cargaste ningún barrio cerrado.</p>
          <p className="text-gray-600 text-xs mt-1">
            Empezá por los de arriba, o agregá uno a mano con el nombre que escriben tus clientes.
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Barrio</th>
                <th className="px-4 py-3">También se escribe</th>
                <th className="px-4 py-3">Contorno</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {barrios.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-white font-medium text-sm">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: b.color }} />
                      {b.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {b.aliases?.length ? b.aliases.join(", ") : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {b.polygon?.length >= 3 ? (
                      <span className="text-emerald-400">contorno dibujado ({b.polygon.length} puntos)</span>
                    ) : b.lat !== null ? (
                      <span className="inline-flex items-center gap-2 text-gray-300">
                        centro +
                        <select
                          value={b.radio_m}
                          onChange={(e) => cambiarRadio(b, Number(e.target.value))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                        >
                          {[300, 500, 600, 800, 1000, 1500, 2000].map((m) => (
                            <option key={m} value={m}>{m} m</option>
                          ))}
                        </select>
                      </span>
                    ) : (
                      <span className="text-amber-500/80">sin ubicar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                    <button onClick={() => abrirEdicion(b)} className="text-emerald-400 hover:underline mr-3">
                      Editar
                    </button>
                    <button onClick={() => borrar(b)} className="text-red-400 hover:underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4">
              {editando ? "Editar barrio" : "Nuevo barrio"}
            </h3>

            <label className="block text-sm text-gray-400 mb-1">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Saint Thomas"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-4"
            />

            <label className="block text-sm text-gray-400 mb-1">También se escribe</label>
            <input
              value={aliasTexto}
              onChange={(e) => setAliasTexto(e.target.value)}
              placeholder="st thomas, saint tomas, sthomas"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Separadas por coma. Sirven para los que lo escriben distinto. No hace falta cuidar
              mayúsculas ni tildes.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-gray-300 text-sm">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || !nombre.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
