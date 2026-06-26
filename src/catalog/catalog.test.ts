import { describe, it, expect } from "vitest";
import {
  CATALOG_ITEMS,
  CATEGORIES,
  getCatalogEntry,
  primarySlot,
  resolveVariantId,
  defaultVariantId,
} from "./index";
import { collisionExtent, UNIT_SCALE } from "./scale";
import {
  collidableItemsCollide,
  collidingIds,
  type CollisionItem,
} from "../geometry/furniture";

describe("catalog", () => {
  it("has 74 items with unique ids", () => {
    expect(CATALOG_ITEMS).toHaveLength(74);
    const ids = CATALOG_ITEMS.map((e) => e.id);
    expect(new Set(ids).size).toBe(74);
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
      // Phase 4d Part B: wall-mounted items (never floor-collide).
      "wall-art",
      "wall-tv",
      "floating-shelf",
      "wall-sconce",
      "wall-mirror",
      "range-hood",
      // Phase 5f: ceiling lights (never floor-collide).
      "pendant-light",
      "flush-light",
      "chandelier",
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

  it("every built part references a declared slot and 1-12 primitives", () => {
    for (const e of CATALOG_ITEMS) {
      const slotNames = new Set(e.slots.map((s) => s.name));
      const parts = e.build();
      expect(parts.length).toBeGreaterThanOrEqual(1);
      expect(parts.length).toBeLessThanOrEqual(12);
      for (const p of parts) expect(slotNames.has(p.slot)).toBe(true);
    }
  });

  it("ceiling lights declare mount:ceiling, a default drop, and are non-collidable", () => {
    const ceilingIds = ["pendant-light", "flush-light", "chandelier"];
    for (const id of ceilingIds) {
      const e = getCatalogEntry(id)!;
      expect(e.mount).toBe("ceiling");
      expect(typeof e.defaultDrop).toBe("number");
      expect(e.defaultDrop!).toBeGreaterThanOrEqual(0);
      expect(e.collidable).toBe(false);
      expect(e.wallHugger).toBe(false);
    }
  });

  describe("elevation-aware collision (Part B)", () => {
    // Build a collision item from a real catalog entry at a plan position, the
    // same way the store / plan editor / 3D preview do (footprint + vertical
    // extent from collisionExtent + tuck info). Two items at the same x/y have
    // fully overlapping footprints, so only the vertical extent separates them.
    const collisionItemFor = (
      id: string,
      center = { x: 0, y: 0 },
      forceBase?: number,
    ): CollisionItem => {
      const entry = getCatalogEntry(id)!;
      const ext = collisionExtent(entry, UNIT_SCALE);
      return {
        id,
        collidable: entry.collidable,
        footprint: {
          center,
          rotation: 0,
          footprint: { width: entry.footprint.width, depth: entry.footprint.depth },
        },
        vertical: { base: forceBase ?? ext.base, height: ext.height },
        tuck: { legClearance: ext.legClearance, tuckHeight: ext.tuckHeight },
      };
    };

    it("the upper cabinet declares a mounted base above the floor", () => {
      const ext = collisionExtent(getCatalogEntry("upper-cabinet")!, UNIT_SCALE);
      expect(ext.base).toBeGreaterThan(1); // hangs above counter height
      // counter (a floor item) reports base 0
      expect(collisionExtent(getCatalogEntry("counter")!, UNIT_SCALE).base).toBe(0);
    });

    it("an upper cabinet directly over a counter does NOT collide (clear above)", () => {
      const cabinet = collisionItemFor("upper-cabinet");
      const counter = collisionItemFor("counter");
      // Footprints fully overlap but vertical extents are clear.
      expect(collidableItemsCollide(cabinet, counter)).toBe(false);
    });

    it("the same cabinet forced down to the floor DOES collide (guard not vacuous)", () => {
      const cabinetAtFloor = collisionItemFor("upper-cabinet", { x: 0, y: 0 }, 0);
      const counter = collisionItemFor("counter");
      expect(collidableItemsCollide(cabinetAtFloor, counter)).toBe(true);
    });

    it("two overlapping floor cabinets (counter + fridge) still collide", () => {
      const counter = collisionItemFor("counter");
      const fridge = collisionItemFor("fridge");
      expect(collidableItemsCollide(counter, fridge)).toBe(true);
    });

    it("mount:wall / mount:ceiling items are excluded from collision (non-collidable)", () => {
      const wallCeilingIds = [
        "wall-art",
        "wall-tv",
        "floating-shelf",
        "wall-sconce",
        "wall-mirror",
        "range-hood",
        "pendant-light",
        "flush-light",
        "chandelier",
      ];
      for (const id of wallCeilingIds) {
        const entry = getCatalogEntry(id)!;
        expect(entry.collidable).toBe(false);
        // Even with a fully overlapping footprint against a bulky floor item,
        // collidingIds (which only pairs collidable items) excludes it.
        const mounted = collisionItemFor(id);
        const counter = collisionItemFor("counter");
        expect(collidingIds([mounted, counter]).has(id)).toBe(false);
      }
    });
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

  it("wall-mounted items declare mount:wall, a default height, and are non-collidable", () => {
    const wallIds = [
      "wall-art",
      "wall-tv",
      "floating-shelf",
      "wall-sconce",
      "wall-mirror",
      "range-hood",
    ];
    for (const id of wallIds) {
      const e = getCatalogEntry(id)!;
      expect(e.mount).toBe("wall");
      expect(typeof e.defaultMountHeight).toBe("number");
      expect(e.defaultMountHeight!).toBeGreaterThan(0);
      expect(e.collidable).toBe(false);
      expect(e.wallHugger).toBe(false);
    }
    // Floor items default to no explicit mount (or "floor").
    expect(getCatalogEntry("sofa-3seat")!.mount ?? "floor").toBe("floor");
  });

  it("looks up by id and exposes the primary slot", () => {
    const sofa = getCatalogEntry("sofa-3seat");
    expect(sofa?.name).toBe("3-seat sofa");
    expect(primarySlot(sofa!)).toBe("body");
    expect(getCatalogEntry("nope")).toBeUndefined();
  });
});
