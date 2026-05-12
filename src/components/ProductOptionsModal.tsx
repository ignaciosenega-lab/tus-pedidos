import { useState } from "react";
import type { Product, Variant } from "../types";
import { useCartDispatch } from "../store/cartContext";
import { formatPrice } from "../utils/money";

interface Props {
  product: Product;
  onClose: () => void;
  onAdded: () => void;
}

export default function ProductOptionsModal({
  product,
  onClose,
  onAdded,
}: Props) {
  const dispatch = useCartDispatch();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function setQty(variantId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [variantId]: Math.max(0, qty) }));
  }

  function handleAdd(variant: Variant) {
    const qty = quantities[variant.id] || 1;
    dispatch({
      type: "ADD_ITEM",
      payload: {
        productId: product.id,
        productName: product.name,
        categoryId: product.categoryId,
        variantId: variant.id,
        variantLabel: variant.label,
        price: variant.price,
        originalPrice: variant.originalPrice ?? variant.price,
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
        className="border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--popup-bg)" }}
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
          <h2 className="text-xl font-bold" style={{ color: "var(--title-text)" }}>
            {product.name}
          </h2>
          <p className="text-sm mt-1 opacity-60" style={{ color: "var(--general-text)" }}>
            {product.description}
          </p>

          <div className="mt-5 space-y-3">
            {product.variants?.map((v) => {
              const qty = quantities[v.id] || 1;

              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/10"
                  style={{ backgroundColor: "var(--panel-bg)" }}
                >
                  <div>
                    <span className="font-medium" style={{ color: "var(--title-text)" }}>
                      {v.label}
                    </span>
                    {v.originalPrice != null && v.originalPrice !== v.price && (
                      <span className="text-xs line-through opacity-50 ml-3" style={{ color: "var(--general-text)" }}>
                        {formatPrice(v.originalPrice)}
                      </span>
                    )}
                    <span className="font-bold ml-1.5" style={{ color: "var(--btn-bg)" }}>
                      {formatPrice(v.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQty(v.id, qty - 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm opacity-70 hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: "var(--panel-bg)", color: "var(--general-text)", border: "1px solid rgba(255,255,255,0.15)" }}
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm" style={{ color: "var(--title-text)" }}>
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty(v.id, qty + 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm opacity-70 hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: "var(--panel-bg)", color: "var(--general-text)", border: "1px solid rgba(255,255,255,0.15)" }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleAdd(v)}
                      data-testid="add-to-cart"
                      data-product-id={product.id}
                      data-product-name={product.name}
                      data-variant-id={v.id}
                      data-variant-label={v.label}
                      data-product-price={v.price}
                      className="text-sm font-semibold px-3 py-1.5 rounded-lg ml-2 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
