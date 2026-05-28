import { useEffect, useRef, useState } from "react";
import {
  loadGoogleMaps,
  isGoogleMapsConfigured,
} from "../utils/loadGoogleMaps";
import {
  geocodeAddress,
  getCachedCoords,
  type Coords,
} from "../utils/geocodeCache";

// Forma mínima que el mapa necesita de cada sucursal. Subset de PublicBranch
// para no acoplar este componente a la página.
export interface BranchForMap {
  id: number;
  slug: string;
  name: string;
  address: string;
  isOpen: boolean;
  nextOpenTime: string | null;
  holidayReason: string | null;
}

interface Props {
  branches: BranchForMap[];
  onSelect: (branch: BranchForMap) => void;
  userLocation: Coords | null;
}

// Mismo estilo oscuro que CustomerMapModal — coherencia visual con el resto del admin.
const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#383838" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires
const USER_RADIUS_METERS = 3000; // 3 km — zona cercana al usuario.

export default function BranchMapView({ branches, onSelect, userLocation }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const userCircleRef = useRef<google.maps.Circle | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar el script + libs.
  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    loadGoogleMaps(["places"])
      .then(() => setLoaded(true))
      .catch((e) => setError(e?.message || "No se pudo cargar el mapa"));
  }, []);

  // Inicializar el mapa una vez cargado el script.
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
      styles: DARK_MAP_STYLES as google.maps.MapTypeStyle[],
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    });
    infoWindowRef.current = new google.maps.InfoWindow();
  }, [loaded]);

  // Pintar / repintar pines cuando cambia el listado o el estado de carga.
  useEffect(() => {
    if (!loaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Limpiar pines anteriores.
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let anyPinned = false;

    async function placeBranch(branch: BranchForMap) {
      if (!branch.address) return;
      const coords =
        getCachedCoords(branch.address) ||
        (await geocodeAddress(branch.address));
      if (!coords) return;

      const marker = new google.maps.Marker({
        position: coords,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: branch.isOpen ? "#10b981" : "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: branch.name,
      });

      marker.addListener("click", () => {
        const statusBadge = branch.isOpen
          ? `<span style="display:inline-block;background:#10b98133;color:#10b981;font-size:11px;font-weight:600;padding:2px 6px;border-radius:9999px">Abierto</span>`
          : `<span style="display:inline-block;background:#ef444433;color:#ef4444;font-size:11px;font-weight:600;padding:2px 6px;border-radius:9999px">Cerrado</span>`;
        const subline =
          !branch.isOpen && branch.nextOpenTime
            ? branch.holidayReason
              ? `<p style="margin:6px 0 0;color:#f59e0b;font-size:11px">Cerrado por ${branch.holidayReason}</p>`
              : `<p style="margin:6px 0 0;color:#f59e0b;font-size:11px">Abre a las ${branch.nextOpenTime}hs</p>`
            : "";
        infoWindowRef.current?.setContent(`
          <div style="color:#111;font-family:system-ui;padding:6px 4px 4px;min-width:200px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
              <p style="font-weight:700;font-size:14px;margin:0">${branch.name}</p>
              ${statusBadge}
            </div>
            <p style="font-size:12px;margin:0;color:#555">${branch.address}</p>
            ${subline}
            <button id="branch-enter-${branch.id}" style="margin-top:10px;width:100%;background:#10b981;color:white;border:none;border-radius:8px;padding:8px 10px;font-weight:600;font-size:13px;cursor:pointer">
              Entrar a esta sucursal
            </button>
          </div>
        `);
        infoWindowRef.current?.open(map, marker);
        // Esperar al render del DOM del InfoWindow para conectar el listener.
        google.maps.event.addListenerOnce(infoWindowRef.current!, "domready", () => {
          const btn = document.getElementById(`branch-enter-${branch.id}`);
          btn?.addEventListener("click", () => onSelect(branch));
        });
      });

      markersRef.current.push(marker);
      bounds.extend(coords);
      anyPinned = true;
    }

    Promise.all(branches.map(placeBranch)).then(() => {
      if (userLocation) {
        // Si hay ubicación del usuario, enfocamos la "zona cercana" de 3 km:
        // un bounds aproximado de un círculo de 3 km de radio. Las sucursales
        // que queden fuera del círculo siguen visibles en el mapa (panéandolo),
        // pero el encuadre inicial prioriza lo que tenés cerca.
        const circle = new google.maps.Circle({
          center: userLocation,
          radius: USER_RADIUS_METERS,
        });
        map.fitBounds(circle.getBounds()!, 32);
      } else if (anyPinned) {
        map.fitBounds(bounds, 64);
        // Si solo hay un pin, fitBounds zoomea demasiado. Acotamos.
        google.maps.event.addListenerOnce(map, "idle", () => {
          if ((map.getZoom() ?? 0) > 15) map.setZoom(15);
        });
      }
    });
  }, [loaded, branches, onSelect, userLocation]);

  // Pin del usuario + círculo de 3 km (separado para no rehacer todo cuando
  // cambia su ubicación).
  useEffect(() => {
    if (!loaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }
    if (userCircleRef.current) {
      userCircleRef.current.setMap(null);
      userCircleRef.current = null;
    }
    if (!userLocation) return;

    userMarkerRef.current = new google.maps.Marker({
      position: userLocation,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#3b82f6",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      title: "Tu ubicación",
      zIndex: 999,
    });

    userCircleRef.current = new google.maps.Circle({
      map,
      center: userLocation,
      radius: USER_RADIUS_METERS,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.6,
      strokeWeight: 2,
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      clickable: false,
    });
  }, [loaded, userLocation]);

  if (!isGoogleMapsConfigured()) {
    return (
      <div
        className="w-full rounded-xl flex items-center justify-center text-sm opacity-70 px-6 py-12 text-center"
        style={{ backgroundColor: "var(--panel-bg)", color: "var(--general-text)" }}
      >
        Configurá <code className="px-1 opacity-80">VITE_GOOGLE_MAPS_KEY</code> en
        &nbsp;.env para ver el mapa de sucursales.
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {error && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div
        ref={mapRef}
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: "min(70vh, 640px)", minHeight: "420px" }}
      />
      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs opacity-70">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white inline-block" />
          Abierta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white inline-block" />
          Cerrada
        </span>
        {userLocation && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white inline-block" />
              Tu ubicación
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-2.5 rounded border border-blue-500/60 bg-blue-500/10 inline-block" />
              Radio 3 km
            </span>
          </>
        )}
      </div>
    </div>
  );
}
