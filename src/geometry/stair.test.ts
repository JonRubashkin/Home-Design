import { describe, it, expect } from "vitest";
import { computeStair } from "./stair";
import {
  STAIR_RISER_TARGET,
  STAIR_TREAD_DEPTH,
  FLOOR_SLAB_THICKNESS,
  DEFAULT_WALL_HEIGHT,
} from "../model/defaults";

const stair = { position: { x: 0, y: 0 }, rotation: 0, width: 1 };

describe("computeStair", () => {
  it("fits steps to the storey height (count, riser, run)", () => {
    const storey = DEFAULT_WALL_HEIGHT + FLOOR_SLAB_THICKNESS; // 2.6
    const g = computeStair(stair, storey);
    expect(g.steps).toBe(Math.round(storey / STAIR_RISER_TARGET));
    expect(g.riser).toBeCloseTo(storey / g.steps);
    expect(g.riser * g.steps).toBeCloseTo(storey); // risers exactly span the storey
    expect(g.runLength).toBeCloseTo(g.steps * STAIR_TREAD_DEPTH);
  });

  it("footprint is width × runLength centered on the position (rot 0)", () => {
    const g = computeStair(stair, 2.6);
    const xs = g.footprint.map((p) => p.x);
    const ys = g.footprint.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1); // width
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(g.runLength);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0);
  });

  it("rotates the footprint (90° swaps the extents)", () => {
    const g = computeStair({ ...stair, rotation: 90 }, 2.6);
    const xs = g.footprint.map((p) => p.x);
    const ys = g.footprint.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(g.runLength);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1);
  });

  it("opening rectangle equals the footprint", () => {
    const g = computeStair(stair, 2.6);
    expect(g.opening).toEqual(g.footprint);
  });

  it("always has at least one step", () => {
    expect(computeStair(stair, 0.05).steps).toBe(1);
  });
});
