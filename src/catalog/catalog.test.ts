import { describe, it, expect } from "vitest";
import {
  CATALOG_ITEMS,
  CATEGORIES,
  getCatalogEntry,
  primarySlot,
} from "./index";

describe("catalog", () => {
  it("has 49 items with unique ids", () => {
    expect(CATALOG_ITEMS).toHaveLength(49);
    const ids = CATALOG_ITEMS.map((e) => e.id);
    expect(new Set(ids).size).toBe(49);
  });

  it("every entry has a positive footprint, height, and at least one slot", () => {
    for (const e of CATALOG_ITEMS) {
      expect(e.footprint.width).toBeGreaterThan(0);
      expect(e.footprint.depth).toBeGreaterThan(0);
      expect(e.height).toBeGreaterThan(0);
      expect(e.slots.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("declares a collidable flag; flat/decor items are non-collidable", () => {
    for (const e of CATALOG_ITEMS) {
      expect(typeof e.collidable).toBe("boolean");
    }
    const nonCollidable = new Set([
      "rug",
      "floor-lamp",
      "plant",
      "bedside-lamp",
      "mirror",
      "microwave",
      "towel-rack",
      "bathroom-cabinet",
      "desk-lamp",
    ]);
    for (const e of CATALOG_ITEMS) {
      expect(e.collidable).toBe(!nonCollidable.has(e.id));
    }
    // flat items (rugs) must never be collidable
    for (const e of CATALOG_ITEMS) {
      if (e.flat) expect(e.collidable).toBe(false);
    }
  });

  it("every entry declares a valid scaling policy", () => {
    for (const e of CATALOG_ITEMS) {
      expect(["none", "uniform", "axes"]).toContain(e.scaling.mode);
      if (e.scaling.mode === "uniform") {
        const r = e.scaling.uniform!;
        expect(r[0]).toBeGreaterThan(0);
        expect(r[1]).toBeGreaterThanOrEqual(r[0]);
      }
      if (e.scaling.mode === "axes") {
        for (const range of Object.values(e.scaling.axes ?? {})) {
          if (!range) continue;
          expect(range[0]).toBeGreaterThan(0);
          expect(range[1]).toBeGreaterThanOrEqual(range[0]);
        }
      }
    }
  });

  it("every built part references a declared slot and 3-8 primitives", () => {
    for (const e of CATALOG_ITEMS) {
      const slotNames = new Set(e.slots.map((s) => s.name));
      const parts = e.build();
      expect(parts.length).toBeGreaterThanOrEqual(1);
      expect(parts.length).toBeLessThanOrEqual(8);
      for (const p of parts) expect(slotNames.has(p.slot)).toBe(true);
    }
  });

  it("declares the expected wall-huggers", () => {
    const huggers = CATALOG_ITEMS.filter((e) => e.wallHugger).map((e) => e.id);
    expect(huggers.sort()).toEqual(
      [
        "sofa-3seat",
        "sofa-sectional",
        "sofa-2seat",
        "fireplace",
        "tv-stand",
        "bookshelf",
        "console-table",
        "bed-double",
        "bed-single",
        "wardrobe",
        "dresser",
        "mirror",
        "vanity-table",
        "crib",
        "counter",
        "upper-cabinet",
        "fridge",
        "stove",
        "dishwasher",
        "pantry-cabinet",
        "sink-vanity",
        "bathtub",
        "shower-stall",
        "towel-rack",
        "bathroom-cabinet",
        "bidet",
        "desk",
        "filing-cabinet",
        "washing-machine",
        "dryer",
      ].sort(),
    );
  });

  it("every item's category is listed in CATEGORIES, and each is non-empty", () => {
    const cats = new Set<string>(CATEGORIES);
    for (const e of CATALOG_ITEMS) expect(cats.has(e.category)).toBe(true);
    // Every advertised category has at least one item (no empty palette group).
    for (const c of CATEGORIES) {
      expect(CATALOG_ITEMS.some((e) => e.category === c)).toBe(true);
    }
  });

  it("looks up by id and exposes the primary slot", () => {
    const sofa = getCatalogEntry("sofa-3seat");
    expect(sofa?.name).toBe("3-seat sofa");
    expect(primarySlot(sofa!)).toBe("body");
    expect(getCatalogEntry("nope")).toBeUndefined();
  });
});
