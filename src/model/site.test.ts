import { describe, it, expect } from "vitest";
import { areaToSquare, clampSide, SITE_MIN, SITE_MAX } from "./site";

describe("areaToSquare", () => {
  it("maps the presets to their documented dimensions", () => {
    expect(areaToSquare(100)).toEqual({ width: 10, depth: 10 });
    const med = areaToSquare(300);
    expect(med.width).toBeCloseTo(17.3205, 3);
    expect(med.depth).toBeCloseTo(17.3205, 3);
    const large = areaToSquare(1000);
    expect(large.width).toBeCloseTo(31.6228, 3);
    // area round-trips
    expect(large.width * large.depth).toBeCloseTo(1000);
  });

  it("guards against negative area", () => {
    expect(areaToSquare(-5)).toEqual({ width: 0, depth: 0 });
  });
});

describe("clampSide", () => {
  it("clamps to the allowed range and handles junk", () => {
    expect(clampSide(1)).toBe(SITE_MIN);
    expect(clampSide(500)).toBe(SITE_MAX);
    expect(clampSide(20)).toBe(20);
    expect(clampSide(NaN)).toBe(SITE_MIN);
  });
});
