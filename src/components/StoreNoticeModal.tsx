import { useEffect } from "react";

interface Props {
  /** El texto que cargó la sucursal en Configuración. Vacío = no hay aviso. */
  notice: string;
  /** Logo y nombre del local: sin eso, una pantalla con un cartel suelto
   *  parece un error del sitio y no un negocio que avisa algo. */
  logo?: string;
  title?: string;
}

/**
 * El cartel que tapa la tienda.
 *
 * No se cierra: no tiene botón, no responde al clic afuera ni a Escape. Mientras
 * la sucursal tenga un texto cargado en Configuración, el cliente ve esto y nada
 * más. Es a propósito — se usa cuando el local no puede atender (una reforma,
 * una mudanza) y dejarlo navegar el menú sólo termina en un pedido que nadie
 * prepara. Se apaga borrando el texto desde el panel.
 *
 * Por lo mismo no hay nada que recordar entre visitas: no se puede descartar,
 * así que no hay estado que guardar.
 */
export default function StoreNoticeModal({ notice, logo, title }: Props) {
  const texto = (notice || "").trim();

  // Mientras el cartel está puesto, la página de atrás no se scrollea. No se
  // ve igual, pero sin esto el dedo arrastra el menú por debajo del cartel y
  // parece que algo quedó a medio cargar.
  useEffect(() => {
    if (!texto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [texto]);

  if (!texto) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-5"
      style={{ backgroundColor: "var(--body-bg)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Aviso de la tienda"
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center shadow-2xl"
        style={{ backgroundColor: "var(--popup-bg)", color: "var(--general-text)" }}
      >
        {logo ? (
          <img src={logo} alt={title || ""} className="h-16 mx-auto mb-5 object-contain" />
        ) : null}

        <svg
          className="w-14 h-14 mx-auto mb-5"
          style={{ color: "var(--btn-bg)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>

        <p
          className="text-2xl font-extrabold leading-snug whitespace-pre-line [overflow-wrap:anywhere]"
          style={{ color: "var(--title-text)" }}
        >
          {texto}
        </p>

        {title ? (
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide opacity-60">
            {title}
          </p>
        ) : null}
      </div>
    </div>
  );
}
