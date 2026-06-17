import { describe, it, expect } from "vitest";
import {
  CATALOG_ITEMS,
  CATEGORIES,
  getCatalogEntry,
  primarySlot,
  resolveVariantId,
  defaultVariantId,
} from "./index";

describe("catalog", () => {
  it("has 65 items with unique ids", () => {
    expect(CATALOG_ITEMS).toHaveLength(65);
    const ids = CATALOG_ITEMS.map((e) => e.id);
    expect(new Set(ids).size).toBe(65);
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
      // Phase 4d Part A: surface/decor items that rest on other furniture.
      "book-stack",
      "kettle",
      "toaster",
      "coffee-maker",
      "computer",
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

  it("outdoor items are free-standing and collidable", () => {
    const outdoor = CATALOG_ITEMS.filter((e) => e.category === "outdoor");
    expect(outdoor).toHaveLength(11);
    for (const e of outdoor) {
      expect(e.wallHugger).toBe(false); // built around the lot, not walls
      expect(e.collidable).toBe(true);
    }
  });

  it("trees and shrubs each declare three shape variants", () => {
    for (const id of ["tree", "hedge"]) {
      const e = getCatalogEntry(id)!;
      expect(e.variants).toBeDefined();
      expect(e.variants!).toHaveLength(3);
      const ids = e.variants!.map((v) => v.id);
      expect(new Set(ids).size).toBe(3);
    }
    expect(getCatalogEntry("tree")!.variants!.map((v) => v.id)).toEqual([
      "broadleaf",
      "conifer",
      "ornamental",
    ]);
    expect(getCatalogEntry("hedge")!.variants!.map((v) => v.id)).toEqual([
      "spreading",
      "rounded",
      "columnar",
    ]);
  });

  it("each variant builds a distinct, valid part list", () => {
    for (const id of ["tree", "hedge"]) {
      const e = getCatalogEntry(id)!;
      const slotNames = new Set(e.slots.map((s) => s.name));
      const signatures = new Set<string>();
      for (const v of e.variants!) {
        const parts = e.build(v.id);
        expect(parts.length).toBeGreaterThanOrEqual(1);
        expect(parts.length).toBeLessThanOrEqual(8);
        for (const p of parts) expect(slotNames.has(p.slot)).toBe(true);
        signatures.add(JSON.stringify(parts));
      }
      // All three variants differ in geometry.
      expect(signatures.size).toBe(3);
    }
  });

  it("build() with no variant matches the default variant", () => {
    for (const id of ["tree", "hedge"]) {
      const e = getCatalogEntry(id)!;
      expect(JSON.stringify(e.build())).toBe(
        JSON.stringify(e.build(defaultVariantId(e))),
      );
    }
  });

  it("resolveVariantId falls back to the default for missing/invalid ids", () => {
    const tree = getCatalogEntry("tree")!;
    expect(resolveVariantId(tree, "conifer")).toBe("conifer");
    expect(resolveVariantId(tree, "bogus")).toBe("broadleaf");
    expect(resolveVariantId(tree, undefined)).toBe("broadleaf");
    // entries without variants resolve to undefined
    const sofa = getCatalogEntry("sofa-3seat")!;
    expect(resolveVariantId(sofa, "anything")).toBeUndefined();
    expect(defaultVariantId(sofa)).toBeUndefined();
  });

  it("looks up by id and exposes the primary slot", () => {
    const sofa = getCatalogEntry("sofa-3seat");
    expect(sofa?.name).toBe("3-seat sofa");
    expect(primarySlot(sofa!)).toBe("body");
    expect(getCatalogEntry("nope")).toBeUndefined();
  });
});
