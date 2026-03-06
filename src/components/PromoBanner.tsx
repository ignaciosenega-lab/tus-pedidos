import type { ActivePromotion } from "../types";

interface Props {
  promotion: ActivePromotion;
}

export default function PromoBanner({ promotion }: Props) {
  return (
    <div
      className="my-8 rounded-xl overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, var(--btn-bg), color-mix(in srgb, var(--btn-bg) 70%, black))",
        color: "var(--btn-text)",
      }}
    >
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"20\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h10v10H0zM10 10h10v10H10z\" fill=\"%23fff\" fill-opacity=\".15\"/%3E%3C/svg%3E')", backgroundSize: "20px 20px" }} />
      <div className="relative flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex flex-col gap-1">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit uppercase tracking-wider"
            style={{ backgroundColor: "var(--btn-text)", color: "var(--btn-bg)" }}
          >
            Oferta activa
          </span>
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight mt-1">
            {promotion.name}
          </h3>
          <p className="text-sm opacity-80">
            {promotion.percentage}% de descuento
            {promotion.applyScope === "all" && " en todos los productos"}
          </p>
        </div>
        <div className="flex items-center justify-center w-16 h-16 rounded-full shrink-0 ml-4" style={{ backgroundColor: "color-mix(in srgb, var(--btn-text) 20%, transparent)" }}>
          <span className="font-extrabold text-xl">-{promotion.percentage}%</span>
        </div>
      </div>
    </div>
  );
}
