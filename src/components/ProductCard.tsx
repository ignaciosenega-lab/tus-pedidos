import type { Product } from "../types";
import { formatPrice } from "../utils/money";

interface Props {
  product: Product;
  onOptions: (product: Product) => void;
  onAdd: (product: Product) => void;
  menuOnly?: boolean;
}

export default function ProductCard({ product, onOptions, onAdd, menuOnly = false }: Props) {
  const displayPrice =
    product.type === "simple"
      ? product.basePrice!
      : product.variants?.[0]?.price ?? 0;

  const originalDisplayPrice =
    product.type === "simple"
      ? product.originalPrice
      : product.variants?.[0]?.originalPrice;

  const hasDiscount = originalDisplayPrice != null && originalDisplayPrice !== displayPrice;

  const variantes = product.variants ?? [];

  // En la carta no hay manera de abrir el detalle: el botón "+ Opciones" está
  // oculto y ProductOptionsModal no se monta. Si acá no listamos cada variante
  // con su precio, el cliente ve el de la primera y cree que es el único —
  // "California $9.890" es en realidad el x5, y el x10 no aparece en ningún lado.
  //
  // Se condiciona por `type` y no por la cantidad de variantes a secas porque
  // /api/state emite `variants` según haya filas, no según el tipo: un producto
  // `simple` con variantes colgadas sigue mostrando su basePrice como siempre.
  const listarVariantes =
    menuOnly && product.type === "options" && variantes.length > 0;

  // Un producto con variantes al que todavía no le cargaron ninguna llega sin
  // basePrice y sin variants, y la cuenta de arriba da 0. Mejor no mostrar nada
  // que anunciar que sale cero.
  const sinPrecio = product.type === "options" && variantes.length === 0;

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
          {!listarVariantes && !sinPrecio && (
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
          )}
        </div>

        {/* Description */}
        <p className="text-sm mt-1.5 flex-1 opacity-70 whitespace-pre-line" style={{ color: "var(--general-text)" }}>
          {product.description}
        </p>

        {/* Precios por variante — solo en modo carta, donde no hay otro lugar
            donde verlos. flex-wrap porque hay etiquetas largas ("furai (frita)")
            que en celular tienen que poder bajar de línea. */}
        {listarVariantes && (
          <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {variantes.map((v) => (
              <span key={v.id} className="inline-flex items-baseline gap-1.5">
                <span className="text-sm opacity-70" style={{ color: "var(--general-text)" }}>
                  {v.label}
                </span>
                {v.originalPrice != null && v.originalPrice !== v.price && (
                  <span className="text-xs line-through opacity-50" style={{ color: "var(--general-text)" }}>
                    {formatPrice(v.originalPrice)}
                  </span>
                )}
                <span className="font-bold text-base tabular-nums" style={{ color: "var(--btn-bg)" }}>
                  {formatPrice(v.price)}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Full-width button — oculto en modo carta (solo lectura) */}
        {!menuOnly && (
        <div className="mt-3">
          {product.type === "options" ? (
            <button
              onClick={() => onOptions(product)}
              data-testid="open-product-options"
              data-product-id={product.id}
              data-product-name={product.name}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "color-mix(in srgb, var(--btn-bg) 15%, transparent)", color: "var(--btn-bg)" }}
            >
              + Opciones
            </button>
          ) : (
            <button
              onClick={() => onAdd(product)}
              data-testid="add-to-cart"
              data-product-id={product.id}
              data-product-name={product.name}
              data-product-price={product.basePrice}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "color-mix(in srgb, var(--btn-bg) 15%, transparent)", color: "var(--btn-bg)" }}
            >
              + Añadir
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
