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
        className="relative bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors"
        >
          &times;
        </button>

        <div className="text-5xl mb-4">&#128532;</div>
        <h2 className="text-2xl font-bold text-red-400 mb-2">
          PRODUCTO AGOTADO
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Lo sentimos, este producto no está disponible en este momento.
        </p>
        <button
          onClick={onClose}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
