import { useEffect, useRef, useState } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

interface CustomerPoint {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  orderCount: number;
  totalSpent: number;
}

interface Props {
  customers: CustomerPoint[];
  branchAddress: string;
  onClose: () => void;
}

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#383838" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
];

export default function CustomerMapModal({ customers, branchAddress, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<"points" | "heatmap">("points");
  const [mapReady, setMapReady] = useState(false);

  // Load Google Maps script with visualization library
  useEffect(() => {
    if (!API_KEY) return;

    if (window.google?.maps?.visualization) {
      setLoaded(true);
      return;
    }

    // Remove existing script that may not have visualization lib
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      // Check if visualization is already loaded
      if (window.google?.maps?.visualization) {
        setLoaded(true);
        return;
      }
      // Need to wait for it or it's missing the lib - reload
      existing.remove();
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init map once loaded
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstanceRef.current) return;

    // Default center (Buenos Aires)
    const defaultCenter = { lat: -34.6037, lng: -58.3816 };

    const map = new google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 13,
      styles: DARK_MAP_STYLES,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mapInstanceRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();

    // Geocode branch address to center map
    if (branchAddress) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: branchAddress }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          map.setCenter(loc);

          // Store marker
          new google.maps.Marker({
            position: loc,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: "#10b981",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
            title: "Tu local",
            zIndex: 999,
          });

          // 3km circle
          circleRef.current = new google.maps.Circle({
            map,
            center: loc,
            radius: 3000,
            strokeColor: "#10b981",
            strokeOpacity: 0.6,
            strokeWeight: 2,
            fillColor: "#10b981",
            fillOpacity: 0.08,
          });
        }
        setMapReady(true);
      });
    } else {
      // No address — center on customers centroid
      if (customers.length > 0) {
        const avgLat = customers.reduce((s, c) => s + c.lat, 0) / customers.length;
        const avgLng = customers.reduce((s, c) => s + c.lng, 0) / customers.length;
        map.setCenter({ lat: avgLat, lng: avgLng });
      }
      setMapReady(true);
    }
  }, [loaded, branchAddress, customers]);

  // Add customer markers & heatmap data
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (heatmapRef.current) heatmapRef.current.setMap(null);

    const heatmapData: google.maps.LatLng[] = [];

    customers.forEach((c) => {
      const pos = new google.maps.LatLng(c.lat, c.lng);
      heatmapData.push(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map: mode === "points" ? map : null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#f59e0b",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
        title: c.name,
      });

      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(`
          <div style="color:#111;font-family:system-ui;padding:4px">
            <p style="font-weight:700;font-size:14px;margin:0 0 4px">${c.name}</p>
            <p style="font-size:12px;margin:0;color:#555">${c.phone}</p>
            <p style="font-size:12px;margin:4px 0 0;color:#333">
              ${c.orderCount} pedido${c.orderCount !== 1 ? "s" : ""} · $${c.totalSpent.toLocaleString("es-AR")}
            </p>
          </div>
        `);
        infoWindowRef.current?.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Heatmap layer
    heatmapRef.current = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: mode === "heatmap" ? map : null,
      radius: 40,
      opacity: 0.7,
    });
  }, [mapReady, customers, mode]);

  // Toggle visibility when mode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    markersRef.current.forEach((m) => m.setMap(mode === "points" ? map : null));
    if (heatmapRef.current) heatmapRef.current.setMap(mode === "heatmap" ? map : null);
  }, [mode]);

  if (!API_KEY) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center max-w-md" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-400">Configurá VITE_GOOGLE_MAPS_KEY en .env para ver el mapa</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gray-950" onClick={onClose}>
      <div className="flex-1 flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white">Mapa de Clientes</h2>
            <span className="text-sm text-gray-400">{customers.length} clientes con ubicación</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle */}
            <div className="flex bg-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setMode("points")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "points" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Puntos
              </button>
              <button
                onClick={() => setMode("heatmap")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === "heatmap" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Mapa de calor
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-5 py-2 bg-gray-900/80 border-b border-gray-800 text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white inline-block" />
            Tu local
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 border border-white inline-block" />
            Clientes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-3 rounded border border-emerald-500/60 bg-emerald-500/10 inline-block" />
            Radio 3 km
          </span>
        </div>

        {/* Map */}
        <div ref={mapRef} className="flex-1" />
      </div>
    </div>
  );
}
