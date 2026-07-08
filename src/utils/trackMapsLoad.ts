// Registra una carga de Google Maps de cara al cliente, para estimar el uso/gasto
// de la API desde el admin (tarjeta en Operación Global). Fire-and-forget: nunca
// rompe el flujo del cliente si falla.
export function trackMapsLoad(branchId: number | null | undefined): void {
  if (!branchId) return; // analytics_events.branch_id es NOT NULL
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, eventType: "maps_load" }),
  }).catch(() => {});
}
