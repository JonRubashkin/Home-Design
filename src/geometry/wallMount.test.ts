import { describe, it, expect } from "vitest";
import {
  mountFaceNormal,
  wallMountPlanFootprint,
  wallMountWorld,
} from "./wallMount";
import { createWall } from "../model/defaults";

const close = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// A 4 m horizontal wall, default thickness 0.15. dir = (1,0); side-A normal is
// perpLeft(dir) = (0,-1) (up on screen), side B = (0,1).
const wall = createWall({ x: 0, y: 0 }, { x: 4, y: 0 });

describe("mountFaceNormal", () => {
  it("points to side A (left of start->end) and negates for B", () => {
    const a = mountFaceNormal(wall, "A");
    const b = mountFaceNormal(wall, "B");
    expect(close(a.x, 0) && close(a.y, -1)).toBe(true);
    expect(close(b.x, 0) && close(b.y, 1)).toBe(true);
  });
});

describe("wallMountPlanFootprint", () => {
  it("centers the marker just off the chosen face", () => {
    // thickness/2 (0.075) + protrusion/2 (0.05) = 0.125 off the centerline.
    const fpA = wallMountPlanFootprint(wall, 0.5, "A", 1, 0.1);
    expect(close(fpA.center.x, 2)).toBe(true);
    expect(close(fpA.center.y, -0.125)).toBe(true);
    expect(fpA.footprint).toEqual({ width: 1, depth: 0.1 });

    const fpB = wallMountPlanFootprint(wall, 0.5, "B", 1, 0.1);
    expect(close(fpB.center.y, 0.125)).toBe(true);
  });

  it("moves the center along the wall with t", () => {
    const fp = wallMountPlanFootprint(wall, 0.25, "A", 1, 0.1);
    expect(close(fp.center.x, 1)).toBe(true);
  });
});

describe("wallMountWorld", () => {
  it("places the vertical center at elevation + heightUpWall", () => {
    const t = wallMountWorld(
      wall,
      { t: 0.5, face: "A", heightUpWall: 1.5 },
      { width: 1, depth: 0.1, height: 0.6 },
      0,
    );
    // group y = elevation + heightUpWall - height/2 = 1.5 - 0.3
    expect(close(t.position[1], 1.2)).toBe(true);
    // plan (x, y) -> world (x, 0, y): center x=2, y=-0.125
    expect(close(t.position[0], 2)).toBe(true);
    expect(close(t.position[2], -0.125)).toBe(true);
  });

  it("offsets the world Y by the level elevation", () => {
    const t = wallMountWorld(
      wall,
      { t: 0.5, face: "B", heightUpWall: 1.0 },
      { width: 1, depth: 0.2, height: 0.4 },
      3,
    );
    expect(close(t.position[1], 3 + 1.0 - 0.2)).toBe(true);
  });
});
