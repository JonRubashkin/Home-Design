import { describe, it, expect } from "vitest";
import {
  polygonArea,
  segmentsProperlyIntersect,
  isPolygonSelfIntersecting,
  isValidFloorPolygon,
  pointInPolygon,
  polygonsOverlap,
  polygonContains,
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
