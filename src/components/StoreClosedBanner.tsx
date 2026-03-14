interface Props {
  nextOpenTime?: string | null;
  holidayReason?: string | null;
  closedReason?: string | null;
}

export default function StoreClosedBanner({ nextOpenTime, holidayReason, closedReason }: Props) {
  let message = "EL LOCAL SE ENCUENTRA CERRADO.";
  let suffix = " PROGRAMÁ TU PEDIDO.";

  if (closedReason === "paused") {
    if (nextOpenTime) {
      const time = new Date(nextOpenTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      message = `POR ALTA DEMANDA NO ESTAMOS TOMANDO PEDIDOS HASTA LAS ${time}HS.`;
    } else {
      message = "POR ALTA DEMANDA NO ESTAMOS TOMANDO PEDIDOS EN ESTE MOMENTO.";
    }
    suffix = " DISCULPE LAS MOLESTIAS.";
  } else if (holidayReason) {
    message = `CERRADO POR ${holidayReason.toUpperCase()}.`;
  } else if (nextOpenTime) {
    message = `EL LOCAL SE ENCUENTRA CERRADO Y ABRE A LAS ${nextOpenTime}HS.`;
  }

  return (
    <div className="bg-red-700 text-white py-2.5 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm font-semibold">
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{message}{suffix}</span>
      </div>
    </div>
  );
}
