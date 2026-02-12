import { useState } from "react";
import type { Product, Variant } from "../types";
import { useCartDispatch } from "../store/cartContext";
import { formatPrice } from "../utils/money";

interface Props {
  product: Product;
  onClose: () => void;
  onOutOfStock: () => void;
  onAdded: () => void;
}

export default function ProductOptionsModal({
  product,
  onClose,
  onOutOfStock,
  onAdded,
}: Props) {
  const dispatch = useCartDispatch();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function setQty(variantId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [variantId]: Math.max(0, qty) }));
  }

  function handleAdd(variant: Variant) {
    if (variant.stock <= 0) {
      onOutOfStock();
      return;
    }
    const qty = quantities[variant.id] || 1;
    dispatch({
      type: "ADD_ITEM",
      payload: {
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantLabel: variant.label,
        price: variant.price,
        quantity: qty,
        imageUrl: product.imageUrl,
        description: product.description,
      },
    });
    onClose();
    onAdded();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-48 object-cover rounded-t-2xl"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-xl font-bold text-white">{product.name}</h2>
          <p className="text-gray-400 text-sm mt-1">{product.description}</p>

          <div className="mt-5 space-y-3">
            {product.variants?.map((v) => {
              const qty = quantities[v.id] || 1;
              const outOfStock = v.stock <= 0;

              return (
                <div
                  key={v.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    outOfStock
                      ? "border-gray-800 bg-gray-800/50 opacity-50"
                      : "border-gray-700 bg-gray-800"
                  }`}
                >
                  <div>
                    <span className="text-white font-medium">{v.label}</span>
                    <span className="text-emerald-400 font-bold ml-3">
                      {formatPrice(v.price)}
                    </span>
                  </div>

                  {outOfStock ? (
                    <span className="text-red-400 font-semibold text-sm">
                      Agotado
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(v.id, qty - 1)}
                        className="bg-gray-700 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm"
                      >
                        -
                      </button>
                      <span className="text-white w-6 text-center text-sm">
                        {qty}
                      </span>
                      <button
                        onClick={() => setQty(v.id, qty + 1)}
                        className="bg-gray-700 hover:bg-gray-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleAdd(v)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg ml-2 transition-colors"
                      >
                        Agregar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
