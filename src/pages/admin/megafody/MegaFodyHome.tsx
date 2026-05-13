import { Link } from "react-router-dom";

interface Tile {
  to?: string;
  title: string;
  description: string;
  icon: JSX.Element;
  active: boolean;
}

const TILES: Tile[] = [
  {
    to: "/admin/megafody/delivery",
    title: "Delivery / Mostrador",
    description: "Tomá pedidos rápido sin mesa. Catálogo de productos + carrito + envío a cocina.",
    active: true,
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    ),
  },
  {
    to: "/admin/megafody/kds",
    title: "Cocina (KDS)",
    description: "Monitor para la cocina con los pedidos en preparación, listos para despachar y demoras.",
    active: true,
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6h13M5 21V3m4 0v4m4-4v4m4-4v4M3 3h18" />
      </svg>
    ),
  },
  {
    title: "Salón",
    description: "Plano editable de mesas, ocupación en vivo, tomar pedido por mesa, dividir cuenta.",
    active: false,
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2m14 0V9a2 2 0 00-2-2H7a2 2 0 00-2 2v2m12 6v3m-8-3v3" />
      </svg>
    ),
  },
  {
    title: "Caja & Cierres",
    description: "Movimientos de caja, arqueos, medios de pago, cierre de turno, reportes diarios.",
    active: false,
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Stock",
    description: "Inventario por producto/insumo, alertas de faltantes, recetas y costos.",
    active: false,
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: "Compras",
    description: "Proveedores, órdenes de compra, recepciones, comprobantes y pagos.",
    active: false,
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Facturación AFIP / ARCA",
    description: "Emisión de comprobantes fiscales por webservice (Factura B/C) + ticket interno.",
    active: false,
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function MegaFodyHome() {
  return (
    <div className="max-w-6xl">
      <h2 className="text-xl font-bold text-white mb-1">Inicio</h2>
      <p className="text-sm text-gray-400 mb-6">Elegí un módulo para arrancar. Los grises son los próximos.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TILES.map((tile) => {
          const baseClass =
            "block rounded-xl border p-5 transition-all";
          if (tile.active && tile.to) {
            return (
              <Link
                key={tile.title}
                to={tile.to}
                className={`${baseClass} bg-gray-900 border-gray-800 hover:border-rose-500 hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center">
                    {tile.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded">
                    Activo
                  </span>
                </div>
                <h3 className="text-white font-semibold text-base mb-1">{tile.title}</h3>
                <p className="text-xs text-gray-400 leading-snug">{tile.description}</p>
              </Link>
            );
          }
          return (
            <div
              key={tile.title}
              className={`${baseClass} bg-gray-900/50 border-gray-800/60 cursor-not-allowed opacity-60`}
              aria-disabled="true"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-lg bg-gray-800 text-gray-500 flex items-center justify-center">
                  {tile.icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-500 px-2 py-1 rounded">
                  Próximamente
                </span>
              </div>
              <h3 className="text-gray-300 font-semibold text-base mb-1">{tile.title}</h3>
              <p className="text-xs text-gray-500 leading-snug">{tile.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
