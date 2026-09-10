import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelSlice, WonPrize } from "../types";

interface Props {
  slices: WheelSlice[];
  /** Premio ya resuelto por el server. `null` mientras el request está en vuelo. */
  prize: WonPrize | null;
  /** Descuento en pesos que el premio representa para ESTE carrito. 0 en un regalo. */
  discount?: number;
  /** True si el request falló: cerramos sin drama. */
  failed?: boolean;
  onClose: () => void;
  /** Se dispara cuando la animación terminó y el premio quedó revelado. */
  onRevealed?: () => void;
}

/**
 * Ruleta de premios. Cuatro fases:
 *
 *  1. `idle`     — la rueda quieta y un botón GIRAR. El cliente la tiene que
 *                  jugar: si girara sola sería un cartel, no un juego.
 *  2. `spinning` — giro libre, por si el premio del server todavía no llegó.
 *  3. `landing`  — ya sabemos qué salió, así que una sola transición
 *                  determinística hasta el gajo ganador.
 *  4. `revealed` — el premio, dicho con todas las letras.
 *
 * Mientras el cliente mira la rueda quieta, el premio ya se está pidiendo al
 * server en paralelo. Así, cuando toca GIRAR, casi siempre ya llegó y la
 * animación arranca y frena de una sola pasada.
 *
 * El resultado NO se decide acá: viene del server, que ya lo escribió en la
 * base. Este componente solo lo muestra.
 */
export default function PrizeWheel({ slices, prize, discount = 0, failed, onClose, onRevealed }: Props) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing" | "revealed">("idle");
  const [angle, setAngle] = useState(0);
  const startedAt = useRef(0);

  function handleSpin() {
    startedAt.current = Date.now();
    setPhase("spinning");
  }

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const step = slices.length > 0 ? 360 / slices.length : 360;

// Todos los gajos van en negro y se separan con una línea roja. Un color por
// gajo competía con el color de la marca de cada sucursal y en pantalla chica
// terminaba siendo ruido; el contraste negro/rojo se lee siempre igual, no
// importa el tema del local.
const SLICE_BG = "#0f0f12";
const DIVIDER = "#e11d2f";

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
          {phase === "revealed" && prize
            ? `🎉 ¡Ganaste ${prize.label}!`
            : phase === "idle"
              ? "Tenés un giro"
              : "Girando…"}
        </h3>
        <p className="text-xs opacity-70 mb-5" style={{ color: "var(--panel-text, #fff)" }}>
          {phase === "revealed" && prize
            ? prize.type === "product"
              ? "Te lo agregamos al pedido."
              : discount > 0
                ? "Ya está aplicado a tu pedido."
                : "Se aplica a tu pedido."
            : phase === "idle"
              ? "Girá la ruleta y ganate un descuento."
              : "Estamos sorteando tu premio."}
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
            className={`w-full h-full rounded-full overflow-hidden ${
              phase === "spinning" && !reducedMotion ? "tp-wheel-idle" : ""
            }`}
            style={{
              backgroundColor: SLICE_BG,
              border: `5px solid ${DIVIDER}`,
              boxShadow: "0 8px 30px rgba(0,0,0,.45)",
              transform: `rotate(${angle}deg)`,
              transition:
                phase === "landing"
                  ? "transform 4.2s cubic-bezier(.16,.68,.28,1)"
                  : undefined,
            }}
          >
            {/* Separadores: una línea roja en cada borde entre gajos. Van desde
                el centro hacia afuera, rotadas al ángulo de cada división. */}
            {slices.length > 1 &&
              slices.map((s, i) => (
                <div
                  key={`div-${s.id}`}
                  className="absolute pointer-events-none"
                  style={{
                    top: 0,
                    left: "50%",
                    width: 2,
                    height: "50%",
                    marginLeft: -1,
                    backgroundColor: DIVIDER,
                    transformOrigin: "bottom center",
                    transform: `rotate(${i * step}deg)`,
                  }}
                />
              ))}

            {slices.map((s, i) => (
              <div
                key={s.id}
                className="absolute inset-0 flex items-start justify-center pointer-events-none"
                style={{ transform: `rotate(${i * step + step / 2}deg)` }}
              >
                <span
                  className="text-[11px] font-bold text-white mt-4 px-1"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,.9)", maxWidth: 90 }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {phase === "idle" ? (
          <>
            <button
              onClick={handleSpin}
              data-testid="spin-now"
              className="w-full py-3.5 rounded-lg font-extrabold text-base tracking-wide"
              style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              GIRAR
            </button>
            <button
              onClick={onClose}
              className="text-xs underline opacity-60 mt-3"
              style={{ color: "var(--panel-text, #fff)" }}
            >
              Ahora no
            </button>
          </>
        ) : phase === "revealed" && prize ? (
          <>
            {prize.type === "product" && prize.image ? (
              <img
                src={prize.image}
                alt={prize.label}
                className="w-24 h-24 object-cover rounded-xl mx-auto mb-3"
                style={{ border: "2px solid var(--btn-bg, #10b981)" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}

            {/* El premio, otra vez y en grande. Que no dependa de que el
                cliente haya leído el encabezado. */}
            <div
              className="text-2xl font-extrabold leading-tight"
              style={{ color: "var(--btn-bg, #10b981)" }}
            >
              {prize.label}
            </div>

            {prize.type === "product" ? (
              <p className="text-sm opacity-80 mt-1" style={{ color: "var(--panel-text, #fff)" }}>
                de regalo con tu pedido
              </p>
            ) : discount > 0 ? (
              <p className="text-sm opacity-80 mt-1" style={{ color: "var(--panel-text, #fff)" }}>
                Ahorrás ${discount.toLocaleString("es-AR")} en este pedido
              </p>
            ) : null}

            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg font-bold mt-5"
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
