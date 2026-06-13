import { CATALOG_ITEMS } from "./items";
import type { CatalogEntry, Category } from "./types";

export type { CatalogEntry, Category, Part, Primitive, Slot } from "./types";
export { CATALOG_ITEMS };

const byId = new Map(CATALOG_ITEMS.map((e) => [e.id, e]));

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return byId.get(id);
}

export const CATEGORIES: Category[] = [
  "living",
  "bedroom",
  "kitchen",
  "bathroom",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  living: "Living",
  bedroom: "Bedroom",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
};

// The primary slot (used by the Paint tool's one-click recolor).
export function primarySlot(entry: CatalogEntry): string {
  return entry.slots[0]!.name;
}
