// Registra uso de Google Maps de cara al cliente, para estimar el gasto desde el
// panel. Fire-and-forget: nunca rompe el flujo del cliente si falla.

function registrar(branchId: number | null | undefined, eventType: string): void {
  if (!branchId) return; // analytics_events.branch_id es NOT NULL
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, eventType }),
  }).catch(() => {});
}

/** Una carga del script de Maps. No es lo que se cobra, pero sirve de contexto. */
export function trackMapsLoad(branchId: number | null | undefined): void {
  registrar(branchId, "maps_load");
}

/**
 * Una geocodificación, que SÍ es lo que se cobra: USD 5 cada 1.000 después de
 * las 10.000 gratis del mes. La factura de junio (USD 102,53) fueron 30.506 de
 * estas, todas del selector de sucursales. Contarlas aparte es lo que permite
 * ver el problema antes de que llegue la factura.
 */
export function trackGeocode(branchId: number | null | undefined): void {
  registrar(branchId, "maps_geocode");
}
