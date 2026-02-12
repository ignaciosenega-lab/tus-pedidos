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
