import { describe, it, expect } from "vitest";
import {
  roofLocalBounds,
  roofFootprint,
  roofContainsPoint,
} from "./roofPlacement";
import { pointInFootprint } from "./furniture";
import type { Roof } from "../model/types";

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

describe("roofContainsPoint", () => {
  const base = {
    type: "gabled" as const,
    pitch: 30,
    overhang: 0.4,
    visible: true,
    material: { kind: "solid" as const, color: "#8a5a44" },
  };

  it("uses the rotated rectangle for a rect roof", () => {
    const roof: Roof = {
      id: "r",
      shape: "rect",
      position: { x: 5, y: 5 },
      width: 4,
      depth: 2,
      rotation: 0,
      ...base,
    };
    expect(roofContainsPoint(roof, { x: 5, y: 5 })).toBe(true);
    expect(roofContainsPoint(roof, { x: 8, y: 5 })).toBe(false);
  });

  it("uses the footprint outline for a polygon roof", () => {
    // An L-shape: point inside the arm, point in the bitten-out corner is out.
    const roof: Roof = {
      id: "r",
      shape: "polygon",
      position: { x: 2, y: 2 },
      width: 0,
      depth: 0,
      rotation: 0,
      footprint: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 6 },
        { x: 0, y: 6 },
      ],
      ...base,
    };
    expect(roofContainsPoint(roof, { x: 1, y: 1 })).toBe(true);
    expect(roofContainsPoint(roof, { x: 5, y: 5 })).toBe(false); // bitten corner
  });
});
