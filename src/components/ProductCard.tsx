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
        <h3 className="font-semibold text-base" style={{ color: "var(--title-text)" }}>
          {product.name}
        </h3>
        <p className="text-sm mt-1 line-clamp-2 flex-1 opacity-70" style={{ color: "var(--general-text)" }}>
          {product.description}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-lg" style={{ color: "var(--btn-bg)" }}>
            {formatPrice(displayPrice)}
          </span>

          {product.type === "options" ? (
            <button
              onClick={() => onOptions(product)}
              className="hover:opacity-90 transition-opacity text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              Opciones
            </button>
          ) : (
            <button
              onClick={() => onAdd(product)}
              disabled={isSimpleOutOfStock}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-opacity ${
                isSimpleOutOfStock ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"
              }`}
              style={
                isSimpleOutOfStock
                  ? { backgroundColor: "gray", color: "var(--general-text)" }
                  : { backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }
              }
            >
              {isSimpleOutOfStock ? "Agotado" : "Agregar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
