export interface Variant {
  id: string;
  label: string;
  price: number;
  originalPrice?: number;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  imageUrl: string;
  type: "options" | "simple";
  basePrice?: number;
  originalPrice?: number;
  activePromotion?: string;
  variants?: Variant[];
  badges?: ("sin_tacc" | "nuevo")[];
  stock?: number; // only for type "simple"
}

export interface Category {
  id: string;
  name: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  price: number;
  originalPrice?: number;
  categoryId: string;
  quantity: number;
  imageUrl: string;
  description: string;
}

export interface StoreConfig {
  isOpen: boolean;
  phone: string;
  address: string;
  addressUrl: string;
}

export interface CheckoutData {
  name: string;
  phone: string;
  deliveryType: "pickup" | "delivery";
  address: string;
  lat: number | null;
  lng: number | null;
  floor: string;
  date: string;
  time: string;
  instructions: string;
  paymentMethod: "Efectivo" | "Transferencia";
}

/* ── Admin types ─────────────────────────────── */

export interface AdminProduct extends Product {
  status: "alta" | "baja";
  featured: boolean;
  private: boolean;
  gallery: string[];
  toppings: Topping[];
}

export interface Topping {
  id: string;
  name: string;
  price: number;
}

export type PromotionType = "percentage" | "same_product_quantity";

export interface Promotion {
  id: string;
  name: string;
  percentage: number;
  applyToAll: boolean;
  productIds: string[];
  dateFrom: string;
  dateTo: string;
  weeklyRepeat: boolean;
  type?: PromotionType;
  minQuantity?: number;
}

export interface ActivePromotion {
  id: string;
  name: string;
  percentage: number;
  timeTo: string | null; // "HH:MM" or null
  type?: PromotionType;
  minQuantity?: number;
}

// Promo "2x1 al mismo producto" — el descuento depende de la cantidad pedida
// del MISMO ítem en el carrito, por eso se calcula client-side al armar el
// pedido (y se reverifica server-side al crear el order).
export interface SameProductPromo {
  id: number;
  name: string;
  percentage: number;
  min_quantity: number;
  apply_scope: "all" | "categories" | "products";
  productIds: string[];
  categoryIds: string[];
}

export type UserStatus = "activo" | "inactivo" | "bloqueado";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: UserStatus;
  registeredAt: string;
  totalSpent: number;
  lastOrderDate: string | null;
}

export interface DaySchedule {
  open: string;
  close: string;
}

export interface Holiday {
  date: string;
  reason: string;
}

export interface Schedule {
  // Cada día puede tener múltiples turnos (almuerzo + cena, etc.).
  // Por retro-compatibilidad también aceptamos el shape antiguo de un solo
  // turno; el server normaliza ambos.
  hours?: Record<string, DaySchedule[] | DaySchedule | null>;
  holidays?: Holiday[];
}

export interface BusinessConfig {
  title: string;
  email: string;
  address: string;
  addressUrl: string;
  url: string;
  description: string;
  phone: string;
  isOpen: boolean;
  closedReason?: string | null;
  nextOpenTime?: string | null;
  holidayReason?: string | null;
  schedule?: Schedule;
  logo: string;
  favicon: string;
  banners: string[];
  whatsapp: string;
  socialLinks: { platform: string; url: string }[];
  sliderImages: string[];
}

export interface PaymentConfig {
  efectivo: boolean;
  transferencia: boolean;
  mercadopago: boolean;
  whatsapp: boolean;
  deliveryMode: "envio_retiro" | "solo_retiro" | "solo_envio";
  deliveryCost: number;
}

export interface StyleConfig {
  fontFamily: string;
  fontUrl: string;
  headerBg: string;
  headerText: string;
  menuBg: string;
  menuText: string;
  bodyBg: string;
  panelBg: string;
  popupBg: string;
  generalText: string;
  titleText: string;
  buttonBg: string;
  buttonText: string;
  footerEnabled: boolean;
  footerBg: string;
  footerText: string;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  applyTo: "all" | "categories" | "products";
  categoryIds: string[];
  productIds: string[];
  activeDays: number[]; // 0=Dom 1=Lun … 6=Sáb; vacío=todos
  timeFrom: string;     // "HH:MM" o "" sin restricción
  timeTo: string;       // "HH:MM" o "" sin restricción
  dateFrom: string;
  dateTo: string;
  active: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  polygon: LatLng[];
  cost: number;
  active: boolean;
  color: string;
}

export interface AdminState {
  products: AdminProduct[];
  categories: Category[];
  promotions: Promotion[];
  coupons: Coupon[];
  deliveryZones: DeliveryZone[];
  users: AppUser[];
  businessConfig: BusinessConfig;
  paymentConfig: PaymentConfig;
  styleConfig: StyleConfig;
}
