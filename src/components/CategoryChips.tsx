import { useEffect, useRef } from "react";
import type { Category } from "../types";

interface Props {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
  /**
   * "horizontal" — fila scrolleable única (mobile / sticky bar).
   * "vertical"   — lista vertical compacta (sidebar desktop).
   */
  variant?: "horizontal" | "vertical";
}

export default function CategoryChips({
  categories,
  selected,
  onSelect,
  variant = "horizontal",
}: Props) {
  // Ref a la barra horizontal y al chip activo para hacer auto-scroll cuando
  // cambia la selección — así el chip activo queda siempre visible.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (variant !== "horizontal") return;
    const btn = activeRef.current;
    const scroller = scrollerRef.current;
    if (!btn || !scroller) return;

    // Calcular si el chip activo ya está visible/centrado para evitar un
    // jump innecesario.
    const scRect = scroller.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const btnCenter = btnRect.left + btnRect.width / 2;
    const scCenter = scRect.left + scRect.width / 2;
    const diff = Math.abs(btnCenter - scCenter);

    if (diff > 30) {
      btn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [selected, variant]);

  if (variant === "vertical") {
    return (
      <div className="flex flex-col gap-1">
        {categories.map((cat) => {
          const isSelected = selected === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border-l-2"
              style={
                isSelected
                  ? {
                      backgroundColor:
                        "color-mix(in srgb, var(--btn-bg) 22%, transparent)",
                      borderLeftColor: "var(--btn-bg)",
                      color: "var(--btn-bg)",
                    }
                  : {
                      // No-activo: tinte rojo (color de marca) bien suave.
                      backgroundColor:
                        "color-mix(in srgb, var(--btn-bg) 8%, transparent)",
                      borderLeftColor: "transparent",
                      color: "color-mix(in srgb, var(--btn-bg) 90%, white)",
                    }
              }
            >
              {isSelected && (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="truncate">{cat.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // variant === "horizontal"
  return (
    <div
      ref={scrollerRef}
      className="flex gap-2 overflow-x-auto scrollbar-hide py-1"
      style={{
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        // Oculta scrollbar nativa sin tener que tocar global CSS.
        scrollbarWidth: "none",
      }}
    >
      {categories.map((cat) => {
        const isSelected = selected === cat.id;
        return (
          <button
            key={cat.id}
            ref={isSelected ? activeRef : undefined}
            onClick={() => onSelect(cat.id)}
            className="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90 flex items-center gap-1.5 shrink-0"
            style={{
              scrollSnapAlign: "center",
              ...(isSelected
                ? { backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }
                : {
                    // Tinte rojo de marca con transparencia + borde sutil
                    // del mismo color en vez del borde blanco neutro.
                    backgroundColor:
                      "color-mix(in srgb, var(--btn-bg) 12%, transparent)",
                    color: "color-mix(in srgb, var(--btn-bg) 92%, white)",
                    border:
                      "1px solid color-mix(in srgb, var(--btn-bg) 35%, transparent)",
                  }),
            }}
          >
            {isSelected && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
