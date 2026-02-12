import { useEffect, useRef, useState } from "react";

interface Props {
  onSelect: (result: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  value: string;
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

export default function GoogleAddressPicker({ onSelect, value }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // Load Google Maps script
  useEffect(() => {
    if (!API_KEY) return;
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

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
      <label className="block text-sm text-gray-300 font-medium">
        Dirección
      </label>
      <p className="text-xs text-yellow-400">Verifique su domicilio</p>
      <input
        ref={inputRef}
        type="text"
        placeholder="Dirección Google Map"
        defaultValue={value}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
      />

      {API_KEY ? (
        <div
          ref={mapRef}
          className="w-full h-48 rounded-lg overflow-hidden bg-gray-800 mt-2"
        >
          {!coords && (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
              Seleccioná una dirección para ver el mapa
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-48 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500 text-sm mt-2">
          Configurá VITE_GOOGLE_MAPS_KEY en .env para ver el mapa
        </div>
      )}
    </div>
  );
}
