import { describe, it, expect } from "vitest";
import { detectRoom, ROOM_FILL_MARGIN } from "./roomFill";
import { createWall } from "../model/defaults";
import { boundsOfPoints } from "./planview";
import type { Wall, Vec2 } from "../model/types";

const wall = (a: Vec2, b: Vec2) => createWall(a, b);

// Grid bounds = bbox of all wall endpoints, expanded by the leak margin.
function bounds(walls: Wall[]) {
  const b = boundsOfPoints(walls.flatMap((w) => [w.start, w.end]))!;
  const m = ROOM_FILL_MARGIN;
  return { minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m };
}

const polyBBox = (p: Vec2[]) => {
  const xs = p.map((q) => q.x);
  const ys = p.map((q) => q.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

describe("detectRoom — closed rectangle", () => {
  const rect = [
    wall({ x: 0, y: 0 }, { x: 4, y: 0 }),
    wall({ x: 4, y: 0 }, { x: 4, y: 3 }),
    wall({ x: 4, y: 3 }, { x: 0, y: 3 }),
    wall({ x: 0, y: 3 }, { x: 0, y: 0 }),
  ];

  it("encloses, fills near the inner faces, and paints all four interior sides", () => {
    const r = detectRoom({ x: 2, y: 1.5 }, rect, bounds(rect));
    expect(r.enclosed).toBe(true);
    const bb = polyBBox(r.polygon);
    // polygon sits inside the walls' centerlines, close to the inner faces
    expect(bb.minX).toBeGreaterThan(0);
    expect(bb.minX).toBeLessThan(0.2);
    expect(bb.maxX).toBeLessThan(4);
    expect(bb.maxX).toBeGreaterThan(3.8);
    expect(r.wallSides).toHaveLength(4);
  });

  it("a rectangle is a 4-corner polygon after simplification", () => {
    const r = detectRoom({ x: 2, y: 1.5 }, rect, bounds(rect));
    expect(r.polygon.length).toBe(4);
  });
});

describe("detectRoom — open room", () => {
  it("reports not-enclosed when a wall is missing (leaks out)", () => {
    const open = [
      wall({ x: 0, y: 0 }, { x: 4, y: 0 }),
      wall({ x: 4, y: 0 }, { x: 4, y: 3 }),
      wall({ x: 4, y: 3 }, { x: 0, y: 3 }),
      // left wall omitted -> open
    ];
    const r = detectRoom({ x: 2, y: 1.5 }, open, bounds(open));
    expect(r.enclosed).toBe(false);
    expect(r.polygon).toEqual([]);
  });

  it("reports not-enclosed for a gap in a wall", () => {
    const gapped = [
      wall({ x: 0, y: 0 }, { x: 4, y: 0 }),
      wall({ x: 4, y: 0 }, { x: 4, y: 3 }),
      wall({ x: 4, y: 3 }, { x: 0, y: 3 }),
      // left wall with a gap from y=1 to y=2
      wall({ x: 0, y: 3 }, { x: 0, y: 2 }),
      wall({ x: 0, y: 1 }, { x: 0, y: 0 }),
    ];
    expect(detectRoom({ x: 2, y: 1.5 }, gapped, bounds(gapped)).enclosed).toBe(
      false,
    );
  });
});

describe("detectRoom — L-shaped room", () => {
  // outer boundary (0,0)-(4,0)-(4,2)-(2,2)-(2,4)-(0,4)
  const lshape = [
    wall({ x: 0, y: 0 }, { x: 4, y: 0 }),
    wall({ x: 4, y: 0 }, { x: 4, y: 2 }),
    wall({ x: 4, y: 2 }, { x: 2, y: 2 }),
    wall({ x: 2, y: 2 }, { x: 2, y: 4 }),
    wall({ x: 2, y: 4 }, { x: 0, y: 4 }),
    wall({ x: 0, y: 4 }, { x: 0, y: 0 }),
  ];

  it("encloses and traces the non-rectangular polygon (6 corners)", () => {
    const r = detectRoom({ x: 1, y: 1 }, lshape, bounds(lshape));
    expect(r.enclosed).toBe(true);
    expect(r.polygon.length).toBe(6);
    expect(r.wallSides.length).toBe(6);
  });

  it("clicking the missing quadrant of the L is outside the room", () => {
    // (3,3) is in the cut-out corner — open to the exterior
    const r = detectRoom({ x: 3, y: 3 }, lshape, bounds(lshape));
    expect(r.enclosed).toBe(false);
  });
});

describe("detectRoom — clicking a wall or outside", () => {
  const rect = [
    wall({ x: 0, y: 0 }, { x: 4, y: 0 }),
    wall({ x: 4, y: 0 }, { x: 4, y: 3 }),
    wall({ x: 4, y: 3 }, { x: 0, y: 3 }),
    wall({ x: 0, y: 3 }, { x: 0, y: 0 }),
  ];
  it("returns not-enclosed when the click is on a wall", () => {
    expect(detectRoom({ x: 2, y: 0 }, rect, bounds(rect)).enclosed).toBe(false);
  });
  it("returns not-enclosed when the click is outside the grid", () => {
    expect(detectRoom({ x: 999, y: 999 }, rect, bounds(rect)).enclosed).toBe(
      false,
    );
  });
});
