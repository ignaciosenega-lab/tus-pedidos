import type { DeliveryZone, LatLng, PolygonPoint } from "../types";

const ZONE_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

/**
 * Parse a KML file string and extract delivery zones (Placemarks with Polygons).
 * Returns an array of DeliveryZone with default cost 0.
 */
export function parseKML(kmlString: string): DeliveryZone[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlString, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("El archivo KML no es válido.");
  }

  const placemarks = doc.querySelectorAll("Placemark");
  const zones: DeliveryZone[] = [];

  placemarks.forEach((pm, index) => {
    const name =
      pm.querySelector("name")?.textContent?.trim() || `Zona ${index + 1}`;

    // Collect all polygon coordinate strings from this placemark
    // (handles both direct Polygon and MultiGeometry > Polygon)
    const coordStrings: string[] = [];

    pm.querySelectorAll("Polygon outerBoundaryIs LinearRing coordinates").forEach(
      (coordEl) => {
        const text = coordEl.textContent?.trim();
        if (text) coordStrings.push(text);
      }
    );

    // Also check for LineString (some My Maps export zones as lines)
    if (coordStrings.length === 0) {
      pm.querySelectorAll("LineString coordinates").forEach((coordEl) => {
        const text = coordEl.textContent?.trim();
        if (text) coordStrings.push(text);
      });
    }

    for (const coordStr of coordStrings) {
      const polygon = parseCoordinateString(coordStr);
      if (polygon.length >= 3) {
        zones.push({
          id: `zone-${Date.now()}-${index}-${zones.length}`,
          name: coordStrings.length > 1 ? `${name} (${zones.length + 1})` : name,
          polygon,
          cost: 0,
          active: true,
          color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
        });
      }
    }
  });

  return zones;
}

/**
 * Parse a KML coordinate string "lng,lat,alt lng,lat,alt ..." into LatLng[].
 */
function parseCoordinateString(raw: string): LatLng[] {
  const points: LatLng[] = [];
  const pairs = raw.split(/\s+/).filter(Boolean);

  for (const pair of pairs) {
    const parts = pair.split(",");
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({ lat, lng });
      }
    }
  }

  return points;
}

/**
 * Check if a point (lat,lng) is inside a polygon using ray-casting algorithm.
 */
/** Un vértice, venga como objeto o como par [lat, lng]. */
function aLatLng(p: PolygonPoint): LatLng {
  return Array.isArray(p) ? { lat: p[0], lng: p[1] } : p;
}

/**
 * ¿El punto cae dentro del polígono? (ray casting)
 *
 * Normaliza cada vértice antes de compararlo: el editor de zonas guarda pares
 * `[lat, lng]` y el importador de KML objetos `{lat, lng}`. Leer `.lat` de un
 * arreglo devuelve `undefined`, toda comparación da falso y la función
 * contesta "fuera" para cualquier dirección del mapa — que es exactamente lo
 * que venía pasando.
 */
export function isPointInPolygon(point: LatLng, polygon: PolygonPoint[]): boolean {
  const pts = polygon.map(aLatLng);
  let inside = false;

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const yi = pts[i].lat, xi = pts[i].lng;
    const yj = pts[j].lat, xj = pts[j].lng;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/** Metros por grado, aproximados a la latitud dada. Alcanza para distancias cortas. */
function metrosPorGrado(lat: number) {
  return { porLat: 111_320, porLng: 111_320 * Math.cos((lat * Math.PI) / 180) };
}

/** Distancia en metros de un punto al segmento a–b. */
function distanciaAlSegmento(p: LatLng, a: LatLng, b: LatLng): number {
  const { porLat, porLng } = metrosPorGrado(p.lat);
  const px = (p.lng - a.lng) * porLng, py = (p.lat - a.lat) * porLat;
  const bx = (b.lng - a.lng) * porLng, by = (b.lat - a.lat) * porLat;

  const largo2 = bx * bx + by * by;
  // Un segmento degenerado (dos vértices iguales) es un punto.
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / largo2));
  const dx = px - bx * t, dy = py - by * t;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Qué tan lejos está el punto del borde del polígono, en metros. */
export function distanciaAlBorde(point: LatLng, polygon: PolygonPoint[]): number {
  const pts = polygon.map(aLatLng);
  if (pts.length < 2) return Infinity;

  let min = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    min = Math.min(min, distanciaAlSegmento(point, pts[j], pts[i]));
  }
  return min;
}

/**
 * Given a set of active delivery zones and a coordinate, find the matching zone.
 * Returns the zone with the lowest cost if multiple match.
 */
export function findDeliveryZone(
  zones: DeliveryZone[],
  point: LatLng,
  toleranciaM = 0
): DeliveryZone | null {
  const activas = zones.filter((z) => z.active);

  const dentro = activas
    .filter((z) => isPointInPolygon(point, z.polygon))
    .sort((a, b) => a.cost - b.cost);
  if (dentro[0]) return dentro[0];

  // Margen de tolerancia. Google ubica un barrio privado en su portón, no en su
  // centro, así que una dirección válida puede caer unos metros afuera del
  // borde. Sin esto, el barrio entero queda rechazado por dónde está la tranquera.
  if (toleranciaM > 0) {
    const cerca = activas
      .map((z) => ({ z, d: distanciaAlBorde(point, z.polygon) }))
      .filter((x) => x.d <= toleranciaM)
      .sort((a, b) => a.d - b.d || a.z.cost - b.z.cost);
    if (cerca[0]) return cerca[0].z;
  }

  return null;
}
