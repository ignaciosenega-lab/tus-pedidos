import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
} from "react";
import type {
  AdminState,
  AdminProduct,
  Promotion,
  Coupon,
  DeliveryZone,
  AppUser,
  BusinessConfig,
  PaymentConfig,
  StyleConfig,
  Category,
} from "../types";
import {
  adminProducts,
  categories as seedCategories,
  promotions as seedPromotions,
  coupons as seedCoupons,
  users as seedUsers,
  businessConfig as seedBusiness,
  paymentConfig as seedPayment,
  styleConfig as seedStyle,
} from "../data/adminSeed";

/* ── Default state (seed data for first run) ──── */

const DEFAULT_STATE: AdminState = {
  products: adminProducts,
  categories: seedCategories,
  promotions: seedPromotions,
  coupons: seedCoupons,
  deliveryZones: [],
  users: seedUsers,
  businessConfig: seedBusiness,
  paymentConfig: seedPayment,
  styleConfig: seedStyle,
};

/* ── Actions ─────────────────────────────────── */

export type AdminAction =
  /* Products */
  | { type: "UPSERT_PRODUCT"; payload: AdminProduct }
  | { type: "DELETE_PRODUCT"; payload: string }
  | { type: "TOGGLE_PRODUCT_STATUS"; payload: string }
  | { type: "IMPORT_CSV"; payload: { products: AdminProduct[]; categories: Category[] } }
  /* Categories */
  | { type: "UPSERT_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; payload: string }
  /* Promotions */
  | { type: "UPSERT_PROMOTION"; payload: Promotion }
  | { type: "DELETE_PROMOTION"; payload: string }
  /* Coupons */
  | { type: "UPSERT_COUPON"; payload: Coupon }
  | { type: "DELETE_COUPON"; payload: string }
  | { type: "TOGGLE_COUPON_ACTIVE"; payload: string }
  /* Delivery Zones */
  | { type: "SET_DELIVERY_ZONES"; payload: DeliveryZone[] }
  | { type: "UPDATE_ZONE"; payload: DeliveryZone }
  | { type: "DELETE_ZONE"; payload: string }
  | { type: "TOGGLE_ZONE_ACTIVE"; payload: string }
  | { type: "CLEAR_ZONES" }
  /* Users */
  | { type: "UPDATE_USER_STATUS"; payload: { id: string; status: AppUser["status"] } }
  /* Config */
  | { type: "UPDATE_BUSINESS_CONFIG"; payload: Partial<BusinessConfig> }
  | { type: "UPDATE_PAYMENT_CONFIG"; payload: Partial<PaymentConfig> }
  | { type: "UPDATE_STYLE_CONFIG"; payload: Partial<StyleConfig> }
  /* Sync from API */
  | { type: "_HYDRATE"; payload: AdminState };

function adminReducer(state: AdminState, action: AdminAction): AdminState {
  switch (action.type) {
    /* ── Hydrate from API ───────────────────── */
    case "_HYDRATE":
      return { ...DEFAULT_STATE, ...action.payload };

    /* ── Products ────────────────────────────── */
    case "UPSERT_PRODUCT": {
      const idx = state.products.findIndex((p) => p.id === action.payload.id);
      const products =
        idx >= 0
          ? state.products.map((p, i) => (i === idx ? action.payload : p))
          : [...state.products, action.payload];
      return { ...state, products };
    }
    case "DELETE_PRODUCT":
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.payload),
      };
    case "TOGGLE_PRODUCT_STATUS":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload
            ? { ...p, status: p.status === "alta" ? "baja" : "alta" }
            : p
        ),
      };
    case "IMPORT_CSV": {
      const existingCatIds = new Set(state.categories.map((c) => c.id));
      const newCats = action.payload.categories.filter((c) => !existingCatIds.has(c.id));
      return {
        ...state,
        products: [...state.products, ...action.payload.products],
        categories: [...state.categories, ...newCats],
      };
    }

    /* ── Categories ──────────────────────────── */
    case "UPSERT_CATEGORY": {
      const idx = state.categories.findIndex((c) => c.id === action.payload.id);
      const categories =
        idx >= 0
          ? state.categories.map((c, i) => (i === idx ? action.payload : c))
          : [...state.categories, action.payload];
      return { ...state, categories };
    }
    case "DELETE_CATEGORY":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
      };

    /* ── Promotions ──────────────────────────── */
    case "UPSERT_PROMOTION": {
      const idx = state.promotions.findIndex((p) => p.id === action.payload.id);
      const promotions =
        idx >= 0
          ? state.promotions.map((p, i) => (i === idx ? action.payload : p))
          : [...state.promotions, action.payload];
      return { ...state, promotions };
    }
    case "DELETE_PROMOTION":
      return {
        ...state,
        promotions: state.promotions.filter((p) => p.id !== action.payload),
      };

    /* ── Coupons ─────────────────────────────── */
    case "UPSERT_COUPON": {
      const idx = state.coupons.findIndex((c) => c.id === action.payload.id);
      const coupons =
        idx >= 0
          ? state.coupons.map((c, i) => (i === idx ? action.payload : c))
          : [...state.coupons, action.payload];
      return { ...state, coupons };
    }
    case "DELETE_COUPON":
      return {
        ...state,
        coupons: state.coupons.filter((c) => c.id !== action.payload),
      };
    case "TOGGLE_COUPON_ACTIVE":
      return {
        ...state,
        coupons: state.coupons.map((c) =>
          c.id === action.payload ? { ...c, active: !c.active } : c
        ),
      };

    /* ── Delivery Zones ──────────────────────── */
    case "SET_DELIVERY_ZONES":
      return { ...state, deliveryZones: action.payload };
    case "UPDATE_ZONE":
      return {
        ...state,
        deliveryZones: state.deliveryZones.map((z) =>
          z.id === action.payload.id ? action.payload : z
        ),
      };
    case "DELETE_ZONE":
      return {
        ...state,
        deliveryZones: state.deliveryZones.filter((z) => z.id !== action.payload),
      };
    case "TOGGLE_ZONE_ACTIVE":
      return {
        ...state,
        deliveryZones: state.deliveryZones.map((z) =>
          z.id === action.payload ? { ...z, active: !z.active } : z
        ),
      };
    case "CLEAR_ZONES":
      return { ...state, deliveryZones: [] };

    /* ── Users ───────────────────────────────── */
    case "UPDATE_USER_STATUS":
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.payload.id
            ? { ...u, status: action.payload.status }
            : u
        ),
      };

    /* ── Config ──────────────────────────────── */
    case "UPDATE_BUSINESS_CONFIG":
      return {
        ...state,
        businessConfig: { ...state.businessConfig, ...action.payload },
      };
    case "UPDATE_PAYMENT_CONFIG":
      return {
        ...state,
        paymentConfig: { ...state.paymentConfig, ...action.payload },
      };
    case "UPDATE_STYLE_CONFIG":
      return {
        ...state,
        styleConfig: { ...state.styleConfig, ...action.payload },
      };

    default:
      return state;
  }
}

/* ── Context ─────────────────────────────────── */

interface AdminContextValue extends AdminState {
  loading: boolean;
}

const AdminContext = createContext<AdminContextValue>({
  ...DEFAULT_STATE,
  loading: true,
});
const AdminDispatchContext = createContext<Dispatch<AdminAction>>(() => {});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(adminReducer, DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  // Fetch state from API on mount
  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          dispatch({ type: "_HYDRATE", payload: data });
        }
        hydrated.current = true;
        setLoading(false);
      })
      .catch(() => {
        // API not available (dev without server) — use default state
        hydrated.current = true;
        setLoading(false);
      });
  }, []);

  // Save state to API on changes (debounced 500ms)
  useEffect(() => {
    if (!hydrated.current) return; // Don't save until first load completes

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const token = localStorage.getItem("tuspedidos_token");
      if (!token) return; // Only save if admin is logged in

      fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(state),
      }).catch((e) => console.error("Error saving state:", e));
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  return (
    <AdminContext.Provider value={{ ...state, loading }}>
      <AdminDispatchContext.Provider value={dispatch}>
        {children}
      </AdminDispatchContext.Provider>
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}

export function useAdminDispatch() {
  return useContext(AdminDispatchContext);
}
