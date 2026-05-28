import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from "react";
import type { CartItem } from "../types";

/* ── State ────────────────────────────────────── */

interface CartState {
  items: CartItem[];
}

const STORAGE_KEY = "tuspedidos_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CartItem[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ── Actions ──────────────────────────────────── */

type CartAction =
  | {
      type: "ADD_ITEM";
      payload: CartItem;
    }
  | {
      type: "REMOVE_ITEM";
      payload: { productId: string; variantId?: string };
    }
  | {
      type: "UPDATE_QTY";
      payload: { productId: string; variantId?: string; quantity: number };
    }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const { payload } = action;
      const idx = state.items.findIndex(
        (i) =>
          i.productId === payload.productId &&
          i.variantId === payload.variantId
      );
      let items: CartItem[];
      if (idx >= 0) {
        items = state.items.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + payload.quantity } : item
        );
      } else {
        items = [...state.items, payload];
      }
      return { items };
    }
    case "REMOVE_ITEM": {
      const items = state.items.filter(
        (i) =>
          !(
            i.productId === action.payload.productId &&
            i.variantId === action.payload.variantId
          )
      );
      return { items };
    }
    case "UPDATE_QTY": {
      const { productId, variantId, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId)
          ),
        };
      }
      const items = state.items.map((i) =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity }
          : i
      );
      return { items };
    }
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

/* ── Context ──────────────────────────────────── */

const CartContext = createContext<CartState>({ items: [] });
const CartDispatchContext = createContext<Dispatch<CartAction>>(() => {});

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: loadCart() });

  useEffect(() => {
    saveCart(state.items);
  }, [state.items]);

  return (
    <CartContext.Provider value={state}>
      <CartDispatchContext.Provider value={dispatch}>
        {children}
      </CartDispatchContext.Provider>
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

export function useCartDispatch() {
  return useContext(CartDispatchContext);
}

/* ── Selectors ────────────────────────────────── */

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/* ── Auto-promo "2x1 del mismo producto" ─────────
   Computa el descuento auto-aplicado por promos de tipo
   `same_product_quantity`. Comportamiento por pares: por cada
   min_quantity unidades del MISMO ítem (mismo productId+variantId)
   se aplica `percentage` off; las sobrantes pagan precio lleno.
   Si un ítem califica para varias promos, gana la de mayor
   descuento. El server recomputa al crear el order (fuente de
   verdad) — este helper solo es para feedback inmediato del UI.
*/

export interface SameProductPromoLite {
  id: number;
  name: string;
  percentage: number;
  min_quantity: number;
  apply_scope: "all" | "categories" | "products";
  productIds: string[];
  categoryIds: string[];
}

export interface AutoPromoLine {
  promoId: number;
  promoName: string;
  productId: string;
  productName: string;
  units: number;     // unidades a las que se aplica el descuento
  discount: number;  // monto $ descontado
}

export interface AutoPromoResult {
  total: number;
  lines: AutoPromoLine[];
}

export function computeAutoPromoDiscount(
  items: CartItem[],
  promos: SameProductPromoLite[]
): AutoPromoResult {
  if (!items.length || !promos.length) return { total: 0, lines: [] };
  const lines: AutoPromoLine[] = [];
  let total = 0;
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) continue;
    const unitPrice = item.originalPrice ?? item.price ?? 0;
    if (unitPrice <= 0) continue;

    let bestLine: AutoPromoLine | null = null;
    for (const promo of promos) {
      let inScope = false;
      if (promo.apply_scope === "all") inScope = true;
      else if (promo.apply_scope === "products")
        inScope = promo.productIds.includes(String(item.productId));
      else if (promo.apply_scope === "categories")
        inScope = promo.categoryIds.includes(String(item.categoryId));
      if (!inScope) continue;

      const minQty = Math.max(2, Number(promo.min_quantity) || 2);
      if (item.quantity < minQty) continue;

      const pairs = Math.floor(item.quantity / minQty);
      const discountedUnits = pairs * minQty;
      const perUnit = Math.round((unitPrice * Number(promo.percentage)) / 100);
      const lineDiscount = discountedUnits * perUnit;
      if (!bestLine || lineDiscount > bestLine.discount) {
        bestLine = {
          promoId: promo.id,
          promoName: promo.name,
          productId: String(item.productId),
          productName: item.productName,
          units: discountedUnits,
          discount: lineDiscount,
        };
      }
    }
    if (bestLine) {
      lines.push(bestLine);
      total += bestLine.discount;
    }
  }
  return { total, lines };
}
