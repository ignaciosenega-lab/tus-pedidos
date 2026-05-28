// Geocoding cacheado en localStorage + helper de distancia (Haversine).
//
// Pensado para la pantalla de selección de sucursal: la primera vez que un
// navegador ve una dirección la geocodificamos con google.maps.Geocoder y
// guardamos el resultado; visitas siguientes leen del cache sin costo ni latencia.

export type Coords = { lat: number; lng: number };

const STORAGE_KEY = "branch-geocode-cache-v1";

function readCache(): Record<string, Coords> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(map: Record<string, Coords>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota excedida / modo privado: silencio */
  }
}

function normalize(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getCachedCoords(address: string): Coords | null {
  if (!address) return null;
  const cache = readCache();
  return cache[normalize(address)] ?? null;
}

/**
 * Devuelve {lat,lng} desde cache o geocodificando. Requiere que el script
 * de Google Maps ya esté cargado (usar loadGoogleMaps antes).
 * Falla silenciosamente: si el geocoder devuelve error o no hay window.google,
 * resuelve a `null` y no rompe la UI.
 */
export function geocodeAddress(address: string): Promise<Coords | null> {
  if (!address) return Promise.resolve(null);

  const cached = getCachedCoords(address);
  if (cached) return Promise.resolve(cached);

  const g = (window as any).google?.maps;
  if (!g?.Geocoder) return Promise.resolve(null);

  return new Promise<Coords | null>((resolve) => {
    try {
      const geocoder = new g.Geocoder();
      geocoder.geocode(
        { address },
        (results: any, status: string) => {
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            const coords: Coords = { lat: loc.lat(), lng: loc.lng() };
            const cache = readCache();
            cache[normalize(address)] = coords;
            writeCache(cache);
            resolve(coords);
          } else {
            resolve(null);
          }
        }
      );
    } catch {
      resolve(null);
    }
  });
}

/** Distancia en km entre dos puntos (fórmula de Haversine). */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371; // radio medio de la Tierra en km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sLat1 = Math.sin(dLat / 2);
  const sLng1 = Math.sin(dLng / 2);
  const aa =
    sLat1 * sLat1 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sLng1 * sLng1;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

/** Formatea distancia en km con sensibilidad: <1km en metros, sino con 1 decimal. */
export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
