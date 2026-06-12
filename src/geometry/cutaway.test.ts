import { describe, it, expect } from "vitest";
import { isWallFrontFacing, wallsCentroid } from "./cutaway";
import { createWall } from "../model/defaults";
import type { Wall } from "../model/types";

// A 4x4 closed room (plan space, +y is "south"/down). Walls wound clockwise.
const north: Wall = createWall({ x: 0, y: 0 }, { x: 4, y: 0 });
const east: Wall = createWall({ x: 4, y: 0 }, { x: 4, y: 4 });
const south: Wall = createWall({ x: 4, y: 4 }, { x: 0, y: 4 });
const west: Wall = createWall({ x: 0, y: 4 }, { x: 0, y: 0 });
const room = [north, east, south, west];

describe("wallsCentroid", () => {
  it("finds the centre of a square room", () => {
    expect(wallsCentroid(room)).toEqual({ x: 2, y: 2 });
  });

  it("returns origin for an empty list", () => {
    expect(wallsCentroid([])).toEqual({ x: 0, y: 0 });
  });
});

describe("isWallFrontFacing", () => {
  const centroid = wallsCentroid(room);

  it("hides the near walls and keeps the far walls, from one corner", () => {
    // Camera far to the north-west (small x, small y) looking at the room.
    const camera = { x: -20, y: -20 };
    // North and West walls are nearest the camera -> front-facing (hidden).
    expect(isWallFrontFacing(north, centroid, camera)).toBe(true);
    expect(isWallFrontFacing(west, centroid, camera)).toBe(true);
    // South and East are the far walls -> stay solid.
    expect(isWallFrontFacing(south, centroid, camera)).toBe(false);
    expect(isWallFrontFacing(east, centroid, camera)).toBe(false);
  });

  it("hands the hidden set over to the opposite corner when orbited", () => {
    const camera = { x: 24, y: 24 }; // south-east
    expect(isWallFrontFacing(south, centroid, camera)).toBe(true);
    expect(isWallFrontFacing(east, centroid, camera)).toBe(true);
    expect(isWallFrontFacing(north, centroid, camera)).toBe(false);
    expect(isWallFrontFacing(west, centroid, camera)).toBe(false);
  });

  it("always leaves at least the far half of a square solid over a full orbit", () => {
    const r = 30;
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const camera = { x: 2 + r * Math.cos(a), y: 2 + r * Math.sin(a) };
      const hiddenCount = room.filter((w) =>
        isWallFrontFacing(w, centroid, camera),
      ).length;
      // Never hide all four walls; interior must stay visible.
      expect(hiddenCount).toBeLessThanOrEqual(2);
      expect(hiddenCount).toBeGreaterThanOrEqual(1);
    }
  });
});
