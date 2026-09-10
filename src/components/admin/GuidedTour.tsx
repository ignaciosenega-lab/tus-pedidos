import { useEffect, useLayoutEffect, useState } from "react";

export interface TourStep {
  /** Valor del atributo data-tour del elemento a resaltar. Opcional: sin él,
   *  el paso se muestra centrado, como una diapositiva. */
  target?: string;
  title: string;
  body: string;
}

interface Props {
  /** Clave de la pantalla. Se usa para recordar quién ya vio el tour. */
  screen: string;
  steps: TourStep[];
  /** Forzar la apertura (botón "Ver el tour"). */
  open?: boolean;
  onClose?: () => void;
}

const seenKey = (screen: string) => `tp_tour_${screen}`;

export function hasSeenTour(screen: string): boolean {
  try {
    return localStorage.getItem(seenKey(screen)) === "1";
  } catch {
    return true; // sin storage no insistimos en cada carga
  }
}

function markSeen(screen: string) {
  try {
    localStorage.setItem(seenKey(screen), "1");
  } catch {
    /* modo privado: que no rompa */
  }
}

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Recorrido guiado sobre una pantalla del admin.
 *
 * Marca los elementos a resaltar con `data-tour="algo"` en el JSX y declará
 * los pasos acá. Si un target no existe (porque la pantalla cambió o el
 * elemento está condicionado), el paso NO se rompe: se muestra centrado. Eso
 * evita que un refactor de UI deje el tour inutilizable.
 */
export default function GuidedTour({ screen, steps, open, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Primera visita: se abre solo. Después, solo con el botón.
  useEffect(() => {
    if (open) { setIndex(0); setVisible(true); return; }
    if (!hasSeenTour(screen)) {
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }
  }, [open, screen]);

  const step = steps[index];

  useLayoutEffect(() => {
    if (!visible || !step) return;

    function locate() {
      if (!step.target) { setRect(null); return; }
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    locate();
    // Recalcular después del scroll suave y ante cambios de viewport.
    const t = setTimeout(locate, 400);
    window.addEventListener("resize", locate);
    return () => { clearTimeout(t); window.removeEventListener("resize", locate); };
  }, [visible, step, index]);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function finish() {
    markSeen(screen);
    setVisible(false);
    setIndex(0);
    onClose?.();
  }

  function next() {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else finish();
  }

  if (!visible || !step) return null;

  const pad = 8;
  const hole = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // El tooltip va abajo del elemento salvo que no entre; ahí va arriba.
  const tooltipTop = hole
    ? hole.top + hole.height + 12 > window.innerHeight - 200
      ? Math.max(12, hole.top - 190)
      : hole.top + hole.height + 12
    : Math.max(12, window.innerHeight / 2 - 110);

  const tooltipLeft = hole
    ? Math.min(Math.max(12, hole.left), window.innerWidth - 360)
    : Math.max(12, window.innerWidth / 2 - 170);

  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true">
      {/* Fondo oscuro con un agujero sobre el elemento: se hace con un box-shadow
          gigante en vez de cuatro divs, así el recorte siempre calza justo. */}
      {hole ? (
        <div
          className="absolute rounded-lg pointer-events-none transition-all duration-300"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,.72)",
            border: "2px solid #10b981",
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,.72)" }} />
      )}

      {/* Capa para cerrar tocando afuera */}
      <div className="absolute inset-0" onClick={finish} />

      <div
        className="absolute bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-[340px]"
        style={{ top: tooltipTop, left: tooltipLeft }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">
          Paso {index + 1} de {steps.length}
        </div>
        <h4 className="text-white font-bold mb-1.5">{step.title}</h4>
        <p className="text-sm text-gray-300 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between mt-4 gap-2">
          <button onClick={finish} className="text-xs text-gray-500 hover:text-gray-300">
            Saltar
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800"
              >
                Atrás
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
            >
              {index === steps.length - 1 ? "Listo" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botón para relanzar el tour de una pantalla. */
export function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors whitespace-nowrap"
      title="Ver el recorrido guiado de esta pantalla"
    >
      ? Ver el tour
    </button>
  );
}
