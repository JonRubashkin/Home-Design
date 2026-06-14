import { describe, it, expect } from "vitest";
import {
  snapEndpoint,
  closestPointOnSegment,
  endpointsCoincident,
  WALL_SNAP_TOLERANCE,
} from "./wallSnap";
import { createWall } from "../model/defaults";

const wall = (sx: number, sy: number, ex: number, ey: number) =>
  createWall({ x: sx, y: sy }, { x: ex, y: ey });

describe("closestPointOnSegment", () => {
  it("clamps to the segment and projects onto it", () => {
    expect(closestPointOnSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({
      x: 5,
      y: 0,
    });
    // beyond the end clamps to the endpoint
    expect(closestPointOnSegment({ x: 20, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({
      x: 10,
      y: 0,
    });
  });
});

describe("snapEndpoint", () => {
  const walls = [wall(0, 0, 4, 0), wall(4, 0, 4, 3)];

  it("snaps onto a nearby endpoint exactly (fixes short/overshoot)", () => {
    const r = snapEndpoint({ x: 3.92, y: 0.08 }, walls); // near (4,0)
    expect(r.kind).toBe("endpoint");
    expect(r.point).toEqual({ x: 4, y: 0 });
  });

  it("snaps onto a wall segment (T-junction) when not near an endpoint", () => {
    const r = snapEndpoint({ x: 2, y: 0.1 }, walls); // near middle of first wall
    expect(r.kind).toBe("segment");
    expect(r.point.x).toBeCloseTo(2);
    expect(r.point.y).toBeCloseTo(0);
  });

  it("returns none (grid fallback) when nothing is within tolerance", () => {
    const r = snapEndpoint({ x: 2, y: 1 }, walls);
    expect(r.kind).toBe("none");
    expect(r.point).toEqual({ x: 2, y: 1 });
  });

  it("prefers an endpoint over a segment when both are in range", () => {
    const r = snapEndpoint({ x: 3.95, y: 0.05 }, walls);
    expect(r.kind).toBe("endpoint");
  });
});

describe("endpointsCoincident", () => {
  it("uses the default tolerance", () => {
    expect(endpointsCoincident({ x: 0, y: 0 }, { x: 0.1, y: 0 })).toBe(true);
    expect(
      endpointsCoincident({ x: 0, y: 0 }, { x: WALL_SNAP_TOLERANCE + 0.05, y: 0 }),
    ).toBe(false);
  });
});
