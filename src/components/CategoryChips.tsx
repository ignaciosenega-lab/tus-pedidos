import type { Category } from "../types";

interface Props {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}

export default function CategoryChips({ categories, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-opacity shrink-0 hover:opacity-90"
          style={
            selected === cat.id
              ? { backgroundColor: "var(--btn-bg)", color: "var(--btn-text)" }
              : { backgroundColor: "var(--panel-bg)", color: "var(--general-text)" }
          }
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
