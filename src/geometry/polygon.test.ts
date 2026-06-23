import { describe, it, expect } from "vitest";
import {
  polygonArea,
  segmentsProperlyIntersect,
  isPolygonSelfIntersecting,
  isValidFloorPolygon,
  pointInPolygon,
  polygonsOverlap,
  polygonContains,
  simplifyPolygon,
  clipPolygon,
  insetPolygonTowardCentroid,
} from "./polygon";
import type { Vec2 } from "../model/types";

const square: Vec2[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

// Classic self-crossing "bowtie".
const bowtie: Vec2[] = [
  { x: 0, y: 0 },
  { x: 4, y: 4 },
  { x: 4, y: 0 },
  { x: 0, y: 4 },
];

describe("polygonArea", () => {
  it("computes the area magnitude of a square", () => {
    expect(Math.abs(polygonArea(square))).toBeCloseTo(16);
  });
  it("is ~0 for a degenerate (collinear) polygon", () => {
    expect(
      Math.abs(
        polygonArea([
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 4, y: 0 },
        ]),
      ),
    ).toBeCloseTo(0);
  });
});

describe("segmentsProperlyIntersect", () => {
  it("detects a crossing", () => {
    expect(
      segmentsProperlyIntersect(
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
        { x: 4, y: 0 },
      ),
    ).toBe(true);
  });
  it("returns false for segments that only share an endpoint", () => {
    expect(
      segmentsProperlyIntersect(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ),
    ).toBe(false);
  });
});

describe("isPolygonSelfIntersecting", () => {
  it("is false for a simple square", () => {
    expect(isPolygonSelfIntersecting(square)).toBe(false);
  });
  it("is true for a bowtie", () => {
    expect(isPolygonSelfIntersecting(bowtie)).toBe(true);
  });
  it("is false for a triangle", () => {
    expect(
      isPolygonSelfIntersecting([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ]),
    ).toBe(false);
  });
});

