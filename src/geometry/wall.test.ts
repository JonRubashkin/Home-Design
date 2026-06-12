import { describe, it, expect } from "vitest";
import {
  wallLength,
  wallDirection,
  wallNormal,
  distancePointToSegment,
  hitTestWall,
  nearestEndpoint,
} from "./wall";
import type { Wall } from "../model/types";
import { createWall } from "../model/defaults";

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

const wall = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  thickness = 0.15,
): Wall => createWall(start, end, { thickness });

describe("wallLength", () => {
  it("computes Euclidean length", () => {
    expect(wallLength(wall({ x: 0, y: 0 }, { x: 3, y: 4 }))).toBe(5);
  });
});

describe("wallDirection", () => {
  it("returns a unit vector start->end", () => {
    const d = wallDirection(wall({ x: 0, y: 0 }, { x: 0, y: 2 }));
    expect(close(d.x, 0)).toBe(true);
    expect(close(d.y, 1)).toBe(true);
  });

  it("returns {0,0} for a zero-length wall", () => {
    expect(wallDirection(wall({ x: 1, y: 1 }, { x: 1, y: 1 }))).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("wallNormal", () => {
  it("points to side A (left of travel) — east travel => up on screen", () => {
    // Direction (1,0); left of travel in +y-down space is (0,-1).
    const n = wallNormal(wall({ x: 0, y: 0 }, { x: 1, y: 0 }));
    expect(close(n.x, 0)).toBe(true);
    expect(close(n.y, -1)).toBe(true);
  });

  it("is unit length and perpendicular to the wall", () => {
    const w = wall({ x: 0, y: 0 }, { x: 2, y: 2 });
    const n = wallNormal(w);
    const d = wallDirection(w);
    expect(close(Math.hypot(n.x, n.y), 1)).toBe(true);
    expect(close(n.x * d.x + n.y * d.y, 0)).toBe(true);
  });
});

describe("distancePointToSegment", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 4, y: 0 };

  it("perpendicular distance for a point above the middle", () => {
    expect(distancePointToSegment({ x: 2, y: 3 }, a, b)).toBe(3);
  });

  it("clamps to the nearest endpoint when beyond the segment", () => {
    expect(distancePointToSegment({ x: -3, y: 0 }, a, b)).toBe(3);
    expect(distancePointToSegment({ x: 7, y: 0 }, a, b)).toBe(3);
  });

  it("handles a degenerate (point) segment", () => {
    expect(distancePointToSegment({ x: 0, y: 5 }, a, a)).toBe(5);
  });
});

describe("hitTestWall", () => {
  const w = wall({ x: 0, y: 0 }, { x: 4, y: 0 }, 0.2); // half-thickness 0.1

  it("hits inside the thick body", () => {
    expect(hitTestWall({ x: 2, y: 0.05 }, w)).toBe(true);
  });

  it("misses just outside the body without tolerance", () => {
    expect(hitTestWall({ x: 2, y: 0.2 }, w)).toBe(false);
  });

  it("hits outside the body when given tolerance", () => {
    expect(hitTestWall({ x: 2, y: 0.2 }, w, 0.15)).toBe(true);
  });

  it("respects the segment ends", () => {
    expect(hitTestWall({ x: 5, y: 0 }, w)).toBe(false);
  });
});

describe("nearestEndpoint", () => {
  const walls = [
    wall({ x: 0, y: 0 }, { x: 3, y: 0 }),
    wall({ x: 3, y: 0 }, { x: 3, y: 3 }),
  ];

  it("returns the closest endpoint within radius", () => {
    const r = nearestEndpoint({ x: 3.05, y: 0.04 }, walls, 0.15);
    expect(r).toEqual({ x: 3, y: 0 });
  });

  it("returns null when nothing is within radius", () => {
    expect(nearestEndpoint({ x: 1.5, y: 1.5 }, walls, 0.15)).toBeNull();
  });

  it("returns a copy, not a reference to wall data", () => {
    const r = nearestEndpoint({ x: 0, y: 0 }, walls, 0.15);
    expect(r).not.toBe(walls[0].start);
    expect(r).toEqual({ x: 0, y: 0 });
  });
});
