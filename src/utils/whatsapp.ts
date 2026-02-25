import type { CartItem, CheckoutData } from "../types";
import { plainPrice, plainTotal } from "./money";
import { formatDateTimeForMessage } from "./dateTime";

export function buildWhatsAppMessage(
  items: CartItem[],
  checkout: CheckoutData,
  storeAddress: string
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

  msg += `\nTotal a pagar: $${plainTotal(total)}\n`;
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

export function buildWhatsAppUrl(phone: string, message: string): string {
  // Sanitize phone: keep only digits (removes +, spaces, dashes, parentheses)
  const cleanPhone = phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
}
