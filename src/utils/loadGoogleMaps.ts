// Loader compartido del script de Google Maps JS API.
// Centraliza la lógica que antes estaba duplicada en CustomerMapModal y GoogleAddressPicker:
// - Resuelve inmediato si window.google.maps ya tiene las libs pedidas.
// - Si hay un <script> en vuelo, se cuelga de su `load`.
// - Si hay uno cargado pero le faltan libs, lo remueve y reinyecta con la unión.

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

// Estado del toggle de Configuración (viene de /api/state → businessConfig.mapsEnabled).
// Default OFF: no cargamos Maps hasta que la config diga que está habilitado, así
// nunca aparece el popup de error mientras esté apagado. Se prende desde el admin
// (Configuración) sin redeploy cuando la facturación de Google esté OK.
let enabledByConfig = false;
export function setMapsEnabled(v: boolean): void {
  enabledByConfig = !!v;
}

// Autodetección persistente: si la auth de Maps falló hace poco (billing/key),
// evitamos volver a cargar Maps para no mostrar el popup una y otra vez. Se
// reintenta solo después de la ventana (por si se arregla el billing).
const FAIL_TTL_MS = 3 * 60 * 60 * 1000; // 3 horas
function recentlyFailed(): boolean {
  try {
    const t = Number(localStorage.getItem("gmapsAuthFailedAt") || 0);
    return t > 0 && Date.now() - t < FAIL_TTL_MS;
  } catch {
    return false;
  }
}

let authFailed = recentlyFailed();

// Google llama a window.gm_authFailure cuando la key es rechazada. Definirlo ACÁ
// (al importar el módulo, antes de inyectar el script) suprime el popup por
// defecto y persistimos la falla para no reintentar en cada carga.
if (typeof window !== "undefined") {
  (window as any).gm_authFailure = () => {
    authFailed = true;
    try {
      localStorage.setItem("gmapsAuthFailedAt", String(Date.now()));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("gmaps-auth-failure"));
  };
}

function mapsEnabled(): boolean {
  return !!API_KEY && enabledByConfig && !authFailed;
}

export function isGoogleMapsAuthFailed(): boolean {
  return authFailed || !enabledByConfig;
}

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
  return mapsEnabled();
}

export function loadGoogleMaps(libraries: Library[] = []): Promise<void> {
  if (!mapsEnabled()) {
    return Promise.reject(new Error("Google Maps deshabilitado"));
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
    // Notar: aunque Google recomienda `loading=async`, ese modo cambia el
    // contrato de inicialización (hay que usar await importLibrary y no
    // `new google.maps.Map` directo). Como todo el código asume el patrón
    // clásico, NO agregamos `loading=async` — solo genera un warning en
    // consola pero el mapa funciona.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}${libsParam}`;
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
