import { describe, it, expect } from "vitest";
import type { Vec2 } from "../model/types";
import { openingsForFloor } from "./floorOpenings";

// A 4x4 floor square.
const floor: Vec2[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe("openingsForFloor", () => {
  it("keeps an opening fully inside the floor", () => {
    const op = rect(1, 1, 2, 2);
    expect(openingsForFloor([op], floor)).toEqual([op]);
  });

  it("keeps an opening flush against a floor edge (the regression case)", () => {
    // Stair against the left wall: shares the x=0 edge, so two corners lie ON
    // the floor boundary. The old `every corner strictly inside` test dropped
    // this hole; the overlap test keeps it.
    const op = rect(0, 1, 1, 2);
    expect(openingsForFloor([op], floor)).toEqual([op]);
  });

  it("keeps an opening flush in a corner of the floor", () => {
    const op = rect(0, 0, 1, 1);
    expect(openingsForFloor([op], floor)).toEqual([op]);
  });

  it("drops an opening entirely outside the floor", () => {
    const op = rect(5, 5, 6, 6);
    expect(openingsForFloor([op], floor)).toEqual([]);
  });

  it("drops an opening that only touches the floor on an edge (no area)", () => {
    // Sits entirely to the left, sharing just the x=0 line — no interior overlap.
    const op = rect(-1, 1, 0, 2);
    expect(openingsForFloor([op], floor)).toEqual([]);
  });

  it("selects only the overlapping subset of multiple openings", () => {
    const inside = rect(1, 1, 2, 2);
    const flush = rect(3, 0, 4, 1);
    const outside = rect(10, 10, 11, 11);
    expect(openingsForFloor([inside, flush, outside], floor)).toEqual([
      inside,
      flush,
    ]);
  });

  it("returns nothing when there are no openings", () => {
    expect(openingsForFloor([], floor)).toEqual([]);
  });
});
