import type { Vec2, Wall } from "../model/types";
import { add, dot, scale, sub } from "./vec";
import { wallDirection, wallLength, wallNormal } from "./wall";

export interface Footprint {
  width: number; // local x extent (meters)
  depth: number; // local y extent (meters); +y is the item's FRONT
}

const DEG = Math.PI / 180;

// Rotate a vector by `deg` (SVG/plan convention: +deg is clockwise in the
// y-down plan, matching SVG `rotate()`).
export function rotateVec(v: Vec2, deg: number): Vec2 {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

// The four footprint corners of a placed item, in plan space.
export function footprintCorners(
  position: Vec2,
  rotation: number,
  fp: Footprint,
): Vec2[] {
  const hw = fp.width / 2;
  const hd = fp.depth / 2;
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((p) => add(position, rotateVec(p, rotation)));
}

// Rotation-aware point-in-footprint test.
export function pointInFootprint(
  point: Vec2,
  position: Vec2,
  rotation: number,
  fp: Footprint,
): boolean {
  const local = rotateVec(sub(point, position), -rotation);
  return Math.abs(local.x) <= fp.width / 2 && Math.abs(local.y) <= fp.depth / 2;
}

export const WALL_HUGGER_THRESHOLD = 0.3; // meters

export interface SnapResult {
  position: Vec2;
  rotation: number;
  snapped: boolean;
}

// Wall-hugger soft snap: if the item's back edge is within the threshold of a
// wall face (and the item sits beside that wall's span), push the back edge
// flush to the face and rotate so the item's FRONT (+y local) faces into the
// room. Pure; works for non-axis-aligned walls.
export function wallHuggerSnap(
  position: Vec2,
  rotation: number,
  fp: Footprint,
  walls: Wall[],
  threshold = WALL_HUGGER_THRESHOLD,
): SnapResult {
  let best: { centerToFace: number; nFace: Vec2; s: number; n: Vec2 } | null =
    null;

  for (const wall of walls) {
    const L = wallLength(wall);
    if (L === 0) continue;
    const dir = wallDirection(wall);
    const n = wallNormal(wall); // unit, points to side A
    const rel = sub(position, wall.start);
    const along = dot(rel, dir);
    if (along < 0 || along > L) continue; // item not beside this wall's span
    const s = dot(rel, n); // signed perpendicular distance to centerline
    const faceOffset = wall.thickness / 2;
    const centerToFace = Math.abs(s) - faceOffset;
    const backGap = centerToFace - fp.depth / 2;
    if (backGap > threshold) continue; // back edge too far from the face
    if (best === null || centerToFace < best.centerToFace) {
      const sign = s >= 0 ? 1 : -1;
      best = { centerToFace, nFace: scale(n, sign), s, n };
    }
  }

  if (!best) return { position, rotation, snapped: false };

  // Move perpendicular so the back edge becomes flush with the face. Moving
  // along n changes the signed distance s by the move amount, so:
  const sign = best.s >= 0 ? 1 : -1;
  const deltaS = sign * (fp.depth / 2 - best.centerToFace);
  const snappedPos = add(position, scale(best.n, deltaS));

  // Front (+y local) should point along the room-ward face normal.
  const rot = Math.atan2(-best.nFace.x, best.nFace.y) / DEG;
  return { position: snappedPos, rotation: rot, snapped: true };
}
