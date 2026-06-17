import { describe, it, expect } from "vitest";
import {
  rotateVec,
  pointInFootprint,
  footprintCorners,
  wallHuggerSnap,
  computeStackBaseLifts,
  footprintsOverlap,
  verticalExtentsOverlap,
  fitsUnder,
  collidableItemsCollide,
  collidingIds,
  collidingMovableIds,
  wallFootprint,
  type Footprint,
  type StackItem,
  type OrientedFootprint,
  type CollisionItem,
} from "./furniture";
import { createWall } from "../model/defaults";
import type { Wall } from "../model/types";

const fp: Footprint = { width: 2, depth: 1 };
const close = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

describe("pointInFootprint", () => {
  it("hits inside an axis-aligned footprint", () => {
    expect(pointInFootprint({ x: 0.5, y: 0.4 }, { x: 0, y: 0 }, 0, fp)).toBe(
      true,
    );
    expect(pointInFootprint({ x: 1.1, y: 0 }, { x: 0, y: 0 }, 0, fp)).toBe(
      false,
    );
  });

  it("respects rotation", () => {
    // Rotated 90°: width axis now along y. A point at (0, 0.9) is inside the
    // rotated 2x1 box (half-width 1 along y) but would be outside unrotated.
    expect(pointInFootprint({ x: 0, y: 0.9 }, { x: 0, y: 0 }, 90, fp)).toBe(
      true,
    );
    expect(pointInFootprint({ x: 0.9, y: 0 }, { x: 0, y: 0 }, 90, fp)).toBe(
      false,
    );
  });

  it("respects translation", () => {
    expect(pointInFootprint({ x: 5, y: 5 }, { x: 5, y: 5 }, 0, fp)).toBe(true);
    expect(pointInFootprint({ x: 0, y: 0 }, { x: 5, y: 5 }, 0, fp)).toBe(false);
  });
});

describe("footprintCorners", () => {
  it("returns the four corners of an axis-aligned footprint", () => {
    const c = footprintCorners({ x: 0, y: 0 }, 0, fp);
    expect(c).toContainEqual({ x: -1, y: -0.5 });
    expect(c).toContainEqual({ x: 1, y: 0.5 });
  });
});

describe("rotateVec", () => {
  it("rotates +90° clockwise in y-down space", () => {
    const r = rotateVec({ x: 1, y: 0 }, 90);
    expect(close(r.x, 0)).toBe(true);
    expect(close(r.y, 1)).toBe(true);
  });
});

describe("wallHuggerSnap", () => {
  // A horizontal wall along +x at y=0, thickness 0.15 (face at y = ±0.075).
  const hWall: Wall = createWall({ x: 0, y: 0 }, { x: 6, y: 0 });
  const sofa: Footprint = { width: 2, depth: 0.9 };

  it("snaps the back edge flush and aligns rotation when near a wall", () => {
    // Item below the wall (side B), back edge ~0.1 m from the face.
    const r = wallHuggerSnap({ x: 3, y: 0.62 }, 0, sofa, [hWall]);
    expect(r.snapped).toBe(true);
    // back edge flush: center should sit at faceOffset + depth/2 = 0.075 + 0.45
    expect(close(r.position.y, 0.525, 1e-6)).toBe(true);
    expect(close(r.position.x, 3)).toBe(true); // slides only perpendicular
    // item sits above the wall, so its front (+y local) faces away (up): rot 0
    expect(close(r.rotation, 0, 1e-6)).toBe(true);
  });

  it("releases (no snap) when farther than the threshold", () => {
    const r = wallHuggerSnap({ x: 3, y: 2.0 }, 30, sofa, [hWall]);
    expect(r.snapped).toBe(false);
    expect(r.rotation).toBe(30);
  });

  it("does not snap when the item is past the wall's ends", () => {
    const r = wallHuggerSnap({ x: 9, y: 0.5 }, 0, sofa, [hWall]);
    expect(r.snapped).toBe(false);
  });

  it("snaps and aligns against a 45° wall", () => {
    const diag: Wall = createWall({ x: 0, y: 0 }, { x: 4, y: 4 });
    // Point just off the diagonal on the +normal side. normal = (1,-1)/√2.
    const off = 0.075 + 0.45 + 0.05; // faceOffset + depth/2 + small gap
    const nx = 1 / Math.SQRT2;
    const ny = -1 / Math.SQRT2;
    const r = wallHuggerSnap({ x: 2 + nx * off, y: 2 + ny * off }, 0, sofa, [
      diag,
    ]);
    expect(r.snapped).toBe(true);
    // Back edge flush: perpendicular distance from centerline == faceOffset+depth/2
    const s = (r.position.x - 0) * nx + (r.position.y - 0) * ny;
    expect(close(Math.abs(s), 0.075 + 0.45, 1e-6)).toBe(true);
    // Front faces into the room (along +normal). front = R(rot)*(0,1).
    const rad = (r.rotation * Math.PI) / 180;
    const frontX = -Math.sin(rad);
    const frontY = Math.cos(rad);
    expect(close(frontX, nx, 1e-6)).toBe(true);
    expect(close(frontY, ny, 1e-6)).toBe(true);
  });
});

