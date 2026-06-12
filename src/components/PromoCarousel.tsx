import { useRef, useState, useEffect } from "react";
import type { Product } from "../types";
import { formatPrice } from "../utils/money";

interface Props {
  products: Product[];
  onAdd: (product: Product) => void;
  onOptions: (product: Product) => void;
  menuOnly?: boolean;
}

function getDiscountPercent(p: Product): number {
  if (p.type === "simple") {
    const orig = p.originalPrice;
    const now = p.basePrice;
    if (orig != null && now != null && orig > now) {
      return Math.round((1 - now / orig) * 100);
    }
    return 0;
  }
  const v = p.variants?.[0];
  if (v && v.originalPrice != null && v.originalPrice > v.price) {
    return Math.round((1 - v.price / v.originalPrice) * 100);
  }
  return 0;
}

function getDisplayPrices(p: Product): { price: number; originalPrice: number | null } {
  if (p.type === "simple") {
    return {
      price: p.basePrice ?? 0,
      originalPrice: p.originalPrice != null && p.originalPrice !== p.basePrice ? p.originalPrice : null,
    };
  }
  const v = p.variants?.[0];
  return {
    price: v?.price ?? 0,
    originalPrice: v?.originalPrice != null && v.originalPrice !== v.price ? v.originalPrice : null,
  };
}

export default function PromoCarousel({ products, onAdd, onOptions, menuOnly = false }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function updateButtons() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [products.length]);

  function scrollByCards(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLDivElement>("[data-promo-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="relative">
      <h2 className="text-2xl font-extrabold" style={{ color: "var(--title-text)" }}>
        Promociones del Día
      </h2>
      <p className="text-xs font-bold uppercase tracking-wider opacity-60 mt-1" style={{ color: "var(--general-text)" }}>
        PROMOS DEL DÍA
      </p>

      <div className="relative mt-4">
        {/* Left arrow (hidden on mobile, hidden when at start) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            aria-label="Anterior"
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-10 h-10 rounded-full items-center justify-center shadow-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            aria-label="Siguiente"
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-10 h-10 rounded-full items-center justify-center shadow-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Scroller */}
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {products.map((product) => {
            const discount = getDiscountPercent(product);
            const { price, originalPrice } = getDisplayPrices(product);
            const isOptions = product.type === "options";
            const isSameProductPromo = product.promotionType === "same_product_quantity";
            const sameProductMin = product.promotionMinQuantity ?? 2;
            const sameProductPct = product.promotionPercentage ?? 0;

            return (
              <div
                key={product.id}
                data-promo-card
                className="snap-start shrink-0 w-[85%] sm:w-[60%] md:w-[calc((100%-2rem)/3)] rounded-2xl overflow-hidden border border-white/10"
                style={{
                  background: "linear-gradient(180deg, var(--panel-bg) 0%, color-mix(in srgb, var(--btn-bg) 25%, var(--panel-bg)) 100%)",
                }}
              >
                {/* Image with badge */}
                <div className="relative">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  {/* Badge: 2x1 gana sobre el de % off (porque no tocamos el
                      precio, sería confuso mostrar "-X% OFF" aquí). */}
                  {isSameProductPromo ? (
                    <span
                      className="absolute top-3 right-3 inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full shadow-lg bg-amber-500 text-amber-950"
                      title={`Llevá ${sameProductMin} = ${sameProductPct}% off en esas ${sameProductMin} unidades`}
                    >
                      🎁 {sameProductMin}x1
                    </span>
                  ) : (
                    discount > 0 && (
                      <span
                        className="absolute top-3 right-3 text-sm font-bold px-3 py-1 rounded-full shadow-lg"
                        style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
                      >
                        -{discount}% OFF
                      </span>
                    )
                  )}
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base leading-tight" style={{ color: "var(--title-text)" }}>
                      {product.name}
                    </h3>
                    <div className="shrink-0 text-right">
                      {originalPrice != null && (
                        <div className="text-xs line-through opacity-50" style={{ color: "var(--general-text)" }}>
                          {formatPrice(originalPrice)}
                        </div>
                      )}
                      <div className="font-bold text-base" style={{ color: "var(--title-text)" }}>
                        {formatPrice(price)}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm opacity-70 whitespace-pre-line" style={{ color: "var(--general-text)" }}>
                    {product.description}
                  </p>

                  {isSameProductPromo && (
                    <p className="text-xs font-semibold text-amber-300">
                      Llevá {sameProductMin} = {sameProductPct}% off en esas {sameProductMin} unidades
                    </p>
                  )}

                  {!menuOnly && (
                    <button
                      type="button"
                      onClick={() => (isOptions ? onOptions(product) : onAdd(product))}
                      data-testid={isOptions ? "open-product-options" : "add-to-cart"}
                      data-product-id={product.id}
                      data-product-name={product.name}
                      data-product-price={price}
                      className="mt-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                      style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
                      </svg>
                      {isOptions ? "Elegir opciones" : "Añadir al pedido"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
