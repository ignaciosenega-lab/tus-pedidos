interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  sort: "default" | "price-asc" | "price-desc" | "name";
  onSortChange: (val: "default" | "price-asc" | "price-desc" | "name") => void;
}

export default function SearchAndSort({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"
          style={{ color: "var(--general-text)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
          placeholder="Buscar productos..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder-current/40 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{
            backgroundColor: "var(--panel-bg)",
            color: "var(--general-text)",
            "--tw-ring-color": "var(--btn-bg)",
          } as React.CSSProperties}
        />
      </div>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as Props["sort"])}
        className="border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
        style={{
          backgroundColor: "var(--panel-bg)",
          color: "var(--general-text)",
          "--tw-ring-color": "var(--btn-bg)",
        } as React.CSSProperties}
      >
        <option value="default">Ordenar por</option>
        <option value="price-asc">Precio: menor a mayor</option>
        <option value="price-desc">Precio: mayor a menor</option>
        <option value="name">Nombre A-Z</option>
      </select>
    </div>
  );
}
