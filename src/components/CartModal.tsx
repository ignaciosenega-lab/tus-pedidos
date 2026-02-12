import { useCart, useCartDispatch, cartTotal } from "../store/cartContext";
import { formatPrice, formatTotal } from "../utils/money";

interface Props {
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartModal({ onClose, onCheckout }: Props) {
  const { items } = useCart();
  const dispatch = useCartDispatch();
  const total = cartTotal(items);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#3b3434" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            {/* cart icon */}
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            <h2 className="text-xl font-bold text-white">
              Detalle del pedido
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white w-9 h-9 rounded-full flex items-center justify-center text-2xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── Separator ──────────────────────────── */}
        <div className="h-px bg-gray-600/50 mx-5" />

        {/* ── Items list ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-gray-500 text-center py-16 text-sm">
              Tu pedido está vacío
            </p>
          ) : (
            items.map((item, idx) => {
              const key = `${item.productId}-${item.variantId ?? ""}`;
              return (
                <div key={key}>
                  {/* Item row */}
                  <div className="flex gap-4 px-5 py-4">
                    {/* Thumbnail */}
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                    />

                    {/* Center info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h3 className="text-white font-bold text-base sm:text-lg leading-tight truncate">
                          {item.productName}
                        </h3>
                        {item.variantLabel && (
                          <span className="text-gray-400 text-sm">
                            {item.variantLabel}
                          </span>
                        )}
                        <p className="text-gray-500 text-xs sm:text-sm mt-0.5 line-clamp-2 leading-snug">
                          {item.description}
                        </p>
                      </div>
                      <p className="text-white font-bold text-lg mt-1">
                        {formatPrice(item.price)}
                      </p>
                    </div>

                    {/* Right: quantity controls */}
                    <div className="flex flex-col items-end justify-between shrink-0 py-0.5">
                      {/* Delete */}
                      <button
                        onClick={() =>
                          dispatch({
                            type: "REMOVE_ITEM",
                            payload: {
                              productId: item.productId,
                              variantId: item.variantId,
                            },
                          })
                        }
                        className="text-gray-500 hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>

                      {/* Qty control */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            dispatch({
                              type: "UPDATE_QTY",
                              payload: {
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.quantity - 1,
                              },
                            })
                          }
                          className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-lg font-bold leading-none hover:bg-gray-200 transition-colors select-none"
                        >
                          &minus;
                        </button>
                        <span className="text-white font-bold text-base w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            dispatch({
                              type: "UPDATE_QTY",
                              payload: {
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.quantity + 1,
                              },
                            })
                          }
                          className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-lg font-bold leading-none hover:bg-gray-200 transition-colors select-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Separator between items */}
                  {idx < items.length - 1 && (
                    <div className="h-px bg-gray-600/40 mx-5" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ─────────────────────────────── */}
        {items.length > 0 && (
          <div className="px-5 pt-3 pb-5 space-y-4">
            {/* Separator */}
            <div className="h-px bg-gray-600/50" />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-white text-lg font-bold">Total</span>
              <span className="text-emerald-400 text-2xl font-bold">
                {formatTotal(total)}
              </span>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-500 text-gray-300 hover:text-white hover:border-gray-400 py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                Seguir comprando
              </button>
              <button
                onClick={onCheckout}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
