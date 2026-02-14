interface Props {
  onClose: () => void;
}

export default function OutOfStockModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full"
        style={{ backgroundColor: "var(--popup-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 opacity-60 hover:opacity-100 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-opacity"
          style={{ color: "var(--general-text)" }}
        >
          &times;
        </button>

        <div className="text-5xl mb-4">&#128532;</div>
        <h2 className="text-2xl font-bold text-red-400 mb-2">
          PRODUCTO AGOTADO
        </h2>
        <p className="text-sm mb-6 opacity-60" style={{ color: "var(--general-text)" }}>
          Lo sentimos, este producto no está disponible en este momento.
        </p>
        <button
          onClick={onClose}
          className="font-semibold px-6 py-2.5 rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