describe("computeStackBaseLifts", () => {
  const lifts = { floor: 0.018, flat: 0.012, stack: 0.002 };
  const surface = (
    id: string,
    center: { x: number; y: number },
    surfaceTop: number,
    extra: Partial<StackItem> = {},
  ): StackItem => ({
    id,
    center,
    rotation: 0,
    footprint: { width: 1.2, depth: 0.6 },
    flat: false,
    stackable: false,
    surfaceTop,
    ...extra,
  });
  const small = (
    id: string,
    center: { x: number; y: number },
    extra: Partial<StackItem> = {},
  ): StackItem => ({
    id,
    center,
    rotation: 0,
    footprint: { width: 0.5, depth: 0.35 },
    flat: false,
    stackable: true,
    surfaceTop: null,
    ...extra,
  });

  it("rests a stackable item on a surface it is centered over", () => {
    const counter = surface("counter", { x: 0, y: 0 }, 0.9);
    const micro = small("micro", { x: 0.2, y: 0 }); // center inside counter
    const m = computeStackBaseLifts([counter, micro], lifts);
    expect(m.get("counter")).toBe(0.018); // counter on the floor
    // micro base = counter floor lift + surfaceTop + stack lift
    expect(m.get("micro")).toBeCloseTo(0.018 + 0.9 + 0.002);
  });

  it("keeps a stackable item on the floor when off the surface", () => {
    const counter = surface("counter", { x: 0, y: 0 }, 0.9);
    const micro = small("micro", { x: 5, y: 5 }); // far away
    const m = computeStackBaseLifts([counter, micro], lifts);
    expect(m.get("micro")).toBe(0.018);
  });

  it("does not lift a non-stackable item sitting over a surface", () => {
    const counter = surface("counter", { x: 0, y: 0 }, 0.9);
    const chair = small("chair", { x: 0, y: 0 }, { stackable: false });
    const m = computeStackBaseLifts([counter, chair], lifts);
    expect(m.get("chair")).toBe(0.018);
  });

  it("uses the flat lift for rugs resting on the floor", () => {
    const rug = small("rug", { x: 0, y: 0 }, { stackable: false, flat: true });
    const m = computeStackBaseLifts([rug], lifts);
    expect(m.get("rug")).toBe(0.012);
  });

  it("stacks transitively (item on a surface on a surface)", () => {
    const counter = surface("counter", { x: 0, y: 0 }, 0.9);
    // a tray that is both stackable and itself a surface, centered on counter
    const tray = surface("tray", { x: 0, y: 0 }, 0.05, { stackable: true });
    const micro = small("micro", { x: 0, y: 0 });
    const m = computeStackBaseLifts([counter, tray, micro], lifts);
    expect(m.get("tray")).toBeCloseTo(0.018 + 0.9 + 0.002);
    // micro sits on the tray's top = tray base + tray surfaceTop + stack lift
    expect(m.get("micro")).toBeCloseTo(0.018 + 0.9 + 0.002 + 0.05 + 0.002);
  });

  it("does not loop on a mutual-overlap cycle", () => {
    // two items that are each stackable surfaces centered on each other
    const a = surface("a", { x: 0, y: 0 }, 0.3, { stackable: true });
    const b = surface("b", { x: 0, y: 0 }, 0.3, { stackable: true });
    const m = computeStackBaseLifts([a, b], lifts);
    // terminates and yields finite numbers
    expect(Number.isFinite(m.get("a")!)).toBe(true);
    expect(Number.isFinite(m.get("b")!)).toBe(true);
  });
});

