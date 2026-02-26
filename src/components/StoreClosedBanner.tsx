export default function StoreClosedBanner() {
  return (
    <div className="fixed top-[60px] left-0 right-0 z-40 bg-red-700 text-white py-2.5 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm font-semibold">
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>EL LOCAL SE ENCUENTRA CERRADO. PROGRAMÁ TU PEDIDO.</span>
      </div>
    </div>
  );
}
