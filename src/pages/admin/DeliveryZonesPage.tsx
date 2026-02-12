import { useRef, useState, useEffect } from "react";
import { useAdmin, useAdminDispatch } from "../../store/adminContext";
import { parseKML } from "../../utils/kmlParser";
import type { DeliveryZone } from "../../types";
import { formatPrice } from "../../utils/money";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

export default function DeliveryZonesPage() {
  const { deliveryZones } = useAdmin();
  const dispatch = useAdminDispatch();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polygon[]>([]);

  const [error, setError] = useState("");
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  /* ── KML Upload ────────────────────────────── */

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".kml")) {
      setError("Solo se aceptan archivos .kml");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const zones = parseKML(text);
        if (zones.length === 0) {
          setError("No se encontraron zonas (polígonos) en el archivo KML.");
          return;
        }
        dispatch({ type: "SET_DELIVERY_ZONES", payload: zones });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al procesar el KML.");
      }
    };
    reader.readAsText(file);

    // reset input so same file can be re-uploaded
    e.target.value = "";
  }

  /* ── Google Maps ───────────────────────────── */

  // Load script
  useEffect(() => {
    if (!API_KEY) return;
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => setMapLoaded(true));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Draw polygons
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: -34.6437, lng: -58.5289 }, // Liniers
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
        ],
      });
    }

    // Clear old polygons
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    // Draw new
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    deliveryZones.forEach((zone) => {
      const path = zone.polygon.map((p) => ({ lat: p.lat, lng: p.lng }));
      if (path.length === 0) return;

      path.forEach((p) => {
        bounds.extend(p);
        hasPoints = true;
      });

      const poly = new google.maps.Polygon({
        paths: path,
        strokeColor: zone.color,
        strokeOpacity: zone.active ? 0.9 : 0.3,
        strokeWeight: 2,
        fillColor: zone.color,
        fillOpacity: zone.active ? 0.2 : 0.05,
        map: mapInstanceRef.current,
      });
      polylinesRef.current.push(poly);
    });

    if (hasPoints) {
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [mapLoaded, deliveryZones]);

  /* ── Zone editing ──────────────────────────── */

  function saveCost() {
    if (!editingZone) return;
    dispatch({ type: "UPDATE_ZONE", payload: editingZone });
    setEditingZone(null);
  }

  /* ── Render ────────────────────────────────── */

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Zonas de envío</h2>
          <p className="text-gray-500 text-sm mt-1">
            Subí un archivo .kml de Google My Maps para delimitar las zonas de delivery y asignar costos.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFileSelect}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Subir .kml
          </button>
          {deliveryZones.length > 0 && (
            <button
              onClick={() => dispatch({ type: "CLEAR_ZONES" })}
              className="bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Limpiar todo
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".kml"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Mapa ─────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
        {API_KEY ? (
          <div ref={mapRef} className="w-full h-72 sm:h-96">
            {deliveryZones.length === 0 && (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                Subí un .kml para ver las zonas en el mapa
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-72 sm:h-96 flex flex-col items-center justify-center text-gray-500 text-sm gap-2 p-8">
            <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p>Configurá <span className="font-mono text-gray-400">VITE_GOOGLE_MAPS_KEY</span> en .env para ver el mapa</p>
            <p className="text-gray-600">Las zonas se guardan igualmente sin mapa</p>
          </div>
        )}
      </div>

      {/* ── Cómo crear el KML ────────────────── */}
      {deliveryZones.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-3">Cómo crear tu archivo .kml</h3>
          <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
            <li>Abrí <a href="https://www.google.com/maps/d/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Google My Maps</a> y creá un nuevo mapa</li>
            <li>Usá la herramienta de polígono para dibujar cada zona de envío</li>
            <li>Ponele nombre a cada zona (ej: "Zona 1 - Liniers", "Zona 2 - Mataderos")</li>
            <li>Hacé click en los 3 puntos del menú del mapa y elegí <strong className="text-gray-300">"Exportar a KML/KMZ"</strong></li>
            <li>Asegurate de tildar <strong className="text-gray-300">"Exportar como KML"</strong> (no KMZ)</li>
            <li>Subí el archivo acá y configurá el costo de cada zona</li>
          </ol>
        </div>
      )}

      {/* ── Lista de zonas ───────────────────── */}
      {deliveryZones.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">
              {deliveryZones.length} zona{deliveryZones.length !== 1 && "s"} cargada{deliveryZones.length !== 1 && "s"}
            </h3>
          </div>

          <div className="divide-y divide-gray-800">
            {deliveryZones.map((zone) => (
              <div
                key={zone.id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  !zone.active ? "opacity-50" : ""
                }`}
              >
                {/* Color dot */}
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: zone.color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{zone.name}</p>
                  <p className="text-gray-500 text-xs">
                    {zone.polygon.length} puntos
                  </p>
                </div>

                {/* Cost */}
                <div className="text-right shrink-0">
                  <p className="text-emerald-400 font-bold">
                    {zone.cost > 0 ? formatPrice(zone.cost) : "Gratis"}
                  </p>
                  <p className="text-gray-600 text-xs">costo envío</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditingZone({ ...zone })}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="Editar costo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => dispatch({ type: "TOGGLE_ZONE_ACTIVE", payload: zone.id })}
                    className={`p-1 transition-colors ${
                      zone.active
                        ? "text-emerald-400 hover:text-emerald-300"
                        : "text-gray-600 hover:text-gray-400"
                    }`}
                    title={zone.active ? "Desactivar" : "Activar"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={zone.active ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-4.879-4.879"} />
                    </svg>
                  </button>
                  <button
                    onClick={() => dispatch({ type: "DELETE_ZONE", payload: zone.id })}
                    className="text-gray-400 hover:text-red-400 transition-colors p-1"
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
        </div>
      )}

      {/* ── Edit zone modal ──────────────────── */}
      {editingZone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditingZone(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: editingZone.color }}
                />
                <h3 className="text-lg font-bold text-white">{editingZone.name}</h3>
              </div>
              <button
                onClick={() => setEditingZone(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre de la zona</label>
                <input
                  value={editingZone.name}
                  onChange={(e) =>
                    setEditingZone((z) => (z ? { ...z, name: e.target.value } : z))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Costo de envío ($)</label>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-lg">$</span>
                  <input
                    type="number"
                    min={0}
                    value={editingZone.cost}
                    onChange={(e) =>
                      setEditingZone((z) =>
                        z ? { ...z, cost: Number(e.target.value) } : z
                      )
                    }
                    className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <span className="text-gray-500 text-sm">0 = envío gratis</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Color en el mapa</label>
                <input
                  type="color"
                  value={editingZone.color}
                  onChange={(e) =>
                    setEditingZone((z) => (z ? { ...z, color: e.target.value } : z))
                  }
                  className="w-12 h-10 rounded-lg border border-gray-700 bg-transparent cursor-pointer"
                />
              </div>

              <div className="bg-gray-800 rounded-lg p-3 text-sm">
                <p className="text-gray-500 text-xs mb-1">Puntos del polígono</p>
                <p className="text-white">{editingZone.polygon.length} coordenadas</p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    editingZone.active ? "bg-emerald-600" : "bg-gray-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      editingZone.active ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                  <input
                    type="checkbox"
                    checked={editingZone.active}
                    onChange={(e) =>
                      setEditingZone((z) =>
                        z ? { ...z, active: e.target.checked } : z
                      )
                    }
                    className="sr-only"
                  />
                </div>
                <span className="text-sm text-gray-300">Zona activa</span>
              </label>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button
                onClick={() => setEditingZone(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveCost}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
