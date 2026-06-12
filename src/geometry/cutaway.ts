import type { Vec2, Wall } from "../model/types";
import { wallMidpoint, wallNormal } from "./wall";
import { dot, normalize, sub } from "./vec";

// Centroid of all wall endpoints — a cheap stand-in for a room's interior.
export function wallsCentroid(walls: Wall[]): Vec2 {
  if (walls.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const w of walls) {
    sx += w.start.x + w.end.x;
    sy += w.start.y + w.end.y;
  }
  const n = walls.length * 2;
  return { x: sx / n, y: sy / n };
}

// Whether a wall sits between the camera and the interior (so it should be
// suppressed in cutaway mode). All coordinates are plan-space; the camera's
// world (X,Y,Z) maps to plan (X, Z). We take the wall's outward normal (the
// ±normal pointing away from the centroid) and test whether it faces the
// camera. The threshold hides clearly front-facing walls while leaving walls
// seen edge-on (and the far walls) solid, giving a smooth handoff while orbiting.
export function isWallFrontFacing(
  wall: Wall,
  centroid: Vec2,
  cameraPlan: Vec2,
  threshold = 0.1,
): boolean {
  const mid = wallMidpoint(wall);
  const n = wallNormal(wall);
  const outward = dot(n, sub(mid, centroid)) >= 0 ? n : { x: -n.x, y: -n.y };
  const toCamera = normalize(sub(cameraPlan, mid));
  return dot(outward, toCamera) > threshold;
}
