import { useState, useEffect } from "react";
import type { ActivePromotion } from "../types";

interface Props {
  promotions: ActivePromotion[];
}

function getTimeRemaining(timeTo: string): { hours: number; minutes: number; seconds: number } | null {
  const now = new Date();
  const [h, m] = timeTo.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m || 0, 0, 0);

  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;

  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function CountdownTimer({ timeTo }: { timeTo: string }) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(timeTo));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getTimeRemaining(timeTo);
      if (!r) {
        clearInterval(interval);
        setRemaining(null);
        return;
      }
      setRemaining(r);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeTo]);

  if (!remaining) return null;

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      <span className="text-sm font-medium opacity-90">
        Termina en {pad(remaining.hours)}:{pad(remaining.minutes)}:{pad(remaining.seconds)}
      </span>
    </div>
  );
}

export default function PromoBanner({ promotions }: Props) {
  if (promotions.length === 0) return null;

  // Show the first active promotion (most relevant)
  const promo = promotions[0];

  return (
    <div
      className="rounded-xl overflow-hidden px-5 py-4"
      style={{
        background: "linear-gradient(135deg, var(--btn-bg), color-mix(in srgb, var(--btn-bg) 65%, black))",
        color: "var(--btn-text)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wider opacity-80">
          Oferta Flash
        </span>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px]">⚡</span>
      </div>

      <p className="text-lg font-extrabold leading-tight">
        {promo.name} — {promo.percentage}% OFF
      </p>

      {promo.timeTo && <CountdownTimer timeTo={promo.timeTo} />}
    </div>
  );
}
