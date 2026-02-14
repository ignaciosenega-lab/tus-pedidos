export default function StoreClosedBanner() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
      <div className="text-center max-w-md w-full">
        <img
          src="/jiro_cerrado.png"
          alt="Local cerrado"
          className="mx-auto max-w-full h-auto rounded-xl mb-6"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
          }}
        />
        <h2 className="text-3xl font-bold text-red-400 mb-2">
          Local Cerrado
        </h2>
        <p style={{ color: "var(--general-text)" }} className="opacity-70">
          En este momento no estamos recibiendo pedidos. Volvé pronto!
        </p>
      </div>
    </div>
  );
}
