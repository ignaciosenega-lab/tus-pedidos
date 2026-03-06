import type { Category } from "../types";

interface Props {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function CategoryTabs({ categories, activeId, onSelect }: Props) {
  return (
    <div
      className="sticky z-40 border-b border-white/10 backdrop-blur-md"
      style={{ backgroundColor: "color-mix(in srgb, var(--body-bg) 95%, transparent)", top: "76px" }}
    >
      <div className="flex overflow-x-auto no-scrollbar gap-0">
        {categories.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className="whitespace-nowrap px-5 py-3 text-sm font-bold tracking-wide transition-colors relative shrink-0"
              style={{
                color: isActive ? "var(--btn-bg)" : "var(--general-text)",
                opacity: isActive ? 1 : 0.6,
              }}
            >
              {cat.name.toUpperCase()}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full"
                  style={{ backgroundColor: "var(--btn-bg)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
