import { describe, it, expect } from "vitest";
import {
  rotateVec,
  pointInFootprint,
  footprintCorners,
  wallHuggerSnap,
  type Footprint,
} from "./furniture";
import { createWall } from "../model/defaults";
import type { Wall } from "../model/types";

const fp: Footprint = { width: 2, depth: 1 };
const close = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

describe("pointInFootprint", () => {
  it("hits inside an axis-aligned footprint", () => {
    expect(pointInFootprint({ x: 0.5, y: 0.4 }, { x: 0, y: 0 }, 0, fp)).toBe(
      true,
    );
    expect(pointInFootprint({ x: 1.1, y: 0 }, { x: 0, y: 0 }, 0, fp)).toBe(
      false,
    );
  });

  it("respects rotation", () => {
    // Rotated 90°: width axis now along y. A point at (0, 0.9) is inside the
    // rotated 2x1 box (half-width 1 along y) but would be outside unrotated.
    expect(pointInFootprint({ x: 0, y: 0.9 }, { x: 0, y: 0 }, 90, fp)).toBe(
      true,
    );
    expect(pointInFootprint({ x: 0.9, y: 0 }, { x: 0, y: 0 }, 90, fp)).toBe(
      false,
    );
  });

  it("respects translation", () => {
    expect(pointInFootprint({ x: 5, y: 5 }, { x: 5, y: 5 }, 0, fp)).toBe(true);
    expect(pointInFootprint({ x: 0, y: 0 }, { x: 5, y: 5 }, 0, fp)).toBe(false);
  });
});

describe("footprintCorners", () => {
  it("returns the four corners of an axis-aligned footprint", () => {
    const c = footprintCorners({ x: 0, y: 0 }, 0, fp);
    expect(c).toContainEqual({ x: -1, y: -0.5 });
    expect(c).toContainEqual({ x: 1, y: 0.5 });
  });
});

describe("rotateVec", () => {
  it("rotates +90° clockwise in y-down space", () => {
    const r = rotateVec({ x: 1, y: 0 }, 90);
    expect(close(r.x, 0)).toBe(true);
    expect(close(r.y, 1)).toBe(true);
  });
});

describe("wallHuggerSnap", () => {
  // A horizontal wall along +x at y=0, thickness 0.15 (face at y = ±0.075).
  const hWall: Wall = createWall({ x: 0, y: 0 }, { x: 6, y: 0 });
  const sofa: Footprint = { width: 2, depth: 0.9 };

  it("snaps the back edge flush and aligns rotation when near a wall", () => {
    // Item below the wall (side B), back edge ~0.1 m from the face.
    const r = wallHuggerSnap({ x: 3, y: 0.62 }, 0, sofa, [hWall]);
    expect(r.snapped).toBe(true);
    // back edge flush: center should sit at faceOffset + depth/2 = 0.075 + 0.45
    expect(close(r.position.y, 0.525, 1e-6)).toBe(true);
    expect(close(r.position.x, 3)).toBe(true); // slides only perpendicular
    // item sits above the wall, so its front (+y local) faces away (up): rot 0
    expect(close(r.rotation, 0, 1e-6)).toBe(true);
  });

  it("releases (no snap) when farther than the threshold", () => {
    const r = wallHuggerSnap({ x: 3, y: 2.0 }, 30, sofa, [hWall]);
    expect(r.snapped).toBe(false);
    expect(r.rotation).toBe(30);
  });

  it("does not snap when the item is past the wall's ends", () => {
    const r = wallHuggerSnap({ x: 9, y: 0.5 }, 0, sofa, [hWall]);
    expect(r.snapped).toBe(false);
  });

  it("snaps and aligns against a 45° wall", () => {
    const diag: Wall = createWall({ x: 0, y: 0 }, { x: 4, y: 4 });
    // Point just off the diagonal on the +normal side. normal = (1,-1)/√2.
    const off = 0.075 + 0.45 + 0.05; // faceOffset + depth/2 + small gap
    const nx = 1 / Math.SQRT2;
    const ny = -1 / Math.SQRT2;
    const r = wallHuggerSnap({ x: 2 + nx * off, y: 2 + ny * off }, 0, sofa, [
      diag,
    ]);
    expect(r.snapped).toBe(true);
    // Back edge flush: perpendicular distance from centerline == faceOffset+depth/2
    const s = (r.position.x - 0) * nx + (r.position.y - 0) * ny;
    expect(close(Math.abs(s), 0.075 + 0.45, 1e-6)).toBe(true);
    // Front faces into the room (along +normal). front = R(rot)*(0,1).
    const rad = (r.rotation * Math.PI) / 180;
    const frontX = -Math.sin(rad);
    const frontY = Math.cos(rad);
    expect(close(frontX, nx, 1e-6)).toBe(true);
    expect(close(frontY, ny, 1e-6)).toBe(true);
  });
});
