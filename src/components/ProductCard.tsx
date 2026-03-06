import type { Product } from "../types";
import { formatPrice } from "../utils/money";

interface Props {
  product: Product;
  onOptions: (product: Product) => void;
  onAdd: (product: Product) => void;
}

export default function ProductCard({ product, onOptions, onAdd }: Props) {
  const displayPrice =
    product.type === "simple"
      ? product.basePrice!
      : product.variants?.[0]?.price ?? 0;

  const originalDisplayPrice =
    product.type === "simple"
      ? product.originalPrice
      : product.variants?.[0]?.originalPrice;

  const hasDiscount = originalDisplayPrice != null && originalDisplayPrice !== displayPrice;

  const isSimpleOutOfStock =
    product.type === "simple" && product.stock !== undefined && product.stock <= 0;

  return (
    <div
      className="border border-white/10 rounded-xl overflow-hidden flex flex-col"
      style={{ backgroundColor: "var(--panel-bg)" }}
    >
      <div className="relative">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
        {product.badges && product.badges.length > 0 && (
          <div className="absolute top-2 left-2 flex gap-1">
            {product.badges.includes("sin_tacc") && (
              <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                sin tacc
              </span>
            )}
            {product.badges.includes("nuevo") && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                NUEVO
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {/* Name + Price on same line */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight" style={{ color: "var(--title-text)" }}>
            {product.name}
          </h3>
          <div className="shrink-0 text-right">
            {hasDiscount && (
              <span className="text-xs line-through opacity-50 mr-1.5" style={{ color: "var(--general-text)" }}>
                {formatPrice(originalDisplayPrice)}
              </span>
            )}
            <span className="font-bold text-base" style={{ color: "var(--btn-bg)" }}>
              {formatPrice(displayPrice)}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm mt-1.5 line-clamp-2 flex-1 opacity-70" style={{ color: "var(--general-text)" }}>
          {product.description}
        </p>

        {/* Full-width button */}
        <div className="mt-3">
          {product.type === "options" ? (
            <button
              onClick={() => onOptions(product)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "color-mix(in srgb, var(--btn-bg) 15%, transparent)", color: "var(--btn-bg)" }}
            >
              + Opciones
            </button>
          ) : (
            <button
              onClick={() => onAdd(product)}
              disabled={isSimpleOutOfStock}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity ${
                isSimpleOutOfStock ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"
              }`}
              style={
                isSimpleOutOfStock
                  ? { backgroundColor: "rgba(128,128,128,0.2)", color: "var(--general-text)" }
                  : { backgroundColor: "color-mix(in srgb, var(--btn-bg) 15%, transparent)", color: "var(--btn-bg)" }
              }
            >
              {isSimpleOutOfStock ? "Agotado" : "+ Añadir"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
