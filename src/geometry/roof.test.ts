import { describe, it, expect } from "vitest";
import {
  computeRoof,
  computePolygonRoof,
  isRectilinear,
  decomposeRectilinear,
  offsetPolygon,
  triangulate,
} from "./roof";
import type { Bounds } from "./planview";
import type { Vec2 } from "../model/types";

const BBOX: Bounds = { minX: 0, minY: 0, maxX: 6, maxY: 4 };
const BASE_Y = 2.4;

describe("computeRoof", () => {
  it("flat: a real slab over the overhung bbox, underside at the eave height", () => {
    const TH = 0.2;
    const r = computeRoof(BBOX, "flat", 30, 0.5, BASE_Y, TH);
    // Top + bottom + four sides.
    expect(r.parts).toHaveLength(6);
    // The slab spans [baseY, baseY + thickness]; nothing dips below the eave.
    const ys = r.parts.flatMap((p) => p.vertices.map((v) => v[1]));
    expect(Math.min(...ys)).toBeCloseTo(BASE_Y, 6);
    expect(Math.max(...ys)).toBeCloseTo(BASE_Y + TH, 6);
    expect(r.ridgeY).toBeCloseTo(BASE_Y + TH, 6);
    // Spans bbox + overhang in X.
    const xs = r.parts.flatMap((p) => p.vertices.map((v) => v[0]));
    expect(Math.min(...xs)).toBeCloseTo(-0.5, 6);
    expect(Math.max(...xs)).toBeCloseTo(6.5, 6);
  });

  it("flat with zero thickness degenerates to a coplanar slab at the eave", () => {
    const r = computeRoof(BBOX, "flat", 30, 0, BASE_Y);
    const ys = r.parts.flatMap((p) => p.vertices.map((v) => v[1]));
    expect(ys.every((y) => Math.abs(y - BASE_Y) < 1e-9)).toBe(true);
    expect(r.ridgeY).toBeCloseTo(BASE_Y, 6);
  });

  it("gabled: two slopes + two gable ends; ridge above the eaves", () => {
    const r = computeRoof(BBOX, "gabled", 30, 0, BASE_Y);
    expect(r.parts).toHaveLength(4);
    expect(r.ridgeY).toBeGreaterThan(BASE_Y);
    // Half-span is along the shorter (depth=4) axis since width(6) >= depth(4).
    const expected = BASE_Y + 2 * Math.tan((30 * Math.PI) / 180);
    expect(r.ridgeY).toBeCloseTo(expected, 6);
  });

  it("hipped: four faces with an inset ridge", () => {
    const r = computeRoof(BBOX, "hipped", 35, 0, BASE_Y);
    expect(r.parts).toHaveLength(4);
    expect(r.ridgeY).toBeGreaterThan(BASE_Y);
    // The ridge sits along X, inset by the half-span (depth/2 = 2) from each end.
    const ridgePts = r.parts
      .flatMap((p) => p.vertices)
      .filter((v) => Math.abs(v[1] - r.ridgeY) < 1e-9);
    const xs = ridgePts.map((v) => v[0]);
    expect(Math.min(...xs)).toBeCloseTo(2, 6);
    expect(Math.max(...xs)).toBeCloseTo(4, 6);
  });

  it("pitched: a single slope rising to one eave", () => {
    const r = computeRoof(BBOX, "pitched", 20, 0, BASE_Y);
    const highY = BASE_Y + 4 * Math.tan((20 * Math.PI) / 180);
    expect(r.ridgeY).toBeCloseTo(highY, 6);
    const allY = r.parts.flatMap((p) => p.vertices.map((v) => v[1]));
    expect(Math.max(...allY)).toBeCloseTo(highY, 6);
    expect(Math.min(...allY)).toBeCloseTo(BASE_Y, 6);
  });

  it("overhang extends the eaves beyond the footprint", () => {
    const r = computeRoof(BBOX, "gabled", 30, 0.6, BASE_Y);
    const xs = r.parts.flatMap((p) => p.vertices.map((v) => v[0]));
    expect(Math.min(...xs)).toBeCloseTo(-0.6, 6);
    expect(Math.max(...xs)).toBeCloseTo(6.6, 6);
  });
});

// A 6-point L-shape (rectilinear): a 6x6 square with a 3x3 bite out of the
// bottom-right corner.
const L_SHAPE: Vec2[] = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 3 },
  { x: 3, y: 3 },
  { x: 3, y: 6 },
  { x: 0, y: 6 },
];

