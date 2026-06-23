import { describe, it, expect } from "vitest";
import type { Wall } from "../model/types";
import { createWall } from "../model/defaults";
import {
  wallsMergeable,
  mergeWallPair,
  resolveWallOverlaps,
} from "./wallMerge";
import { wallLength } from "./wall";

function wall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  extra?: Partial<Wall>,
): Wall {
  return { ...createWall(start, end), ...extra };
}

describe("wallsMergeable", () => {
  it("flags an exact duplicate", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    expect(wallsMergeable(a, b)).toBe(true);
  });

  it("flags containment (one inside the other)", () => {
    const a = wall({ x: 0, y: 0 }, { x: 6, y: 0 });
    const b = wall({ x: 2, y: 0 }, { x: 4, y: 0 });
    expect(wallsMergeable(a, b)).toBe(true);
  });

  it("flags partial overlap", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 3, y: 0 }, { x: 7, y: 0 });
    expect(wallsMergeable(a, b)).toBe(true);
  });

  it("flags overlap regardless of direction", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 7, y: 0 }, { x: 3, y: 0 }); // reversed, overlaps [3,4]
    expect(wallsMergeable(a, b)).toBe(true);
  });

  it("does NOT merge collinear-but-disjoint walls", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 5, y: 0 }, { x: 8, y: 0 });
    expect(wallsMergeable(a, b)).toBe(false);
  });

  it("does NOT merge walls that only touch at an endpoint (chain)", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 4, y: 0 }, { x: 8, y: 0 });
    expect(wallsMergeable(a, b)).toBe(false);
  });

  it("does NOT merge a perpendicular corner", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 0, y: 0 }, { x: 0, y: 4 });
    expect(wallsMergeable(a, b)).toBe(false);
  });

  it("does NOT merge parallel-but-offset walls", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 0, y: 1 }, { x: 4, y: 1 });
    expect(wallsMergeable(a, b)).toBe(false);
  });
});

describe("mergeWallPair", () => {
  it("spans the union of a partial overlap", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 3, y: 0 }, { x: 7, y: 0 });
    const m = mergeWallPair(a, b);
    expect(wallLength(m)).toBeCloseTo(7, 6);
    expect(m.start).toEqual({ x: 0, y: 0 });
    expect(m.end).toEqual({ x: 7, y: 0 });
  });

  it("keeps the thicker thickness and taller height", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 }, {
      thickness: 0.1,
      height: 2.4,
    });
    const b = wall({ x: 2, y: 0 }, { x: 6, y: 0 }, {
      thickness: 0.3,
      height: 3.0,
    });
    const m = mergeWallPair(a, b);
    expect(m.thickness).toBe(0.3);
    expect(m.height).toBe(3.0);
  });

  it("prefers a painted (non-default) color over the default", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 2, y: 0 }, { x: 6, y: 0 });
    b.paintA = { kind: "solid", color: "#ff0000" };
    const m = mergeWallPair(a, b);
    expect(m.paintA).toEqual({ kind: "solid", color: "#ff0000" });
  });

  it("re-parameterizes a window's t to keep its world position", () => {
    // Window centered at x=1 on wall a ([0,4], t=0.25 → 1m).
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    a.windows = [
      {
        id: "w1",
        t: 0.25,
        width: 1,
        height: 1.2,
        sillHeight: 0.9,
        style: "picture",
        muntinMaterial: { kind: "solid", color: "#eef0f2" },
      },
    ];
    const b = wall({ x: 3, y: 0 }, { x: 7, y: 0 });
    const m = mergeWallPair(a, b); // merged [0,7], length 7
    // World x=1 → t = 1/7 on the merged wall.
    expect(m.windows).toHaveLength(1);
    expect(m.windows[0]!.t).toBeCloseTo(1 / 7, 6);
  });

  it("carries openings from BOTH walls", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    a.doors = [
      {
        id: "d1",
        t: 0.5,
        width: 0.9,
        height: 2,
        style: "single",
        hinge: "start",
        swing: "A",
        material: { kind: "solid", color: "#9a6b4f" },
      },
    ];
    const b = wall({ x: 2, y: 0 }, { x: 8, y: 0 });
    b.windows = [
      {
        id: "w2",
        t: 0.75,
        width: 1,
        height: 1.2,
        sillHeight: 0.9,
        style: "picture",
        muntinMaterial: { kind: "solid", color: "#eef0f2" },
      },
    ];
    const m = mergeWallPair(a, b);
    expect(m.doors).toHaveLength(1);
    expect(m.windows).toHaveLength(1);
  });

  it("flips door hinge/swing and mount face for a reversed source wall", () => {
    const a = wall({ x: 0, y: 0 }, { x: 6, y: 0 });
    // b runs in the opposite direction but overlaps a.
    const b = wall({ x: 6, y: 0 }, { x: 2, y: 0 });
    b.doors = [
      {
        id: "d1",
        t: 0.5,
        width: 0.9,
        height: 2,
        style: "single",
        hinge: "start",
        swing: "A",
        material: { kind: "solid", color: "#9a6b4f" },
      },
    ];
    b.mounts = [
      { id: "m1", catalogId: "art", t: 0.5, heightUpWall: 1.5, face: "A", scale: { x: 1, y: 1, z: 1 }, materials: {} },
    ];
    const m = mergeWallPair(a, b);
    // Merged wall runs 0→6 (same as a); b was reversed, so its children flip.
    expect(m.doors[0]!.hinge).toBe("end");
    expect(m.doors[0]!.swing).toBe("B");
    expect(m.mounts[0]!.face).toBe("B");
  });
});

describe("resolveWallOverlaps", () => {
  it("merges an inner rectangle edge sharing an outer wall into one", () => {
    const outer = wall({ x: 0, y: 0 }, { x: 10, y: 0 });
    const inner = wall({ x: 2, y: 0 }, { x: 6, y: 0 });
    const { walls, merged } = resolveWallOverlaps([outer, inner]);
    expect(merged).toBe(true);
    expect(walls).toHaveLength(1);
    expect(wallLength(walls[0]!)).toBeCloseTo(10, 6);
  });

  it("leaves a clean set unchanged and reports no merge (idempotent)", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 4, y: 0 }, { x: 4, y: 4 }); // corner, touching only
    const first = resolveWallOverlaps([a, b]);
    expect(first.merged).toBe(false);
    expect(first.walls).toHaveLength(2);
    const second = resolveWallOverlaps(first.walls);
    expect(second.merged).toBe(false);
    expect(second.walls).toHaveLength(2);
  });

  it("chains transitive overlaps into a single wall", () => {
    const a = wall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const b = wall({ x: 3, y: 0 }, { x: 7, y: 0 });
    const c = wall({ x: 6, y: 0 }, { x: 10, y: 0 });
    const { walls, merged } = resolveWallOverlaps([a, b, c]);
    expect(merged).toBe(true);
    expect(walls).toHaveLength(1);
    expect(wallLength(walls[0]!)).toBeCloseTo(10, 6);
  });
});