describe("footprintsOverlap (SAT)", () => {
  const of = (
    x: number,
    y: number,
    rotation: number,
    w: number,
    d: number,
  ): OrientedFootprint => ({
    center: { x, y },
    rotation,
    footprint: { width: w, depth: d },
  });

  it("detects overlapping axis-aligned rectangles", () => {
    expect(footprintsOverlap(of(0, 0, 0, 2, 2), of(1, 0, 0, 2, 2))).toBe(true);
  });

  it("reports no overlap when clearly apart", () => {
    expect(footprintsOverlap(of(0, 0, 0, 2, 2), of(5, 0, 0, 2, 2))).toBe(false);
  });

  it("treats a tiny sub-tolerance overlap as no collision", () => {
    // centers 2.0 apart, widths 2 -> exactly touching; 0.01 into each other < tol
    expect(footprintsOverlap(of(0, 0, 0, 2, 2), of(1.995, 0, 0, 2, 2))).toBe(
      false,
    );
  });

  it("is correct for rotated footprints", () => {
    // a thin bar rotated 45° reaches into a neighbor an AABB test would miss/hit
    const a = of(0, 0, 45, 3, 0.4);
    const b = of(1.2, 1.2, 0, 0.6, 0.6);
    expect(footprintsOverlap(a, b)).toBe(true);
    const far = of(3, 3, 0, 0.6, 0.6);
    expect(footprintsOverlap(a, far)).toBe(false);
  });

  it("accounts for scaled footprints (bigger rectangle reaches further)", () => {
    expect(footprintsOverlap(of(0, 0, 0, 1, 1), of(1.4, 0, 0, 1, 1))).toBe(
      false,
    );
    expect(footprintsOverlap(of(0, 0, 0, 2, 1), of(1.4, 0, 0, 1, 1))).toBe(true);
  });
});

describe("collidingIds", () => {
  const item = (
    id: string,
    x: number,
    collidable: boolean,
  ): CollisionItem => ({
    id,
    collidable,
    footprint: { center: { x, y: 0 }, rotation: 0, footprint: { width: 2, depth: 2 } },
  });

  it("flags both members of an overlapping collidable pair", () => {
    const ids = collidingIds([item("a", 0, true), item("b", 1, true)]);
    expect(ids).toEqual(new Set(["a", "b"]));
  });

  it("never collides non-collidable items", () => {
    const ids = collidingIds([item("a", 0, true), item("rug", 0, false)]);
    expect(ids.size).toBe(0);
  });

  it("ignores well-separated items", () => {
    const ids = collidingIds([item("a", 0, true), item("b", 5, true)]);
    expect(ids.size).toBe(0);
  });
});

describe("wallFootprint + collidingMovableIds (furniture vs walls)", () => {
  const movable = (
    id: string,
    x: number,
    y: number,
    w = 2,
    d = 1,
  ): CollisionItem => ({
    id,
    collidable: true,
    footprint: { center: { x, y }, rotation: 0, footprint: { width: w, depth: d } },
  });

  it("wallFootprint is length × thickness, centered, rotated to the wall", () => {
    const h = wallFootprint(createWall({ x: 0, y: 0 }, { x: 4, y: 0 }));
    expect(h.center).toEqual({ x: 2, y: 0 });
    expect(h.rotation).toBeCloseTo(0);
    expect(h.footprint.width).toBeCloseTo(4);
    expect(h.footprint.depth).toBeCloseTo(0.15);
    const v = wallFootprint(createWall({ x: 0, y: 0 }, { x: 0, y: 3 }));
    expect(v.rotation).toBeCloseTo(90);
    expect(v.footprint.width).toBeCloseTo(3);
  });

  it("flags a movable item that overlaps a wall but not one flush against it", () => {
    const wall = wallFootprint(createWall({ x: 0, y: 0 }, { x: 10, y: 0 }));
    // sofa centered ON the wall line -> overlaps deeply
    const through = collidingMovableIds([movable("sofa", 5, 0)], [wall]);
    expect(through.has("sofa")).toBe(true);
    // sofa resting just below the wall face (flush, depth 1 -> center at 0.5+~) — clear
    const flush = collidingMovableIds([movable("sofa", 5, 0.6)], [wall]);
    expect(flush.has("sofa")).toBe(false);
  });

  it("still flags movable-vs-movable overlaps and ignores non-collidable", () => {
    const a = movable("a", 0, 0);
    const b = movable("b", 1, 0);
    const ids = collidingMovableIds([a, b], []);
    expect(ids).toEqual(new Set(["a", "b"]));
    const rug = { ...movable("rug", 0, 0), collidable: false };
    expect(collidingMovableIds([a, rug], []).has("rug")).toBe(false);
  });
});

