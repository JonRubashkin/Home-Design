import { describe, it, expect } from "vitest";
import { clampScale, effectiveDimensions } from "./scale";
import { getCatalogEntry } from "./index";
import type { CatalogScaling } from "./types";

describe("clampScale", () => {
  it("forces unit scale for mode none", () => {
    const s: CatalogScaling = { mode: "none" };
    expect(clampScale(s, { x: 3, y: 0.2, z: 5 })).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("keeps uniform axes equal and clamps to range", () => {
    const s: CatalogScaling = { mode: "uniform", uniform: [0.85, 1.2] };
    expect(clampScale(s, { x: 1.5, y: 1.5, z: 1.5 })).toEqual({
      x: 1.2,
      y: 1.2,
      z: 1.2,
    });
    expect(clampScale(s, { x: 0.5, y: 0.5, z: 0.5 })).toEqual({
      x: 0.85,
      y: 0.85,
      z: 0.85,
    });
  });

  it("clamps free axes and locks omitted axes for mode axes", () => {
    const s: CatalogScaling = {
      mode: "axes",
      axes: { x: [0.5, 2.5], z: [0.5, 2.5] }, // y locked
    };
    expect(clampScale(s, { x: 3, y: 2, z: 0.3 })).toEqual({
      x: 2.5,
      y: 1,
      z: 0.5,
    });
  });

  it("locks every axis when axes is empty", () => {
    expect(clampScale({ mode: "axes", axes: {} }, { x: 2, y: 2, z: 2 })).toEqual(
      { x: 1, y: 1, z: 1 },
    );
  });
});

describe("effectiveDimensions", () => {
  it("multiplies footprint/height by scale (x=width, z=depth, y=height)", () => {
    const rug = getCatalogEntry("rug")!;
    const d = effectiveDimensions(rug, { x: 2, y: 1, z: 0.5 });
    expect(d.width).toBeCloseTo(rug.footprint.width * 2);
    expect(d.depth).toBeCloseTo(rug.footprint.depth * 0.5);
    expect(d.height).toBeCloseTo(rug.height * 1);
  });
});
