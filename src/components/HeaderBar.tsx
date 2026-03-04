import { useCart, cartItemCount, cartTotal } from "../store/cartContext";
import { useStorefront } from "../hooks/useStorefront";
import { formatPrice } from "../utils/money";

interface Props {
  onOpenCart: () => void;
}

export default function HeaderBar({ onOpenCart }: Props) {
  const { items } = useCart();
  const { businessConfig } = useStorefront();
  const count = cartItemCount(items);
  const total = cartTotal(items);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 shadow-lg border-b border-white/10"
      style={{ backgroundColor: "var(--header-bg)", color: "var(--header-text)" }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {businessConfig.logo && (
            <img
              src={businessConfig.logo}
              alt={businessConfig.title}
              className="object-contain"
              style={{ maxWidth: "220px", maxHeight: "80px" }}
            />
          )}
          {!businessConfig.logo && (
            <h1 className="text-lg font-bold tracking-wide">
              {businessConfig.title || "Tus Pedidos"}
            </h1>
          )}
          <div className="hidden sm:flex items-center gap-3 ml-4 text-xs opacity-70" style={{ color: "var(--header-text)" }}>
            <span className="flex items-center gap-1"><span className="font-bold">1.</span> Agregá productos</span>
            <span style={{ opacity: 0.4 }}>›</span>
            <span className="flex items-center gap-1"><span className="font-bold">2.</span> Finalizar pedido</span>
            <span style={{ opacity: 0.4 }}>›</span>
            <span className="flex items-center gap-1"><span className="font-bold">3.</span> Te redirige a WhatsApp</span>
          </div>
        </div>

        <button
          onClick={onOpenCart}
          className="flex items-center gap-3 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
        >
          {count > 0 && (
            <span
              className="rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: "var(--btn-text)", color: "var(--btn-bg)" }}
            >
              {count}
            </span>
          )}
          <span>Ver mi pedido</span>
          {count > 0 && (
            <span className="font-bold">{formatPrice(total)}</span>
          )}
        </button>
      </div>
    </header>
  );
}
