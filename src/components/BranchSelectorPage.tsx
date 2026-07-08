import { useState, useEffect, useMemo, useRef } from "react";
import { useStorefront } from "../hooks/useStorefront";
import ThemeStyles from "./ThemeStyles";
import BranchMapView, { type BranchForMap } from "./BranchMapView";
import { trackMapsLoad } from "../utils/trackMapsLoad";
import {
  loadGoogleMaps,
  isGoogleMapsConfigured,
} from "../utils/loadGoogleMaps";
import {
  geocodeAddress,
  getCachedCoords,
  haversineKm,
  formatKm,
  type Coords,
} from "../utils/geocodeCache";

interface PublicBranch {
  id: number;
  slug: string;
  name: string;
  address: string;
  addressUrl: string;
  phone: string;
  whatsapp: string;
  logo: string;
  isOpen: boolean;
  nextOpenTime: string | null;
  holidayReason: string | null;
}

type View = "list" | "map";

// Ubicación elegida por el cliente vía Google Places Autocomplete sobre
// el buscador. Cuando está seteada, las sucursales se ordenan por
// cercanía a este punto en lugar de filtrar por texto.
type SearchLocation = { lat: number; lng: number; label: string };

export default function BranchSelectorPage() {
  const { businessConfig, branchDomain } = useStorefront();
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coordsByBranchId, setCoordsByBranchId] = useState<Record<number, Coords>>({});
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapsTrackedRef = useRef(false);

  useEffect(() => {
    fetch("/api/branches/public")
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Precarga el cache de coordenadas en background una vez que tenemos las
  // sucursales. Así el ordenamiento por distancia y el mapa son instantáneos
  // cuando el usuario los necesita.
  useEffect(() => {
    if (!branches.length || !isGoogleMapsConfigured()) return;
    let cancelled = false;

    loadGoogleMaps(["places"])
      .then(async () => {
        // Contar una carga de Maps por visitante para el monitor de uso del admin.
        if (!mapsTrackedRef.current && branches[0]) {
          mapsTrackedRef.current = true;
          trackMapsLoad(branches[0].id);
        }
        const entries = await Promise.all(
          branches.map(async (b) => {
            if (!b.address) return null;
            const coords =
              getCachedCoords(b.address) || (await geocodeAddress(b.address));
            return coords ? ([b.id, coords] as const) : null;
          })
        );
        if (cancelled) return;
        const map: Record<number, Coords> = {};
        entries.forEach((e) => {
          if (e) map[e[0]] = e[1];
        });
        setCoordsByBranchId(map);
      })
      .catch(() => {
        /* sin mapa el ordenamiento por distancia simplemente no aplica */
      });

    return () => {
      cancelled = true;
    };
  }, [branches]);

  // Conectar Google Places Autocomplete al input de búsqueda. Cuando el
  // cliente tipea una dirección y selecciona una sugerencia, fijamos
  // searchLocation con esas coords y las sucursales se ordenan por
  // cercanía a ese punto (sin filtro por texto).
  useEffect(() => {
    if (!isGoogleMapsConfigured() || !searchInputRef.current) return;
    let cancelled = false;
    loadGoogleMaps(["places"])
      .then(() => {
        if (cancelled || !searchInputRef.current || autocompleteRef.current) return;
        const ac = new google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: "ar" },
          fields: ["formatted_address", "geometry", "name"],
          types: ["geocode"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const label =
              place.formatted_address || place.name || "Ubicación buscada";
            setSearchLocation({ lat, lng, label });
            setSearch(label);
          }
        });
        autocompleteRef.current = ac;
      })
      .catch(() => {
        /* sin Places autocomplete la búsqueda sigue siendo solo por texto */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Punto de referencia para distancias y ordenamiento: la dirección
  // buscada gana sobre la geolocalización del navegador.
  const anchorLocation: Coords | null = useMemo(
    () =>
      searchLocation
        ? { lat: searchLocation.lat, lng: searchLocation.lng }
        : userLocation,
    [searchLocation, userLocation]
  );

  const filtered = useMemo(() => {
    // Cuando hay una dirección buscada, ignoramos el filtro por texto
    // (el input contiene la dirección de referencia) y mostramos todas
    // las sucursales ordenadas por cercanía.
    let base: PublicBranch[];
    if (searchLocation) {
      base = branches;
    } else {
      const q = search.toLowerCase().trim();
      base = q
        ? branches.filter(
            (b) =>
              b.name.toLowerCase().includes(q) ||
              b.address.toLowerCase().includes(q)
          )
        : branches;
    }

    if (!anchorLocation) return base;

    // Ordenar por distancia ascendente; las que no tienen coords cacheadas
    // van al final preservando el orden alfabético original.
    return [...base].sort((a, b) => {
      const ca = coordsByBranchId[a.id];
      const cb = coordsByBranchId[b.id];
      if (ca && cb) {
        return haversineKm(anchorLocation, ca) - haversineKm(anchorLocation, cb);
      }
      if (ca) return -1;
      if (cb) return 1;
      return 0;
    });
  }, [branches, search, searchLocation, anchorLocation, coordsByBranchId]);

  function goToBranch(branch: PublicBranch | BranchForMap) {
    const protocol = window.location.protocol;
    if (branchDomain) {
      window.location.href = `${protocol}//${branch.slug}.${branchDomain}`;
    } else {
      window.location.href = `/?branch=${branch.slug}`;
    }
  }

  function handleUseLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Tu navegador no soporta geolocalización.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("Permiso denegado. Habilitá la ubicación en tu navegador.");
        } else if (err.code === err.TIMEOUT) {
          setLocationError("No pudimos obtener tu ubicación a tiempo.");
        } else {
          setLocationError("No pudimos acceder a tu ubicación.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function clearLocation() {
    setUserLocation(null);
    setLocationError(null);
  }

  function clearSearchLocation() {
    setSearchLocation(null);
    setSearch("");
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--body-bg)", color: "var(--general-text)" }}
    >
      <ThemeStyles />

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 shadow-lg border-b border-white/10"
        style={{ backgroundColor: "var(--header-bg)", color: "var(--header-text)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {businessConfig.logo ? (
              <img
                src={businessConfig.logo}
                alt={businessConfig.title}
                className="object-contain"
                style={{ maxWidth: "220px", maxHeight: "80px" }}
              />
            ) : (
              <h1 className="text-lg font-bold tracking-wide">
                {businessConfig.title || "Tus Pedidos"}
              </h1>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 pt-28 pb-12">
        {/* Title section */}
        <section className="mb-5">
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "var(--title-text)" }}
          >
            Seleccioná tu sucursal
          </h1>
          <p className="mt-1 text-sm opacity-70">
            Elegí la sucursal donde querés hacer tu pedido
          </p>
        </section>

        {/* Toggle Lista / Mapa */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div
            className="inline-flex rounded-lg overflow-hidden border border-white/10"
            style={{ backgroundColor: "var(--panel-bg)" }}
            role="tablist"
            aria-label="Vista de sucursales"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === "list" ? "text-white" : "opacity-70 hover:opacity-100"
              }`}
              style={{
                backgroundColor: view === "list" ? "var(--btn-bg)" : "transparent",
                color: view === "list" ? "var(--btn-text)" : "inherit",
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Lista
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "map"}
              onClick={() => setView("map")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === "map" ? "text-white" : "opacity-70 hover:opacity-100"
              }`}
              style={{
                backgroundColor: view === "map" ? "var(--btn-bg)" : "transparent",
                color: view === "map" ? "var(--btn-text)" : "inherit",
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Mapa
              </span>
            </button>
          </div>

          {/* Botón de ubicación */}
          {userLocation ? (
            <button
              type="button"
              onClick={clearLocation}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-white/10 hover:border-white/25 transition-colors"
              style={{ backgroundColor: "var(--panel-bg)" }}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="opacity-90">Ubicación activa</span>
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-white/10 hover:border-white/25 transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--panel-bg)" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {locating ? "Ubicando..." : "Usar mi ubicación"}
            </button>
          )}
        </div>

        {locationError && (
          <div className="mb-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {locationError}
          </div>
        )}

        {/* Search */}
        <div className="mb-5">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar sucursal o ingresá tu dirección..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                // Si el usuario edita después de haber elegido una dirección,
                // soltamos el anchor para que vuelva a filtrar por texto.
                if (searchLocation) setSearchLocation(null);
              }}
              autoComplete="off"
              className="w-full border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{
                backgroundColor: "var(--panel-bg)",
                color: "var(--general-text)",
                "--tw-ring-color": "var(--btn-bg)",
              } as React.CSSProperties}
            />
            {search && (
              <button
                type="button"
                onClick={clearSearchLocation}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md opacity-50 hover:opacity-100"
                aria-label="Limpiar búsqueda"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchLocation && (
            <div
              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-200"
              role="status"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate max-w-[260px] sm:max-w-[420px]">
                Cerca de: {searchLocation.label}
              </span>
              <button
                type="button"
                onClick={clearSearchLocation}
                className="opacity-70 hover:opacity-100"
                aria-label="Quitar dirección de búsqueda"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="text-center py-12 opacity-50">Cargando sucursales...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 opacity-50">
            {search ? "No se encontraron sucursales" : "No hay sucursales disponibles"}
          </div>
        ) : view === "map" ? (
          <BranchMapView
            branches={filtered}
            onSelect={(b) => goToBranch(b)}
            userLocation={userLocation}
            searchLocation={searchLocation}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((branch) => {
              const coords = coordsByBranchId[branch.id];
              const distance =
                anchorLocation && coords ? haversineKm(anchorLocation, coords) : null;
              const distanceColor = searchLocation ? "text-violet-300" : "text-blue-400";
              return (
                <button
                  key={branch.id}
                  onClick={() => goToBranch(branch)}
                  data-testid="branch-card"
                  data-branch-slug={branch.slug}
                  data-branch-id={branch.id}
                  data-branch-name={branch.name}
                  className="text-left rounded-xl border border-white/10 p-3.5 transition-all hover:border-white/25 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: "var(--panel-bg)" }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3
                      className="font-bold text-sm truncate"
                      style={{ color: "var(--title-text)" }}
                    >
                      {branch.name}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        branch.isOpen
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          branch.isOpen ? "bg-emerald-400" : "bg-red-400"
                        }`}
                      />
                      {branch.isOpen ? "Abierto" : "Cerrado"}
                    </span>
                  </div>

                  {/* Address + distance */}
                  <p className="text-xs opacity-60 flex items-center gap-1.5 truncate">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{branch.address || "Sin dirección"}</span>
                    {distance !== null && (
                      <span className={`shrink-0 ${distanceColor} font-medium`}>
                        · {formatKm(distance)}
                      </span>
                    )}
                  </p>

                  {/* Next open time if closed */}
                  {!branch.isOpen && branch.nextOpenTime && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      {branch.holidayReason
                        ? `Cerrado por ${branch.holidayReason}`
                        : `Abre a las ${branch.nextOpenTime}hs`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
