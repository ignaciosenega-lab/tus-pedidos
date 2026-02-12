import type { CartItem, CheckoutData } from "../types";
import { plainPrice, plainTotal } from "./money";
import { formatDateTimeForMessage } from "./dateTime";

export function buildWhatsAppMessage(
  items: CartItem[],
  checkout: CheckoutData,
  storeAddress: string
): string {
  let msg = "Detalle del Pedido \ud83c\udf81\n\n";

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
    msg += `\ud83d\udcc6 Fecha y Hora: ${dateTime}\n`;
    msg += `\u26a0\ufe0fObservación: ${checkout.instructions}\n`;
  } else {
    msg += `\nRetiro en sucursal\n`;
    msg += `\ud83d\udccd Sucursal: ${storeAddress}\n`;
    msg += `\ud83d\udcc6 Fecha y Hora: ${dateTime}\n`;
    msg += `\u26a0\ufe0fObservación: ${checkout.instructions}\n`;
  }

  return msg;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
}
