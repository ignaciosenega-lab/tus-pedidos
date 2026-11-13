import { useEffect, useState } from "react";

interface Props {
  /** El texto que cargó la sucursal en Configuración. Vacío = no hay aviso. */
  notice: string;
}

/**
 * El cartel que salta al entrar a la tienda.
 *
 * Lo escribe cada sucursal desde Configuración y sirve para avisar algo
 * puntual: una reforma, una mudanza, un corte de luz. No bloquea nada — si
 * además hay que dejar de tomar pedidos, eso se hace cerrando el local.
 *
 * Se muestra una vez por visita: un cartel que reaparece en cada pantalla
 * termina siendo algo que el cliente cierra sin leer. Si el texto cambia
 * vuelve a aparecer, porque la clave guardada incluye el propio texto.
 */
export default function StoreNoticeModal({ notice }: Props) {
  const texto = (notice || "").trim();
  const clave = "aviso-tienda:" + texto;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!texto) return;
    let yaLoVio = false;
    try {
      yaLoVio = sessionStorage.getItem(clave) === "1";
    } catch {
      // Modo incógnito o storage bloqueado: mostramos el aviso igual. Es
      // preferible repetirlo a que nunca aparezca.
    }
    if (!yaLoVio) setVisible(true);
  }, [clave, texto]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  function cerrar() {
    setVisible(false);
    try {
      sessionStorage.setItem(clave, "1");
    } catch {
      /* ver arriba */
    }
  }

  if (!texto || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4"
      onClick={cerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Aviso de la tienda"
    >
      <div
        className="w-full max-w-md rounded-2xl p-7 text-center shadow-2xl"
        style={{ backgroundColor: "var(--popup-bg)", color: "var(--general-text)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="w-12 h-12 mx-auto mb-4"
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
          className="text-xl font-extrabold leading-snug whitespace-pre-line [overflow-wrap:anywhere]"
          style={{ color: "var(--title-text)" }}
        >
          {texto}
        </p>

        <button
          onClick={cerrar}
          autoFocus
          className="mt-6 px-7 py-2.5 rounded-lg font-semibold transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
