import { describe, it, expect } from "vitest";
import { computeRoof } from "./roof";
import type { Bounds } from "./planview";

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
