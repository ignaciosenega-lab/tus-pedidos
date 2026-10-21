/**
 * Desglose de los descuentos de un pedido.
 *
 * Son cuatro y de orígenes distintos, por eso hace falta juntarlos:
 *
 *   - La promo porcentual viene **horneada** en el precio de cada ítem. No se
 *     guarda como descuento: está la diferencia entre `originalPrice` (lista) y
 *     `price` (lo que se cobró).
 *   - `promotion_discount` acumula las promos por cantidad, tipo 2x1.
 *   - `discount` es el cupón, y `coupon_code` dice cuál.
 *   - `wheel_discount` es el premio de la ruleta.
 *
 * Sin esto, la pantalla de Operación muestra productos por $124.400 y un total
 * de $87.080 sin explicar la diferencia, y el encargado no puede distinguir un
 * descuento de un error de carga.
 */

export interface ItemConDescuento {
  quantity?: number;
  qty?: number;
  price: number;
  originalPrice?: number;
}

export interface PedidoConDescuento {
  items?: ItemConDescuento[];
  discount?: number;
  promotion_discount?: number;
  wheel_discount?: number;
}

export interface Desglose {
  /** Lo que el pedido habría costado a precio de lista. */
  lista: number;
  /** Promo porcentual, la que viene dentro del precio del producto. */
  enProducto: number;
  /** Promos por cantidad (2x1 y similares). */
  promo: number;
  cupon: number;
  ruleta: number;
  /** La suma de los cuatro. */
  total: number;
  /** Sobre el precio de lista, que es lo que el cliente habría pagado. */
  porcentaje: number;
}

const cantidad = (i: ItemConDescuento) => i.quantity ?? i.qty ?? 1;
const lista = (i: ItemConDescuento) => Number(i.originalPrice ?? i.price) || 0;

export function desglosarDescuentos(order: PedidoConDescuento): Desglose {
  const items = order.items || [];

  const precioLista = items.reduce((t, i) => t + lista(i) * cantidad(i), 0);
  const enProducto = items.reduce(
    (t, i) => t + Math.max(0, lista(i) - (Number(i.price) || 0)) * cantidad(i),
    0
  );

  const promo = Number(order.promotion_discount) || 0;
  const cupon = Number(order.discount) || 0;
  const ruleta = Number(order.wheel_discount) || 0;
  const total = enProducto + promo + cupon + ruleta;

  return {
    lista: precioLista,
    enProducto,
    promo,
    cupon,
    ruleta,
    total,
    porcentaje: precioLista > 0 ? Math.round((total / precioLista) * 100) : 0,
  };
}
