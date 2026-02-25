import type { Category } from "../types";

interface Props {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}

export default function CategoryChips({ categories, selected, onSelect }: Props) {
  return (
    <div
      className="rounded-xl p-4 border border-white/10"
      style={{ backgroundColor: "var(--panel-bg)" }}
    >
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const isSelected = selected === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90 flex items-center gap-1.5"
              style={
                isSelected
                  ? { backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }
                  : { backgroundColor: "transparent", color: "var(--general-text)", border: "1px solid rgba(255,255,255,0.15)" }
              }
            >
              {isSelected && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
