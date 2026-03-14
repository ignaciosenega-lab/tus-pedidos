import type { CartItem, CheckoutData } from "../types";
import { plainPrice, plainTotal } from "./money";
import { formatDateTimeForMessage } from "./dateTime";

interface CouponInfo {
  code: string;
  name: string;
  discount: number;
}

export function buildWhatsAppMessage(
  items: CartItem[],
  checkout: CheckoutData,
  storeAddress: string,
  coupon?: CouponInfo
): string {
  // Current order timestamp
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const timestamp = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

  let msg = `Detalle del Pedido \ud83c\udf81\n`;
  msg += `\ud83d\udcc5 ${timestamp}\n\n`;

  msg += `\ud83d\udc64 ${checkout.name}\n`;
  msg += `\ud83d\udcf1 ${checkout.phone}\n\n`;

  let total = 0;
  items.forEach((item, i) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    const label = item.variantLabel
      ? `${item.productName} ${item.variantLabel}`
      : item.productName;
    msg += `${i + 1}- ${label}   $${plainPrice(item.price)} x ${item.quantity} = $ ${plainPrice(subtotal)}\n`;
  });

  if (coupon && coupon.discount > 0) {
    msg += `\nSubtotal: $${plainTotal(total)}\n`;
    msg += `Cupón ${coupon.code}: -$${plainTotal(coupon.discount)}\n`;
    msg += `Total a pagar: $${plainTotal(Math.max(0, total - coupon.discount))}\n`;
  } else {
    msg += `\nTotal a pagar: $${plainTotal(total)}\n`;
  }
  msg += `\n`;
  msg += `Forma de pago: ${checkout.paymentMethod}\n`;

  const dateTime = formatDateTimeForMessage(checkout.date, checkout.time);

  if (checkout.deliveryType === "delivery") {
    const floorInfo = checkout.floor ? ` ${checkout.floor}` : "";
    msg += `\nDatos de Envío\n`;
    msg += `\ud83d\udccd Dirección: ${checkout.address}${floorInfo}\n`;
    msg += `\ud83d\udcc6 Entrega: ${dateTime}\n`;
    msg += `\u26a0\ufe0f Observación: ${checkout.instructions}\n`;
  } else {
    msg += `\nRetiro en sucursal\n`;
    msg += `\ud83d\udccd Sucursal: ${storeAddress}\n`;
    msg += `\ud83d\udcc6 Entrega: ${dateTime}\n`;
    msg += `\u26a0\ufe0f Observación: ${checkout.instructions}\n`;
  }

  return msg;
}

/** Normalize an Argentine phone number for WhatsApp API (format: 549XXXXXXXXXX) */
export function normalizePhoneForWhatsApp(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length >= 12) return digits; // already correct
  if (digits.startsWith("54") && !digits.startsWith("549")) return "549" + digits.slice(2); // missing 9
  if (digits.startsWith("0")) return "549" + digits.slice(1); // local with leading 0
  return "549" + digits; // local number like 1124879447
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
}
