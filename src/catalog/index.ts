import { CATALOG_ITEMS } from "./items";
import type { CatalogEntry, Category } from "./types";

export type {
  CatalogEntry,
  CatalogVariant,
  Category,
  Part,
  Primitive,
  Slot,
  ScaleMode,
  ScaleAxes,
  CatalogScaling,
} from "./types";
export {
  clampScale,
  effectiveDimensions,
  collisionExtent,
  dimensionToMultiplier,
  UNIT_SCALE,
} from "./scale";
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
  "office",
  "utility",
  "outdoor",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  living: "Living",
  bedroom: "Bedroom",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  office: "Office",
  utility: "Utility",
  outdoor: "Outdoor",
};

// The primary slot (used by the Paint tool's one-click recolor).
export function primarySlot(entry: CatalogEntry): string {
  return entry.slots[0]!.name;
}

// The default variant id of an entry (the first listed), or undefined if the
// entry has no variants. A pre-4c item with no `variant` resolves to this.
export function defaultVariantId(entry: CatalogEntry): string | undefined {
  return entry.variants?.[0]?.id;
}

// Resolve a possibly-missing/invalid requested variant to a valid one for this
// entry: the request if it names a real variant, else the default. Returns
// undefined for entries that have no variants. Single source of truth used by
// every build()/glyph() call site so variant rendering stays consistent.
export function resolveVariantId(
  entry: CatalogEntry,
  requested?: string,
): string | undefined {
  const variants = entry.variants;
  if (!variants || variants.length === 0) return undefined;
  if (requested && variants.some((v) => v.id === requested)) return requested;
  return variants[0]!.id;
}
