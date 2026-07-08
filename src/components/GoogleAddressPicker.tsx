import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, isGoogleMapsConfigured } from "../utils/loadGoogleMaps";
import { trackMapsLoad } from "../utils/trackMapsLoad";

interface Props {
  onSelect: (result: {
    address: string;
    lat: number | null;
    lng: number | null;
  }) => void;
  value: string;
  branchId?: number | null;
}

export default function GoogleAddressPicker({ onSelect, value, branchId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const lastSelectedRef = useRef<string>("");
  const trackedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  // Maps no disponible (sin key, error de red, o auth/billing fallando). En ese
  // caso el cliente escribe la dirección a mano y el pedido sale igual.
  const [failed, setFailed] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // Load Google Maps script
  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setFailed(true);
      return;
    }
    // Google llama a esta global si la key es rechazada (ej. BillingNotEnabled).
    // Definirla suprime el popup de error de Google y nos deja degradar suave.
    (window as any).gm_authFailure = () => setFailed(true);
    loadGoogleMaps(["places"])
      .then(() => {
        setLoaded(true);
        // Una sola carga contable por montaje (para el monitor de uso en el admin).
        if (!trackedRef.current) {
          trackedRef.current = true;
          trackMapsLoad(branchId);
        }
      })
      .catch(() => setFailed(true));
  }, [branchId]);

  // Init autocomplete
  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ar" },
      fields: ["formatted_address", "geometry"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address ?? "";
        lastSelectedRef.current = address;
        setCoords({ lat, lng });
        onSelect({ address, lat, lng });
      }
    });

    autocompleteRef.current = ac;
  }, [loaded, onSelect]);

  // Init / update map
  useEffect(() => {
    if (!loaded || !mapRef.current || !coords) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: coords,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
      });
    } else {
      mapInstanceRef.current.setCenter(coords);
    }

    if (markerRef.current) {
      markerRef.current.setPosition(coords);
    } else {
      markerRef.current = new google.maps.Marker({
        position: coords,
        map: mapInstanceRef.current,
      });
    }
  }, [loaded, coords]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium opacity-70" style={{ color: "var(--general-text)" }}>
        Dirección
      </label>
      <p className="text-xs text-yellow-400">
        {failed
          ? "Escribí tu dirección completa (calle, número, barrio y ciudad)"
          : "Verifique su domicilio"}
      </p>
      <input
        ref={inputRef}
        type="text"
        placeholder={failed ? "Ej: Av. Siempreviva 742, Springfield" : "Dirección Google Map"}
        defaultValue={value}
        onChange={(e) => {
          const v = e.target.value;
          // Si coincide con lo autocompletado por Google, ya mandamos coords; no pisar.
          if (v === lastSelectedRef.current) return;
          onSelect({ address: v, lat: null, lng: null });
        }}
        className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
        style={{
          backgroundColor: "var(--panel-bg)",
          color: "var(--general-text)",
          "--tw-ring-color": "var(--btn-bg)",
        } as React.CSSProperties}
      />

      {/* Mapa solo si Maps está OK. Si falla, el input a mano alcanza para el pedido. */}
      {!failed && (
        <div
          ref={mapRef}
          className="w-full h-48 rounded-lg overflow-hidden mt-2"
          style={{ backgroundColor: "var(--panel-bg)" }}
        >
          {!coords && (
            <div className="w-full h-full flex items-center justify-center text-sm opacity-50" style={{ color: "var(--general-text)" }}>
              Seleccioná una dirección para ver el mapa
            </div>
          )}
        </div>
      )}
    </div>
  );
}