// --- Height-aware collision (Phase 4d Part C) ---
const item = (
  id: string,
  center: { x: number; y: number },
  w: number,
  d: number,
  opts: {
    height: number;
    base?: number;
    legClearance?: number;
    tuckHeight?: number;
    collidable?: boolean;
  },
): CollisionItem => ({
  id,
  collidable: opts.collidable ?? true,
  footprint: { center, rotation: 0, footprint: { width: w, depth: d } },
  vertical: { base: opts.base ?? 0, height: opts.height },
  tuck: { legClearance: opts.legClearance, tuckHeight: opts.tuckHeight },
});

describe("verticalExtentsOverlap", () => {
  it("detects overlap and separation of [base, base+height] ranges", () => {
    expect(
      verticalExtentsOverlap({ base: 0, height: 1 }, { base: 0.5, height: 1 }),
    ).toBe(true);
    expect(
      verticalExtentsOverlap({ base: 0, height: 0.4 }, { base: 0.5, height: 1 }),
    ).toBe(false);
  });
});

describe("fitsUnder", () => {
  it("true only when leg clearance exists and tuck height fits", () => {
    expect(fitsUnder({ tuckHeight: 0.45 }, { legClearance: 0.68 })).toBe(true);
    expect(fitsUnder({ tuckHeight: 0.8 }, { legClearance: 0.68 })).toBe(false);
    expect(fitsUnder({ tuckHeight: 0.45 }, { tuckHeight: 0.9 })).toBe(false); // no clearance
  });
});

describe("collidableItemsCollide (tuck-under + vertical extents)", () => {
  const table = () =>
    item("table", { x: 0, y: 0 }, 1.4, 0.8, {
      height: 0.75,
      legClearance: 0.68,
      tuckHeight: 0.75,
    });
  const chair = (id = "chair", center = { x: 0, y: 0 }) =>
    item(id, center, 0.45, 0.45, { height: 0.9, tuckHeight: 0.45 });

  it("a chair tucks under a table (no collision despite footprint overlap)", () => {
    expect(collidableItemsCollide(chair(), table())).toBe(false);
  });

  it("two overlapping chairs still collide", () => {
    expect(collidableItemsCollide(chair("a"), chair("b"))).toBe(true);
  });

  it("a chair vs a tall wardrobe still collides", () => {
    const wardrobe = item("ward", { x: 0, y: 0 }, 1.2, 0.6, { height: 2.0 });
    expect(collidableItemsCollide(chair(), wardrobe)).toBe(true);
  });

  it("items at clearly different heights (overlapping footprints) don't collide", () => {
    const low = item("low", { x: 0, y: 0 }, 1, 1, { height: 0.3 });
    const high = item("high", { x: 0, y: 0 }, 1, 1, { height: 1.0, base: 0.5 });
    expect(collidableItemsCollide(low, high)).toBe(false);
  });

  it("a too-tall stool does NOT fit under a low coffee table", () => {
    const coffee = item("coffee", { x: 0, y: 0 }, 1.1, 0.6, {
      height: 0.4,
      legClearance: 0.34,
      tuckHeight: 0.4,
    });
    const stool = item("stool", { x: 0, y: 0 }, 0.4, 0.4, {
      height: 0.75,
      tuckHeight: 0.72,
    });
    expect(collidableItemsCollide(stool, coffee)).toBe(true);
  });
});

describe("collidingIds / collidingMovableIds with tuck-under", () => {
  it("collidingIds excludes a tucked chair-table pair", () => {
    const table = item("table", { x: 0, y: 0 }, 1.4, 0.8, {
      height: 0.75,
      legClearance: 0.68,
      tuckHeight: 0.75,
    });
    const chair = item("chair", { x: 0, y: 0 }, 0.45, 0.45, {
      height: 0.9,
      tuckHeight: 0.45,
    });
    expect(collidingIds([table, chair]).size).toBe(0);
    // two chairs still collide
    const chair2 = item("chair2", { x: 0, y: 0 }, 0.45, 0.45, {
      height: 0.9,
      tuckHeight: 0.45,
    });
    expect(collidingIds([chair, chair2])).toEqual(new Set(["chair", "chair2"]));
  });

  it("a wall barrier never allows tuck-under (chair vs wall collides)", () => {
    const wall = createWall({ x: -1, y: 0 }, { x: 1, y: 0 });
    wall.thickness = 0.6;
    const chair = item("chair", { x: 0, y: 0 }, 0.45, 0.45, {
      height: 0.9,
      tuckHeight: 0.45,
    });
    expect(collidingMovableIds([chair], [wallFootprint(wall)])).toEqual(
      new Set(["chair"]),
    );
  });
});
