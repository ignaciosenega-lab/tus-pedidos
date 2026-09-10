import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelSlice, WonPrize } from "../types";

interface Props {
  slices: WheelSlice[];
  /** Premio ya resuelto por el server. `null` mientras el request está en vuelo. */
  prize: WonPrize | null;
  /** True si el request falló: cerramos sin drama. */
  failed?: boolean;
  onClose: () => void;
  /** Se dispara cuando la animación terminó y el premio quedó revelado. */
  onRevealed?: () => void;
}

/**
 * Ruleta de premios. Dos fases de animación:
 *
 *  1. `spinning` — giro libre mientras esperamos la respuesta del server.
 *  2. `landing`  — llegó el premio, así que sabemos el ángulo exacto y hacemos
 *     una sola transición determinística hasta el gajo ganador.
 *
 * El orden importa: primero el fetch, después la animación. Al revés, con una
 * conexión lenta la rueda se frenaría antes de que sepamos qué salió.
 *
 * El resultado NO se decide acá: viene del server, que ya lo escribió en la
 * base. Este componente solo lo muestra.
 */
export default function PrizeWheel({ slices, prize, failed, onClose, onRevealed }: Props) {
  const [phase, setPhase] = useState<"spinning" | "landing" | "revealed">("spinning");
  const [angle, setAngle] = useState(0);
  const startedAt = useRef(Date.now());

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const step = slices.length > 0 ? 360 / slices.length : 360;

  // Gajos dibujados con conic-gradient: un solo div, sin SVG ni canvas.
  const background = useMemo(() => {
    if (slices.length === 0) return "var(--panel-bg, #1f2937)";
    const stops = slices
      .map((s, i) => `${s.color} ${i * step}deg ${(i + 1) * step}deg`)
      .join(", ");
    return `conic-gradient(${stops})`;
  }, [slices, step]);

  useEffect(() => {
    if (!prize || phase !== "spinning") return;

    const index = slices.findIndex((s) => s.id === prize.id);
    if (index < 0) {
      // El premio no está entre los gajos dibujados (la sucursal editó la
      // ruleta mientras el cliente jugaba). Mostramos el resultado igual.
      setPhase("revealed");
      onRevealed?.();
      return;
    }

    if (reducedMotion) {
      setPhase("revealed");
      onRevealed?.();
      return;
    }

    // El puntero está arriba (12 en punto), así que hay que rotar el centro
    // del gajo ganador hasta esa posición. Las 6 vueltas enteras son para que
    // se vea como una tirada y no como un salto.
    const center = index * step + step / 2;
    const jitter = Math.random() * step * 0.5 - step * 0.25;
    const target = 360 * 6 - center + jitter;

    // Dejamos que el giro libre se vea al menos 600ms aunque el server
    // conteste al instante: si no, la ruleta "parpadea" y no se entiende.
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, 600 - elapsed);
    const t = setTimeout(() => {
      setAngle(target);
      setPhase("landing");
    }, wait);
    return () => clearTimeout(t);
  }, [prize, phase, slices, step, reducedMotion, onRevealed]);

  // Red de seguridad: si `transitionend` no llega —pestaña en segundo plano,
  // transiciones deshabilitadas por el sistema, un navegador que se la come—
  // el cliente se quedaría mirando una ruleta que gira para siempre, sin forma
  // de seguir con el pedido. Pasado el tiempo de la animación, revelamos igual.
  useEffect(() => {
    if (phase !== "landing") return;
    const t = setTimeout(() => {
      setPhase("revealed");
      onRevealed?.();
    }, 4600);
    return () => clearTimeout(t);
  }, [phase, onRevealed]);

  useEffect(() => {
    if (failed) onClose();
  }, [failed, onClose]);

  function handleTransitionEnd() {
    if (phase === "landing") {
      setPhase("revealed");
      onRevealed?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,.75)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Ruleta de premios"
      // La ruleta se monta dentro del modal de checkout, cuyo fondo cierra
      // todo al recibir un click. Sin este stopPropagation, tocar cualquier
      // botón de la ruleta cerraría el checkout entero y el cliente perdería
      // el formulario que acababa de completar.
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ backgroundColor: "var(--panel-bg, #111827)" }}
      >
        <h3
          className="text-lg font-bold mb-1"
          style={{ color: "var(--panel-text, #fff)" }}
        >
          {phase === "revealed" ? "🎉 ¡Ganaste!" : "Girando…"}
        </h3>
        <p className="text-xs opacity-70 mb-5" style={{ color: "var(--panel-text, #fff)" }}>
          {phase === "revealed"
            ? "El descuento ya está aplicado en tu pedido."
            : "Estamos sorteando tu descuento."}
        </p>

        <div className="relative mx-auto mb-5" style={{ width: 240, height: 240 }}>
          {/* Puntero */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10"
            style={{
              top: -6,
              width: 0,
              height: 0,
              borderLeft: "11px solid transparent",
              borderRight: "11px solid transparent",
              borderTop: "18px solid var(--btn-bg, #fff)",
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,.5))",
            }}
          />
          {/* Rueda */}
          <div
            onTransitionEnd={handleTransitionEnd}
            className={`w-full h-full rounded-full ${
              phase === "spinning" && !reducedMotion ? "tp-wheel-idle" : ""
            }`}
            style={{
              background,
              border: "6px solid var(--btn-bg, #fff)",
              boxShadow: "0 8px 30px rgba(0,0,0,.45)",
              transform: `rotate(${angle}deg)`,
              transition:
                phase === "landing"
                  ? "transform 4.2s cubic-bezier(.16,.68,.28,1)"
                  : undefined,
            }}
          >
            {slices.map((s, i) => (
              <div
                key={s.id}
                className="absolute inset-0 flex items-start justify-center pointer-events-none"
                style={{ transform: `rotate(${i * step + step / 2}deg)` }}
              >
                <span
                  className="text-[11px] font-bold text-white mt-3 px-1"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,.6)", maxWidth: 90 }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {phase === "revealed" && prize ? (
          <>
            <div
              className="text-2xl font-extrabold mb-4"
              style={{ color: "var(--btn-bg, #10b981)" }}
            >
              {prize.label}
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg font-bold"
              style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              Seguir con mi pedido
            </button>
          </>
        ) : (
          // Escape siempre disponible: la ruleta nunca puede dejar atrapado al
          // cliente con el pedido a medio enviar.
          <button
            onClick={onClose}
            className="text-xs underline opacity-60"
            style={{ color: "var(--panel-text, #fff)" }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