// A diamond (every edge at 45°) — not rectilinear.
const DIAMOND: Vec2[] = [
  { x: 3, y: 0 },
  { x: 6, y: 3 },
  { x: 3, y: 6 },
  { x: 0, y: 3 },
];

describe("isRectilinear", () => {
  it("accepts a rectangle and an L-shape", () => {
    expect(isRectilinear([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }])).toBe(true);
    expect(isRectilinear(L_SHAPE)).toBe(true);
  });
  it("rejects a diagonal-edged polygon", () => {
    expect(isRectilinear(DIAMOND)).toBe(false);
  });
});

describe("decomposeRectilinear", () => {
  it("returns one rectangle for a rectangle", () => {
    const rects = decomposeRectilinear([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ minX: 0, maxX: 4, minY: 0, maxY: 2 });
  });

  it("splits an L-shape into rectangles covering its full area", () => {
    const rects = decomposeRectilinear(L_SHAPE);
    expect(rects.length).toBeGreaterThanOrEqual(2);
    // Total area equals the L-shape area (36 - 9 = 27).
    const area = rects.reduce(
      (s, r) => s + (r.maxX - r.minX) * (r.maxY - r.minY),
      0,
    );
    expect(area).toBeCloseTo(27, 6);
  });
});

describe("triangulate", () => {
  it("triangulates an L-shape into n-2 triangles within its bounds", () => {
    const tris = triangulate(L_SHAPE);
    expect(tris).toHaveLength(L_SHAPE.length - 2);
    // No triangle reaches into the bitten-out corner (x>3 && y>3).
    for (const [a, b, c] of tris) {
      const cx = (L_SHAPE[a]!.x + L_SHAPE[b]!.x + L_SHAPE[c]!.x) / 3;
      const cy = (L_SHAPE[a]!.y + L_SHAPE[b]!.y + L_SHAPE[c]!.y) / 3;
      expect(cx <= 3 + 1e-9 || cy <= 3 + 1e-9).toBe(true);
    }
  });
});

describe("offsetPolygon", () => {
  it("expands a square outward by the offset distance", () => {
    const sq: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const out = offsetPolygon(sq, 0.5);
    const xs = out.map((p) => p.x);
    const ys = out.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-0.5, 6);
    expect(Math.max(...xs)).toBeCloseTo(4.5, 6);
    expect(Math.min(...ys)).toBeCloseTo(-0.5, 6);
    expect(Math.max(...ys)).toBeCloseTo(4.5, 6);
  });
});

describe("computePolygonRoof", () => {
  it("flat: a slab covering the polygon + overhang", () => {
    const r = computePolygonRoof(L_SHAPE, "flat", 30, 0.5, BASE_Y, 0.2);
    expect(r.parts.length).toBeGreaterThan(0);
    const ys = r.parts.flatMap((p) => p.vertices.map((v) => v[1]));
    expect(Math.min(...ys)).toBeCloseTo(BASE_Y, 6);
    expect(Math.max(...ys)).toBeCloseTo(BASE_Y + 0.2, 6);
    // Overhang pushes the outline beyond x=6.
    const xs = r.parts.flatMap((p) => p.vertices.map((v) => v[0]));
    expect(Math.max(...xs)).toBeCloseTo(6.5, 6);
  });

  it("flat & pitched cover an angled (non-rectilinear) polygon without fallback", () => {
    const flat = computePolygonRoof(DIAMOND, "flat", 30, 0, BASE_Y, 0.2);
    const pitched = computePolygonRoof(DIAMOND, "pitched", 20, 0, BASE_Y);
    // Triangulated coverage uses the polygon vertices, not a bounding box.
    expect(flat.parts.length).toBeGreaterThan(0);
    expect(pitched.parts).toHaveLength(DIAMOND.length - 2);
  });

  it("gabled on a rectilinear L-shape emits multiple decomposed pieces", () => {
    const r = computePolygonRoof(L_SHAPE, "gabled", 30, 0, BASE_Y);
    // Two rectangles × 4 parts each (two slopes + two gable ends).
    expect(r.parts.length).toBeGreaterThanOrEqual(8);
    expect(r.ridgeY).toBeGreaterThan(BASE_Y);
  });

  it("gabled on an angled polygon falls back to the bounding rectangle", () => {
    const r = computePolygonRoof(DIAMOND, "gabled", 30, 0, BASE_Y);
    // Bounding rect of the diamond is 6×6 → a single gabled roof (4 parts).
    expect(r.parts).toHaveLength(4);
    const xs = r.parts.flatMap((p) => p.vertices.map((v) => v[0]));
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(6, 6);
  });
});
