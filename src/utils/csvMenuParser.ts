import type { AdminProduct, Category, Variant } from "../types";

interface CsvRow {
  categoria: string;
  producto: string;
  descripcion: string;
  unidad1: string;
  precio1: string;
  unidad2: string;
  precio2: string;
  unidad3: string;
  precio3: string;
  unidad4: string;
  precio4: string;
  foto_url: string;
}

/** Parse a price string like "$10.900" or "$9.890" → 10900 */
function parsePrice(raw: string): number {
  if (!raw) return 0;
  // Remove $, dots (thousand sep) and trim
  const cleaned = raw.replace(/[$\s]/g, "").replace(/\./g, "");
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/** Slugify a category name into an id */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Parse CSV text with proper quote handling */
function parseCsvText(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const lines = text.split("\n");
  if (lines.length < 2) return rows;

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV fields respecting quotes
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    // Need at least categoria + producto
    if (fields.length < 2 || !fields[0] || !fields[1]) continue;

    rows.push({
      categoria: fields[0] ?? "",
      producto: fields[1] ?? "",
      descripcion: fields[2] ?? "",
      unidad1: fields[3] ?? "",
      precio1: fields[4] ?? "",
      unidad2: fields[5] ?? "",
      precio2: fields[6] ?? "",
      unidad3: fields[7] ?? "",
      precio3: fields[8] ?? "",
      unidad4: fields[9] ?? "",
      precio4: fields[10] ?? "",
      foto_url: (fields[11] ?? "").replace(/^"|"$/g, ""),
    });
  }

  return rows;
}

export interface CsvImportResult {
  products: AdminProduct[];
  categories: Category[];
  rowCount: number;
}

export function parseMenuCsv(csvText: string, existingCategories: Category[]): CsvImportResult {
  const rows = parseCsvText(csvText);

  // Build category map (reuse existing ones where possible)
  const categoryMap = new Map<string, Category>();
  for (const cat of existingCategories) {
    categoryMap.set(cat.name.toLowerCase(), cat);
  }

  const newCategories: Category[] = [];

  function getOrCreateCategory(name: string): string {
    const key = name.toLowerCase();
    const existing = categoryMap.get(key);
    if (existing) return existing.id;

    const id = slugify(name);
    const cat: Category = { id, name };
    categoryMap.set(key, cat);
    newCategories.push(cat);
    return id;
  }

  // Parse products
  const products: AdminProduct[] = rows.map((row, index) => {
    const categoryId = getOrCreateCategory(row.categoria);

    // Build variants from unidad/precio pairs
    const variants: Variant[] = [];
    const pairs: [string, string][] = [
      [row.unidad1, row.precio1],
      [row.unidad2, row.precio2],
      [row.unidad3, row.precio3],
      [row.unidad4, row.precio4],
    ];

    for (const [unit, price] of pairs) {
      if (unit && price) {
        variants.push({
          id: `v-${Date.now()}-${index}-${variants.length}`,
          label: unit,
          price: parsePrice(price),
          stock: 999,
        });
      }
    }

    const isSimple = variants.length <= 1;
    const basePrice = isSimple ? (variants[0]?.price ?? 0) : undefined;

    // Detect badges from name/description
    const badges: ("sin_tacc" | "nuevo")[] = [];
    const nameLower = row.producto.toLowerCase();
    const descLower = row.descripcion.toLowerCase();
    if (nameLower.includes("sin tacc") || descLower.includes("sin tacc")) {
      badges.push("sin_tacc");
    }

    // Clean image URL
    let imageUrl = row.foto_url.trim();
    if (imageUrl === "," || !imageUrl) {
      imageUrl = `https://placehold.co/400x300/1a1a2e/ffffff?text=${encodeURIComponent(row.producto.substring(0, 15))}`;
    }

    return {
      id: `csv-${Date.now()}-${index}`,
      name: row.producto,
      description: row.descripcion,
      categoryId,
      imageUrl,
      type: isSimple ? "simple" as const : "options" as const,
      basePrice: isSimple ? basePrice : undefined,
      stock: isSimple ? 999 : undefined,
      variants: isSimple ? [] : variants,
      badges,
      status: "alta" as const,
      featured: false,
      private: false,
      gallery: [],
      toppings: [],
    };
  });

  return {
    products,
    categories: newCategories,
    rowCount: rows.length,
  };
}
