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
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
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
        <h3 className="text-white font-semibold text-base">{product.name}</h3>
        <p className="text-gray-400 text-sm mt-1 line-clamp-2 flex-1">
          {product.description}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-emerald-400 font-bold text-lg">
            {formatPrice(displayPrice)}
          </span>

          {product.type === "options" ? (
            <button
              onClick={() => onOptions(product)}
              className="bg-emerald-600 hover:bg-emerald-700 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Opciones
            </button>
          ) : (
            <button
              onClick={() => onAdd(product)}
              disabled={isSimpleOutOfStock}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                isSimpleOutOfStock
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isSimpleOutOfStock ? "Agotado" : "Agregar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