describe("isValidFloorPolygon", () => {
  it("accepts a square", () => {
    expect(isValidFloorPolygon(square)).toBe(true);
  });
  it("rejects fewer than three points", () => {
    expect(
      isValidFloorPolygon([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(false);
  });
  it("rejects a self-intersecting polygon", () => {
    expect(isValidFloorPolygon(bowtie)).toBe(false);
  });
  it("rejects a zero-area polygon", () => {
    expect(
      isValidFloorPolygon([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ]),
    ).toBe(false);
  });
});

describe("pointInPolygon", () => {
  it("is true for an interior point", () => {
    expect(pointInPolygon({ x: 2, y: 2 }, square)).toBe(true);
  });
  it("is false for an exterior point", () => {
    expect(pointInPolygon({ x: 6, y: 2 }, square)).toBe(false);
  });
});

describe("polygonsOverlap", () => {
  const sq = (x: number, y: number, s: number): Vec2[] => [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ];

  it("is true for partially overlapping squares", () => {
    expect(polygonsOverlap(sq(0, 0, 4), sq(2, 2, 4))).toBe(true);
  });

  it("is true when one polygon fully contains the other", () => {
    expect(polygonsOverlap(sq(0, 0, 6), sq(2, 2, 1))).toBe(true);
    expect(polygonsOverlap(sq(2, 2, 1), sq(0, 0, 6))).toBe(true);
  });

  it("is false for disjoint squares", () => {
    expect(polygonsOverlap(sq(0, 0, 2), sq(5, 5, 2))).toBe(false);
  });

  it("is false for squares that only share an edge", () => {
    expect(polygonsOverlap(sq(0, 0, 2), sq(2, 0, 2))).toBe(false);
  });
});

describe("polygonContains", () => {
  const sq = (x: number, y: number, s: number): { x: number; y: number }[] => [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ];

  it("is true when outer fully covers inner", () => {
    expect(polygonContains(sq(0, 0, 6), sq(1, 1, 2))).toBe(true);
  });

  it("is true for an identical polygon (redraw same region)", () => {
    expect(polygonContains(sq(0, 0, 4), sq(0, 0, 4))).toBe(true);
  });

  it("is false for a partial overlap", () => {
    expect(polygonContains(sq(0, 0, 4), sq(2, 2, 4))).toBe(false);
  });

  it("is false when inner is bigger / disjoint", () => {
    expect(polygonContains(sq(1, 1, 2), sq(0, 0, 6))).toBe(false);
    expect(polygonContains(sq(0, 0, 2), sq(5, 5, 2))).toBe(false);
  });
});

describe("simplifyPolygon", () => {
  it("leaves a clean rectangle's corners intact", () => {
    const rect: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ];
    const out = simplifyPolygon(rect, 0.15);
    expect(out).toHaveLength(4);
  });

  it("keeps an L-shape's six corners", () => {
    const L: Vec2[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 6 },
      { x: 0, y: 6 },
    ];
    const out = simplifyPolygon(L, 0.15);
    expect(out).toHaveLength(6);
  });

  it("collapses a grid-traced diagonal staircase into a diagonal edge", () => {
    // A 45° edge approximated by 0.1 m stair steps from (0,0) to (2,2), closed
    // back along the axes. The staircase should simplify so the hypotenuse is a
    // single (diagonal) edge — making the polygon read as non-rectilinear.
    const pts: Vec2[] = [{ x: 0, y: 0 }];
    for (let i = 1; i <= 20; i++) {
      pts.push({ x: i * 0.1, y: (i - 1) * 0.1 });
      pts.push({ x: i * 0.1, y: i * 0.1 });
    }
    pts.push({ x: 2, y: 0 });
    const out = simplifyPolygon(pts, 0.15);
    // Far fewer points than the staircase had.
    expect(out.length).toBeLessThan(pts.length / 2);
  });
});

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe("clipPolygon", () => {
  it("returns the subject unchanged when fully inside the convex clip", () => {
    const out = clipPolygon(rect(1, 1, 2, 2), square);
    // Same region (a 1x1 box); area preserved.
    expect(Math.abs(polygonArea(out))).toBeCloseTo(1, 6);
  });

  it("trims the subject to the part inside the clip", () => {
    // Floor (subject) clipped to an opening (convex clip) that pokes past the
    // floor's left edge: the result is the in-floor part only.
    const floor = square; // 0..4
    const opening = rect(-1, 1, 1, 2); // x in [-1,1]
    const out = clipPolygon(floor, opening);
    // Intersection is x in [0,1], y in [1,2] => area 1.
    expect(Math.abs(polygonArea(out))).toBeCloseTo(1, 6);
    expect(out.every((p) => p.x >= -1e-9 && p.x <= 1 + 1e-9)).toBe(true);
  });

  it("works with a non-convex (L-shaped) subject", () => {
    const L: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    const out = clipPolygon(L, rect(0, 1, 1, 3));
    expect(out.length).toBeGreaterThanOrEqual(3);
    // The clip box [0,1]x[1,3] lies inside the L's left arm => area 2.
    expect(Math.abs(polygonArea(out))).toBeCloseTo(2, 6);
  });

  it("is winding-robust (CCW clip yields the same intersection)", () => {
    const ccwClip = [...rect(1, 1, 2, 2)].reverse();
    const out = clipPolygon(square, ccwClip);
    expect(Math.abs(polygonArea(out))).toBeCloseTo(1, 6);
  });
});

describe("insetPolygonTowardCentroid", () => {
  it("pulls a boundary-touching box strictly inside", () => {
    // A hole flush against the floor's left edge (x=0). After inset, no vertex is
    // on the boundary, so it is strictly interior.
    const hole = rect(0, 1, 1, 2);
    const inset = insetPolygonTowardCentroid(hole, 0.01);
    expect(inset.every((p) => pointInPolygon(p, square))).toBe(true);
  });

  it("shrinks the polygon (smaller area, same centroid)", () => {
    const inset = insetPolygonTowardCentroid(rect(0, 0, 2, 2), 0.1);
    expect(Math.abs(polygonArea(inset))).toBeLessThan(4);
  });
});
