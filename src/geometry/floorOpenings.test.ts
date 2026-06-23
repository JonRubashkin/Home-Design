import { describe, it, expect } from "vitest";
import type { Vec2 } from "../model/types";
import { floorHoles, openingsForFloor } from "./floorOpenings";
import { pointInPolygon } from "./polygon";

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

// `floorHoles` produces the actual hole polygons subtracted from a floor mesh.
// The invariant that makes THREE/Earcut cut the hole is that every hole vertex is
// STRICTLY inside the floor (none on/outside the boundary) — a hole touching the
// outer contour is a notch Earcut silently drops, which was the Fill-Room 3D bug.
const strictlyInside = (hole: Vec2[], poly: Vec2[]) =>
  hole.every((p) => pointInPolygon(p, poly));

describe("floorHoles", () => {
  it("cuts an opening fully inside the floor (Floor-tool case)", () => {
    const op = rect(1, 1, 2, 2);
    const holes = floorHoles([op], floor);
    expect(holes).toHaveLength(1);
    expect(strictlyInside(holes[0]!, floor)).toBe(true);
  });

  it("cuts an opening that pokes past the floor edge, strictly inside (Fill-Room case)", () => {
    // Stair flush against a wall whose footprint reaches past the traced interior
    // floor edge — the exact situation that left the 3D slab solid.
    const op = rect(-0.1, 1, 1, 2);
    const holes = floorHoles([op], floor);
    expect(holes).toHaveLength(1);
    expect(strictlyInside(holes[0]!, floor)).toBe(true);
  });

  it("yields no holes when no opening overlaps the floor", () => {
    expect(floorHoles([rect(10, 10, 11, 11)], floor)).toEqual([]);
  });

  it("cuts every overlapping stair and ignores non-overlapping ones", () => {
    const a = rect(1, 1, 1.5, 1.5);
    const b = rect(2.5, 2.5, 3, 3);
    const away = rect(20, 20, 21, 21);
    const holes = floorHoles([a, b, away], floor);
    expect(holes).toHaveLength(2);
    expect(holes.every((h) => strictlyInside(h, floor))).toBe(true);
  });

  it("a Fill-Room-shaped region cuts the SAME stair as a Floor-tool region", () => {
    // Same stair, flush against the left wall (its opening reaches x=0).
    const stair = rect(0, 1.4, 1, 2.6);
    // Floor tool: a region drawn out to the wall centerlines/outer (larger).
    const floorTool = rect(-0.075, -0.075, 4.075, 4.075);
    // Fill Room: traced to the interior wall faces (smaller).
    const fillRoom = rect(0.1, 0.1, 3.9, 3.9);

    const fromFloorTool = floorHoles([stair], floorTool);
    const fromFillRoom = floorHoles([stair], fillRoom);

    // Both produce exactly one hole, each strictly inside ITS OWN floor so Earcut
    // cuts it — the origin tool no longer affects whether the hole appears.
    expect(fromFloorTool).toHaveLength(1);
    expect(fromFillRoom).toHaveLength(1);
    expect(strictlyInside(fromFloorTool[0]!, floorTool)).toBe(true);
    expect(strictlyInside(fromFillRoom[0]!, fillRoom)).toBe(true);
  });
});
