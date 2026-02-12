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
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 ${
            selected === cat.id
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
