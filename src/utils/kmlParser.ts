import type { DeliveryZone, LatLng } from "../types";

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
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    const intersect =
      yi > point.lng !== yj > point.lng &&
      point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Given a set of active delivery zones and a coordinate, find the matching zone.
 * Returns the zone with the lowest cost if multiple match.
 */
export function findDeliveryZone(
  zones: DeliveryZone[],
  point: LatLng
): DeliveryZone | null {
  const matches = zones
    .filter((z) => z.active && isPointInPolygon(point, z.polygon))
    .sort((a, b) => a.cost - b.cost);

  return matches[0] ?? null;
}
