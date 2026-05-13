import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from "react";
import { createElement } from "react";

export type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";
export type OrderType = "mostrador" | "delivery";

export interface MegaFodyProduct {
  id: string;
  name: string;
  categoryId: string;
  price: number;
}

export interface MegaFodyCategory {
  id: string;
  name: string;
}

export interface MegaFodyItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface MegaFodyOrder {
  id: number;
  type: OrderType;
  customer?: { name?: string; phone?: string; address?: string };
  items: MegaFodyItem[];
  total: number;
  status: OrderStatus;
  createdAt: string; // ISO
  notes?: string;
}

interface State {
  orders: MegaFodyOrder[];
  nextId: number;
  products: MegaFodyProduct[];
  categories: MegaFodyCategory[];
}

type Action =
  | { type: "ADD_ORDER"; payload: Omit<MegaFodyOrder, "id" | "status" | "createdAt"> }
  | { type: "SET_STATUS"; payload: { orderId: number; status: OrderStatus } }
  | { type: "RESET_DEMO" };

const CATEGORIES: MegaFodyCategory[] = [
  { id: "entradas", name: "Entradas" },
  { id: "principales", name: "Principales" },
  { id: "bebidas", name: "Bebidas" },
  { id: "postres", name: "Postres" },
];

const PRODUCTS: MegaFodyProduct[] = [
  { id: "p1", name: "Empanadas (3u)", categoryId: "entradas", price: 3500 },
  { id: "p2", name: "Bruschettas", categoryId: "entradas", price: 4200 },
  { id: "p3", name: "Provoleta", categoryId: "entradas", price: 5800 },
  { id: "p4", name: "Milanesa Napolitana", categoryId: "principales", price: 12500 },
  { id: "p5", name: "Bife de Chorizo", categoryId: "principales", price: 18000 },
  { id: "p6", name: "Ravioles 4 quesos", categoryId: "principales", price: 11000 },
  { id: "p7", name: "Pollo grillado", categoryId: "principales", price: 10500 },
  { id: "p8", name: "Pizza Mozzarella", categoryId: "principales", price: 9800 },
  { id: "p9", name: "Agua mineral 500ml", categoryId: "bebidas", price: 1500 },
  { id: "p10", name: "Coca-Cola 500ml", categoryId: "bebidas", price: 2200 },
  { id: "p11", name: "Cerveza tirada", categoryId: "bebidas", price: 3800 },
  { id: "p12", name: "Vino de la casa (copa)", categoryId: "bebidas", price: 4500 },
  { id: "p13", name: "Flan casero", categoryId: "postres", price: 3500 },
  { id: "p14", name: "Helado 2 bochas", categoryId: "postres", price: 4000 },
];

function makeInitialOrders(): MegaFodyOrder[] {
  const now = Date.now();
  return [
    {
      id: 101,
      type: "mostrador",
      customer: { name: "Mesa 4" },
      items: [
        { productId: "p4", productName: "Milanesa Napolitana", price: 12500, quantity: 2 },
        { productId: "p10", productName: "Coca-Cola 500ml", price: 2200, quantity: 2 },
      ],
      total: 12500 * 2 + 2200 * 2,
      status: "pending",
      createdAt: new Date(now - 4 * 60 * 1000).toISOString(),
    },
    {
      id: 102,
      type: "delivery",
      customer: { name: "Lucía", phone: "11 2233 4455", address: "Av. Cabildo 1234" },
      items: [
        { productId: "p8", productName: "Pizza Mozzarella", price: 9800, quantity: 1 },
        { productId: "p11", productName: "Cerveza tirada", price: 3800, quantity: 1 },
      ],
      total: 9800 + 3800,
      status: "pending",
      createdAt: new Date(now - 1 * 60 * 1000).toISOString(),
    },
    {
      id: 103,
      type: "mostrador",
      customer: { name: "Mesa 7" },
      items: [
        { productId: "p5", productName: "Bife de Chorizo", price: 18000, quantity: 1 },
        { productId: "p12", productName: "Vino de la casa (copa)", price: 4500, quantity: 2 },
        { productId: "p13", productName: "Flan casero", price: 3500, quantity: 1 },
      ],
      total: 18000 + 4500 * 2 + 3500,
      status: "preparing",
      createdAt: new Date(now - 9 * 60 * 1000).toISOString(),
    },
  ];
}

function initialState(): State {
  return {
    orders: makeInitialOrders(),
    nextId: 104,
    products: PRODUCTS,
    categories: CATEGORIES,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_ORDER": {
      const id = state.nextId;
      const order: MegaFodyOrder = {
        ...action.payload,
        id,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      return { ...state, orders: [order, ...state.orders], nextId: id + 1 };
    }
    case "SET_STATUS": {
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.payload.orderId ? { ...o, status: action.payload.status } : o
        ),
      };
    }
    case "RESET_DEMO":
      return initialState();
    default:
      return state;
  }
}

const StateContext = createContext<State>(initialState());
const DispatchContext = createContext<Dispatch<Action>>(() => {});

export function MegaFodyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  return createElement(
    StateContext.Provider,
    { value: state },
    createElement(DispatchContext.Provider, { value: dispatch }, children)
  );
}

export function useMegaFody() {
  return useContext(StateContext);
}

export function useMegaFodyDispatch() {
  return useContext(DispatchContext);
}
