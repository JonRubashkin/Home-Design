import { describe, it, expect } from "vitest";
import {
  boundsOfPoints,
  unionBounds,
  siteBounds,
  fitView,
} from "./planview";

describe("bounds helpers", () => {
  it("boundsOfPoints covers all points (or null when empty)", () => {
    expect(boundsOfPoints([])).toBeNull();
    expect(
      boundsOfPoints([
        { x: 1, y: 2 },
        { x: -3, y: 5 },
        { x: 4, y: -1 },
      ]),
    ).toEqual({ minX: -3, minY: -1, maxX: 4, maxY: 5 });
  });

  it("unionBounds merges, tolerating nulls", () => {
    const a = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    const b = { minX: 1, minY: -1, maxX: 5, maxY: 1 };
    expect(unionBounds(a, null)).toBe(a);
    expect(unionBounds(null, b)).toBe(b);
    expect(unionBounds(a, b)).toEqual({ minX: 0, minY: -1, maxX: 5, maxY: 2 });
    expect(unionBounds(null, null)).toBeNull();
  });

  it("siteBounds is the rectangle from the origin corner", () => {
    expect(siteBounds({ width: 10, depth: 8 })).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 8,
    });
  });
});

describe("fitView", () => {
  const size = { width: 800, height: 600 };

  it("centers the bounds in the viewport", () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, size);
    // center of a [0,10] square is (5,5); it should land at the viewport center
    expect(5 * v.scale + v.pan.x).toBeCloseTo(size.width / 2);
    expect(5 * v.scale + v.pan.y).toBeCloseTo(size.height / 2);
  });

  it("fits with a margin so content isn't flush to the edge", () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, size, {
      margin: 0.1,
    });
    // limiting dimension is height (600): 10 m * scale <= 600 * (1 - 0.2)
    expect(10 * v.scale).toBeLessThanOrEqual(600 * 0.8 + 1e-6);
  });

  it("clamps scale to the allowed range for a huge bounds", () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 100000, maxY: 100000 }, size, {
      minScale: 4,
      maxScale: 600,
    });
    expect(v.scale).toBe(4);
  });
});
