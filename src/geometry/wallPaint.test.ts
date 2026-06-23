import { describe, it, expect } from "vitest";
import type { MaterialRef } from "../model/types";
import { createWall } from "../model/defaults";
import {
  facePaintSpans,
  applyPaintSpan,
  paintMaterialAtT,
  wallSidePaintRegions,
  wallSplitTs,
  bracketSpan,
} from "./wallPaint";

const RED: MaterialRef = { kind: "solid", color: "#ff0000" };
const BLUE: MaterialRef = { kind: "solid", color: "#0000ff" };
const DEF: MaterialRef = { kind: "solid", color: "#e8e4dc" };

describe("facePaintSpans", () => {
  it("treats a plain material as one full-width span", () => {
    expect(facePaintSpans(RED)).toEqual([{ from: 0, to: 1, material: RED }]);
  });

  it("sorts and clamps a span list", () => {
    const spans = facePaintSpans([
      { from: 0.5, to: 1, material: BLUE },
      { from: 0, to: 0.5, material: RED },
    ]);
    expect(spans[0]!.material).toBe(RED);
    expect(spans[1]!.material).toBe(BLUE);
  });
});

describe("applyPaintSpan", () => {
  it("paints a sub-segment, splitting the side into spans", () => {
    const result = applyPaintSpan(DEF, 0, 0.5, RED);
    expect(Array.isArray(result)).toBe(true);
    expect(paintMaterialAtT(result, 0.25)).toEqual(RED);
    expect(paintMaterialAtT(result, 0.75)).toEqual(DEF);
  });

  it("collapses back to a single material when the whole side is recolored", () => {
    const half = applyPaintSpan(DEF, 0, 0.5, RED);
    const whole = applyPaintSpan(half, 0, 1, RED);
    expect(whole).toEqual(RED);
  });

  it("merges adjacent equal-material spans", () => {
    let p = applyPaintSpan(DEF, 0, 0.3, RED);
    p = applyPaintSpan(p, 0.3, 0.6, RED);
    // [0,0.6] red, [0.6,1] default → two spans, not three.
    expect(facePaintSpans(p)).toHaveLength(2);
  });

  it("overwrites an existing span in the painted range", () => {
    let p = applyPaintSpan(DEF, 0, 0.5, RED);
    p = applyPaintSpan(p, 0.25, 0.75, BLUE);
    expect(paintMaterialAtT(p, 0.1)).toEqual(RED);
    expect(paintMaterialAtT(p, 0.5)).toEqual(BLUE);
    expect(paintMaterialAtT(p, 0.9)).toEqual(DEF);
  });
});

describe("wallSidePaintRegions", () => {
  it("converts spans to along-wall meter ranges", () => {
    const w = createWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    w.paintA = applyPaintSpan(DEF, 0, 0.5, RED);
    const regions = wallSidePaintRegions(w, "A");
    expect(regions[0]).toMatchObject({ a: 0, b: 2, material: RED });
    expect(regions[1]).toMatchObject({ a: 2, b: 4, material: DEF });
  });
});

describe("wallSplitTs / bracketSpan", () => {
  it("finds the junction where another wall meets the face partway", () => {
    const a = createWall({ x: 0, y: 0 }, { x: 6, y: 0 });
    const b = createWall({ x: 3, y: 0 }, { x: 3, y: 4 }); // meets a at t=0.5
    expect(wallSplitTs(a, [b])).toEqual([0.5]);
  });

  it("ignores walls that meet only at the ends", () => {
    const a = createWall({ x: 0, y: 0 }, { x: 6, y: 0 });
    const b = createWall({ x: 6, y: 0 }, { x: 6, y: 4 }); // corner at t=1
    expect(wallSplitTs(a, [b])).toEqual([]);
  });

  it("brackets a click between the nearest junctions", () => {
    const a = createWall({ x: 0, y: 0 }, { x: 6, y: 0 });
    const b = createWall({ x: 3, y: 0 }, { x: 3, y: 4 });
    expect(bracketSpan(a, [b], 0.25)).toEqual({ from: 0, to: 0.5 });
    expect(bracketSpan(a, [b], 0.75)).toEqual({ from: 0.5, to: 1 });
  });
});
