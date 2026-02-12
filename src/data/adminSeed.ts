import type {
  AdminProduct,
  Promotion,
  Coupon,
  AppUser,
  BusinessConfig,
  PaymentConfig,
  StyleConfig,
} from "../types";
import { products, categories } from "./seed";

/* ── Products → AdminProducts ────────────────── */

export const adminProducts: AdminProduct[] = products.map((p) => ({
  ...p,
  status: "alta" as const,
  featured: ["amazonas", "poke-salmon", "promo-duo"].includes(p.id),
  private: false,
  gallery: [],
  toppings: [],
}));

export { categories };

/* ── Promotions (mock) ───────────────────────── */

export const promotions: Promotion[] = [
  {
    id: "promo-1",
    name: "Descuento Rolls Clásicos",
    percentage: 15,
    applyToAll: false,
    productIds: ["amazonas", "alaska", "new-york-phila", "buenos-aires", "tokio"],
    dateFrom: "2026-02-01",
    dateTo: "2026-02-28",
    weeklyRepeat: false,
  },
  {
    id: "promo-2",
    name: "Happy Hour Viernes",
    percentage: 10,
    applyToAll: true,
    productIds: [],
    dateFrom: "2026-02-07",
    dateTo: "2026-03-28",
    weeklyRepeat: true,
  },
];

/* ── Coupons (mock) ──────────────────────────── */

export const coupons: Coupon[] = [
  {
    id: "cup-1",
    code: "BIENVENIDO20",
    name: "Cupón de bienvenida",
    type: "percentage",
    value: 20,
    minOrder: 5000,
    maxUses: 100,
    usedCount: 23,
    applyTo: "all",
    categoryIds: [],
    productIds: [],
    activeDays: [],
    timeFrom: "",
    timeTo: "",
    dateFrom: "2026-01-01",
    dateTo: "2026-06-30",
    active: true,
  },
  {
    id: "cup-2",
    code: "ROLLS15",
    name: "15% en Rolls Clásicos",
    type: "percentage",
    value: 15,
    minOrder: 0,
    maxUses: 50,
    usedCount: 12,
    applyTo: "categories",
    categoryIds: ["rolls-clasicos", "rolls-especiales"],
    productIds: [],
    activeDays: [5, 6], // viernes y sábado
    timeFrom: "19:00",
    timeTo: "23:00",
    dateFrom: "2026-02-01",
    dateTo: "2026-03-31",
    active: true,
  },
  {
    id: "cup-3",
    code: "POKE500",
    name: "$500 off en Pokes",
    type: "fixed",
    value: 500,
    minOrder: 3000,
    maxUses: 30,
    usedCount: 30,
    applyTo: "products",
    categoryIds: [],
    productIds: ["poke-salmon", "poke-vegan"],
    activeDays: [1, 2, 3, 4], // lunes a jueves
    timeFrom: "",
    timeTo: "",
    dateFrom: "2026-01-15",
    dateTo: "2026-02-15",
    active: false,
  },
];

/* ── Users (mock) ────────────────────────────── */

export const users: AppUser[] = [
  {
    id: "u1",
    name: "María González",
    email: "maria@email.com",
    phone: "1134567890",
    address: "Av. Corrientes 1234, CABA",
    status: "activo",
    registeredAt: "2025-06-15",
    totalSpent: 45200,
    lastOrderDate: "2026-02-09",
  },
  {
    id: "u2",
    name: "Juan Pérez",
    email: "juan.perez@email.com",
    phone: "1145678901",
    address: "Calle Falsa 123, Liniers",
    status: "activo",
    registeredAt: "2025-08-20",
    totalSpent: 78350,
    lastOrderDate: "2026-02-10",
  },
  {
    id: "u3",
    name: "Lucía Fernández",
    email: "lucia.f@email.com",
    phone: "1156789012",
    address: "Rivadavia 5678, Caballito",
    status: "inactivo",
    registeredAt: "2025-03-10",
    totalSpent: 12000,
    lastOrderDate: "2025-11-05",
  },
  {
    id: "u4",
    name: "Carlos López",
    email: "carlos.l@email.com",
    phone: "1167890123",
    address: "San Martín 456, Mataderos",
    status: "activo",
    registeredAt: "2025-10-01",
    totalSpent: 92100,
    lastOrderDate: "2026-02-11",
  },
  {
    id: "u5",
    name: "Ana Rodríguez",
    email: "ana.r@email.com",
    phone: "1178901234",
    address: "Belgrano 789, Flores",
    status: "bloqueado",
    registeredAt: "2025-04-22",
    totalSpent: 5400,
    lastOrderDate: "2025-07-18",
  },
  {
    id: "u6",
    name: "Diego Martínez",
    email: "diego.m@email.com",
    phone: "1189012345",
    address: "Av. Directorio 3456, Parque Avellaneda",
    status: "activo",
    registeredAt: "2025-09-14",
    totalSpent: 34700,
    lastOrderDate: "2026-01-30",
  },
  {
    id: "u7",
    name: "Valentina Torres",
    email: "val.torres@email.com",
    phone: "1190123456",
    address: "Castañares 1234, Villa Lugano",
    status: "activo",
    registeredAt: "2025-12-01",
    totalSpent: 18900,
    lastOrderDate: "2026-02-08",
  },
  {
    id: "u8",
    name: "Martín Sánchez",
    email: "martin.s@email.com",
    phone: "1101234567",
    address: "Lacarra 567, Liniers",
    status: "inactivo",
    registeredAt: "2025-05-30",
    totalSpent: 8200,
    lastOrderDate: "2025-09-12",
  },
];

/* ── Business config ─────────────────────────── */

export const businessConfig: BusinessConfig = {
  title: "Tus Pedidos",
  email: "info@tuspedidos.com",
  address: "Av. Rivadavia 9833, Liniers",
  addressUrl: "https://maps.google.com/?q=Av.+Rivadavia+9833,+Liniers,+Buenos+Aires",
  url: "https://tuspedidos.com",
  description: "Sushi, pokes, burgers y más. Pedí online y recibí en tu casa.",
  phone: "5491165884326",
  isOpen: true,
  logo: "",
  favicon: "",
  banners: [],
  whatsapp: "5491165884326",
  socialLinks: [
    { platform: "Instagram", url: "https://instagram.com/tuspedidos" },
    { platform: "Facebook", url: "https://facebook.com/tuspedidos" },
  ],
  sliderImages: [],
};

/* ── Payment config ──────────────────────────── */

export const paymentConfig: PaymentConfig = {
  efectivo: true,
  transferencia: true,
  mercadopago: false,
  whatsapp: true,
  deliveryMode: "envio_retiro",
  deliveryCost: 1500,
};

/* ── Style config ────────────────────────────── */

export const styleConfig: StyleConfig = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontUrl: "",
  headerBg: "#111827",
  headerText: "#ffffff",
  menuBg: "#1f2937",
  menuText: "#d1d5db",
  bodyBg: "#030712",
  panelBg: "#111827",
  popupBg: "#3b3434",
  generalText: "#d1d5db",
  titleText: "#ffffff",
  buttonBg: "#059669",
  buttonText: "#ffffff",
  footerEnabled: true,
  footerBg: "#111827",
  footerText: "#9ca3af",
};
