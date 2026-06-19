import { describe, it, expect } from "vitest";
import { roofLocalBounds, roofFootprint } from "./roofPlacement";
import { pointInFootprint } from "./furniture";

describe("roofLocalBounds", () => {
  it("centers the rectangle on the origin", () => {
    expect(roofLocalBounds({ width: 4, depth: 6 })).toEqual({
      minX: -2,
      maxX: 2,
      minY: -3,
      maxY: 3,
    });
  });
});

describe("roofFootprint + hit-test", () => {
  it("matches the drawn rectangle (overhang excluded)", () => {
    expect(roofFootprint({ width: 4, depth: 2 })).toEqual({
      width: 4,
      depth: 2,
    });
  });

  it("hit-tests an axis-aligned roof footprint at its center", () => {
    const fp = roofFootprint({ width: 4, depth: 2 });
    const center = { x: 5, y: 5 };
    expect(pointInFootprint(center, center, 0, fp)).toBe(true);
    // Just outside the half-width is a miss.
    expect(pointInFootprint({ x: 7.1, y: 5 }, center, 0, fp)).toBe(false);
  });

  it("respects rotation when hit-testing", () => {
    const fp = roofFootprint({ width: 4, depth: 1 });
    const center = { x: 0, y: 0 };
    // Rotated 90°, the long axis runs along Y, so a point 1.5 m up is now inside.
    expect(pointInFootprint({ x: 0, y: 1.5 }, center, 90, fp)).toBe(true);
    expect(pointInFootprint({ x: 1.5, y: 0 }, center, 90, fp)).toBe(false);
  });
});
