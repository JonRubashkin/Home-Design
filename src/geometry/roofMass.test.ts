import { describe, it, expect } from "vitest";
import type { Vec2, Wall } from "../model/types";
import { detectMasses, decomposeRectangles } from "./roofMass";
import { polygonArea, pointInPolygon } from "./polygon";

let wallSeq = 0;
function wall(x1: number, y1: number, x2: number, y2: number): Wall {
  return {
    id: `w${wallSeq++}`,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    height: 2.4,
    thickness: 0.15,
    paintA: { kind: "solid", color: "#fff" },
    paintB: { kind: "solid", color: "#fff" },
    windows: [],
    doors: [],
    mounts: [],
  };
}

// Four joined walls around a w x d rectangle anchored at (ox, oy).
function room(ox: number, oy: number, w: number, d: number): Wall[] {
  return [
    wall(ox, oy, ox + w, oy),
    wall(ox + w, oy, ox + w, oy + d),
    wall(ox + w, oy + d, ox, oy + d),
    wall(ox, oy + d, ox, oy),
  ];
}

// L-shape: a 4x4 footprint with the (2..4, 2..4) corner removed.
function lRoom(): Wall[] {
  const pts: Vec2[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 4 },
    { x: 0, y: 4 },
  ];
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return wall(p.x, p.y, q.x, q.y);
  });
}

describe("detectMasses", () => {
  it("one rectangle room is a single mass", () => {
    const masses = detectMasses(room(0, 0, 4, 3));
    expect(masses).toHaveLength(1);
    // The anchor sits inside the footprint polygon.
    expect(pointInPolygon(masses[0]!.anchor, masses[0]!.footprint)).toBe(true);
  });

  it("two disconnected rooms are two masses", () => {
    const masses = detectMasses([...room(0, 0, 4, 3), ...room(10, 0, 4, 3)]);
    expect(masses).toHaveLength(2);
    // The two anchors are well separated (one per mass).
    const [a, b] = masses;
    expect(Math.abs(a!.anchor.x - b!.anchor.x)).toBeGreaterThan(5);
  });

  it("an L-shaped room is a single mass", () => {
    const masses = detectMasses(lRoom());
    expect(masses).toHaveLength(1);
  });
});

describe("decomposeRectangles", () => {
  const sumArea = (rects: ReturnType<typeof decomposeRectangles>) =>
    rects.reduce((s, r) => s + (r.maxX - r.minX) * (r.maxY - r.minY), 0);

  it("a rectangle decomposes to one rectangle", () => {
    const poly: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const rects = decomposeRectangles(poly);
    expect(rects).toHaveLength(1);
    expect(sumArea(rects)).toBeCloseTo(12, 6);
  });

  it("an L decomposes to two rectangles covering the same area", () => {
    const poly: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    const rects = decomposeRectangles(poly);
    expect(rects).toHaveLength(2);
    expect(sumArea(rects)).toBeCloseTo(Math.abs(polygonArea(poly)), 6);
  });

  it("a T decomposes into rectangles covering the same area", () => {
    // Horizontal bar y[2,3] x[0,6] + stem x[2,4] y[0,2].
    const poly: Vec2[] = [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 6, y: 2 },
      { x: 6, y: 3 },
      { x: 0, y: 3 },
    ];
    const rects = decomposeRectangles(poly);
    expect(rects.length).toBeGreaterThanOrEqual(2);
    expect(sumArea(rects)).toBeCloseTo(Math.abs(polygonArea(poly)), 6);
  });

  it("a U decomposes into rectangles covering the same area", () => {
    // 5x4 footprint with a central notch x[2,3] y[2,4] removed (opening up top).
    const poly: Vec2[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 3, y: 4 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
    ];
    const rects = decomposeRectangles(poly);
    expect(rects.length).toBeGreaterThanOrEqual(2);
    expect(sumArea(rects)).toBeCloseTo(Math.abs(polygonArea(poly)), 6);
  });

  it("falls back to the bounding rectangle for an angled footprint", () => {
    const poly: Vec2[] = [
      { x: 0, y: 0 },
      { x: 4, y: 1 },
      { x: 3, y: 4 },
      { x: 0, y: 3 },
    ];
    const rects = decomposeRectangles(poly);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 4 });
  });
});
