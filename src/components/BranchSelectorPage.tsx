import { useState, useEffect, useMemo } from "react";
import { useStorefront } from "../hooks/useStorefront";
import ThemeStyles from "./ThemeStyles";

interface PublicBranch {
  id: number;
  slug: string;
  name: string;
  address: string;
  addressUrl: string;
  phone: string;
  whatsapp: string;
  logo: string;
  isOpen: boolean;
  nextOpenTime: string | null;
  holidayReason: string | null;
}

export default function BranchSelectorPage() {
  const { businessConfig, branchDomain } = useStorefront();
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<PublicBranch | null>(null);

  useEffect(() => {
    fetch("/api/branches/public")
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase().trim();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q)
    );
  }, [branches, search]);

  function handleConfirm() {
    if (!selectedBranch) return;
    const protocol = window.location.protocol;
    if (branchDomain) {
      window.location.href = `${protocol}//${selectedBranch.slug}.${branchDomain}`;
    } else {
      // Fallback: if no BRANCH_DOMAIN configured, use query param
      window.location.href = `/?branch=${selectedBranch.slug}`;
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--body-bg)", color: "var(--general-text)" }}
    >
      <ThemeStyles />

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 shadow-lg border-b border-white/10"
        style={{ backgroundColor: "var(--header-bg)", color: "var(--header-text)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {businessConfig.logo ? (
              <img
                src={businessConfig.logo}
                alt={businessConfig.title}
                className="object-contain"
                style={{ maxWidth: "220px", maxHeight: "80px" }}
              />
            ) : (
              <h1 className="text-lg font-bold tracking-wide">
                {businessConfig.title || "Tus Pedidos"}
              </h1>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-12">
        {/* Title section */}
        <section className="mb-8">
          <h1
            className="text-3xl font-extrabold"
            style={{ color: "var(--title-text)" }}
          >
            Seleccioná tu sucursal
          </h1>
          <p className="mt-2 opacity-70" style={{ color: "var(--general-text)" }}>
            Elegí la sucursal donde querés hacer tu pedido
          </p>
        </section>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: "var(--general-text)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre o dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{
                backgroundColor: "var(--panel-bg)",
                color: "var(--general-text)",
                "--tw-ring-color": "var(--btn-bg)",
              } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Branch list */}
        {loading ? (
          <div className="text-center py-12 opacity-50">Cargando sucursales...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 opacity-50">
            {search ? "No se encontraron sucursales" : "No hay sucursales disponibles"}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((branch) => {
              const isSelected = selectedBranch?.id === branch.id;
              return (
                <button
                  key={branch.id}
                  onClick={() => setSelectedBranch(branch)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "ring-2 border-transparent"
                      : "border-white/10 hover:border-white/20"
                  }`}
                  style={{
                    backgroundColor: "var(--panel-bg)",
                    ...(isSelected
                      ? { "--tw-ring-color": "var(--btn-bg)", borderColor: "var(--btn-bg)" } as React.CSSProperties
                      : {}),
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="font-bold text-base truncate"
                          style={{ color: "var(--title-text)" }}
                        >
                          {branch.name}
                        </h3>
                        {/* Open/closed badge */}
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            branch.isOpen
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              branch.isOpen ? "bg-emerald-400" : "bg-red-400"
                            }`}
                          />
                          {branch.isOpen ? "Abierto" : "Cerrado"}
                        </span>
                      </div>

                      {/* Address */}
                      <p className="text-sm opacity-60 flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="truncate">{branch.address || "Sin dirección"}</span>
                      </p>

                      {/* Phone */}
                      {branch.phone && (
                        <p className="text-sm opacity-50 flex items-center gap-1.5 mt-1">
                          <svg
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span>{branch.phone}</span>
                        </p>
                      )}

                      {/* Next open time if closed */}
                      {!branch.isOpen && branch.nextOpenTime && (
                        <p className="text-xs text-amber-400 mt-1.5">
                          {branch.holidayReason
                            ? `Cerrado por ${branch.holidayReason}`
                            : `Abre a las ${branch.nextOpenTime}hs`}
                        </p>
                      )}
                    </div>

                    {/* Selection indicator */}
                    <div
                      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-colors ${
                        isSelected ? "border-transparent" : "border-white/20"
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: "var(--btn-bg)", borderColor: "var(--btn-bg)" }
                          : {}
                      }
                    >
                      {isSelected && (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          style={{ color: "var(--btn-text)" }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Confirm button */}
        {selectedBranch && (
          <div className="mt-8 sticky bottom-4">
            <button
              onClick={handleConfirm}
              className="w-full py-4 rounded-xl font-bold text-base transition-opacity hover:opacity-90 shadow-lg"
              style={{ backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }}
            >
              Ir a {selectedBranch.name}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
