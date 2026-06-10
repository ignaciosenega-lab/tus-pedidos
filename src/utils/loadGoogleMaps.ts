// Loader compartido del script de Google Maps JS API.
// Centraliza la lógica que antes estaba duplicada en CustomerMapModal y GoogleAddressPicker:
// - Resuelve inmediato si window.google.maps ya tiene las libs pedidas.
// - Si hay un <script> en vuelo, se cuelga de su `load`.
// - Si hay uno cargado pero le faltan libs, lo remueve y reinyecta con la unión.

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

type Library = "places" | "visualization" | "geometry" | "drawing" | "marker";

let inflight: Promise<void> | null = null;
let loadedLibs: Set<Library> = new Set();

function hasAllLibs(libs: Library[]): boolean {
  const g = (window as any).google?.maps;
  if (!g) return false;
  return libs.every((lib) => {
    if (lib === "places") return !!g.places;
    if (lib === "visualization") return !!g.visualization;
    if (lib === "geometry") return !!g.geometry;
    if (lib === "drawing") return !!g.drawing;
    if (lib === "marker") return !!g.marker;
    return false;
  });
}

export function isGoogleMapsConfigured(): boolean {
  return !!API_KEY;
}

export function loadGoogleMaps(libraries: Library[] = []): Promise<void> {
  if (!API_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_KEY no está configurado"));
  }

  // Ya tenemos todo lo pedido en memoria.
  if (hasAllLibs(libraries)) {
    libraries.forEach((l) => loadedLibs.add(l));
    return Promise.resolve();
  }

  // Si hay una carga en vuelo, esperamos a que termine; si después de eso
  // todavía faltan libs, recursamos para forzar el reinyect.
  if (inflight) {
    return inflight.then(() => {
      if (hasAllLibs(libraries)) return;
      return loadGoogleMaps(libraries);
    });
  }

  // Buscar un <script> existente — puede haber sido inyectado por otro código
  // (por ejemplo el loader viejo de CustomerMapModal o GoogleAddressPicker
  // antes del refactor). Si está cargado pero le faltan libs, lo removemos.
  const existing = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]'
  ) as HTMLScriptElement | null;

  if (existing) {
    if ((window as any).google?.maps) {
      // Ya cargó pero le faltan libs: hay que reinyectar con la unión.
      existing.remove();
    } else {
      // En vuelo: esperamos su `load` y reintentamos si faltan libs.
      inflight = new Promise<void>((resolve, reject) => {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Falló la carga del script de Google Maps"))
        );
      });
      const p = inflight.then(() => {
        inflight = null;
        if (hasAllLibs(libraries)) return;
        return loadGoogleMaps(libraries);
      });
      return p;
    }
  }

  // Unión de libs ya solicitadas + las nuevas.
  const union = Array.from(new Set<Library>([...loadedLibs, ...libraries]));
  const libsParam = union.length ? `&libraries=${union.join(",")}` : "";

  inflight = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    // loading=async es el patrón recomendado por Google desde Mar 2024:
    // https://goo.gle/js-api-loading. Sin esto, Google tira un warning en consola
    // y reserva el derecho a degradar performance.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}${libsParam}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      union.forEach((l) => loadedLibs.add(l));
      resolve();
    };
    script.onerror = () =>
      reject(new Error("Falló la carga del script de Google Maps"));
    document.head.appendChild(script);
  });

  return inflight.then(() => {
    inflight = null;
  });
}
