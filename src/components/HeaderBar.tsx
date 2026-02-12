import { useCart, cartItemCount, cartTotal } from "../store/cartContext";
import { formatPrice } from "../utils/money";

interface Props {
  onOpenCart: () => void;
}

export default function HeaderBar({ onOpenCart }: Props) {
  const { items } = useCart();
  const count = cartItemCount(items);
  const total = cartTotal(items);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 shadow-lg">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold text-white tracking-wide">
          Tus Pedidos
        </h1>

        <button
          onClick={onOpenCart}
          className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white px-4 py-2 rounded-full text-sm font-semibold"
        >
          {count > 0 && (
            <span className="bg-white text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
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
