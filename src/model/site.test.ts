import { describe, it, expect } from "vitest";
import {
  areaToSquare,
  clampSide,
  roundToTenth,
  SITE_MIN,
  SITE_MAX,
} from "./site";

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

describe("roundToTenth", () => {
  it("rounds preset and custom sizes to a single decimal", () => {
    // sqrt(300) and sqrt(1000) round cleanly to 0.1 m
    expect(roundToTenth(areaToSquare(300).width)).toBe(17.3);
    expect(roundToTenth(areaToSquare(1000).width)).toBe(31.6);
    expect(roundToTenth(10)).toBe(10);
    expect(roundToTenth(17.35)).toBe(17.4);
    expect(roundToTenth(17.34)).toBe(17.3);
  });
});
