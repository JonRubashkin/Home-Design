import type { Vec2, Wall } from "../model/types";
import { add, dot, scale, sub } from "./vec";
import { wallDirection, wallLength, wallMidpoint, wallNormal } from "./wall";

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

// --- Automatic stacking ----------------------------------------------------
// A stackable item (microwave, lamp) whose footprint CENTER sits within a
// surface item's footprint rests on that surface's top instead of the floor.
// Surfaces can themselves rest on surfaces (transitive), so the resolution is
// recursive with a visited guard against cycles. Elevation is invisible in the
// top-down plan, so this is a pure render concern — no schema/persistence.

export interface StackItem {
  id: string;
  center: Vec2;
  rotation: number;
  footprint: Footprint; // already scaled
  flat: boolean; // rug-like (uses the flat floor lift)
  stackable: boolean; // climbs onto a surface it's centered over
  surfaceTop: number | null; // scaled top height where items rest, or null
}

// The base lifts (meters above the level floor) used when an item rests on the
// floor, on the flat layer (rugs), or on top of another item's surface.
export interface StackLifts {
  floor: number;
  flat: number;
  stack: number;
}

// Returns id -> world-Y-above-floor of each item's BASE, fully accounting for
// the per-layer lifts (so the value can be added straight to the level
// elevation by the renderer).
export function computeStackBaseLifts(
  items: StackItem[],
  lifts: StackLifts,
): Map<string, number> {
  const floorLift = (it: StackItem) => (it.flat ? lifts.flat : lifts.floor);

  const baseOf = (it: StackItem, visited: Set<string>): number => {
    if (!it.stackable || visited.has(it.id)) return floorLift(it);
    visited.add(it.id);
    let bestTop = 0;
    for (const other of items) {
      if (other.id === it.id || other.surfaceTop === null) continue;
      if (
        !pointInFootprint(
          it.center,
          other.center,
          other.rotation,
          other.footprint,
        )
      )
        continue;
      const top = baseOf(other, visited) + other.surfaceTop;
      if (top > bestTop) bestTop = top;
    }
    visited.delete(it.id);
    return bestTop > 0 ? bestTop + lifts.stack : floorLift(it);
  };

  return new Map(items.map((it) => [it.id, baseOf(it, new Set())]));
}

// --- Footprint collision (Phase 3c.2) --------------------------------------
// 2D-only: do two oriented (rotated + scaled) footprint rectangles overlap by
// more than `tolerance`? Uses the Separating Axis Theorem. No vertical stacking
// is considered here — this is footprint geometry only.

export interface OrientedFootprint {
  center: Vec2;
  rotation: number; // degrees (SVG/plan convention)
  footprint: Footprint; // already scaled
}

function projectOntoAxis(corners: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const c of corners) {
    const d = c.x * axis.x + c.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

// Unit outward normal of the edge p->q.
function edgeAxis(p: Vec2, q: Vec2): Vec2 {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

export function footprintsOverlap(
  a: OrientedFootprint,
  b: OrientedFootprint,
  tolerance = 0.02,
): boolean {
  const ca = footprintCorners(a.center, a.rotation, a.footprint);
  const cb = footprintCorners(b.center, b.rotation, b.footprint);
  const axes = [
    edgeAxis(ca[0]!, ca[1]!),
    edgeAxis(ca[1]!, ca[2]!),
    edgeAxis(cb[0]!, cb[1]!),
    edgeAxis(cb[1]!, cb[2]!),
  ];
  for (const axis of axes) {
    const [minA, maxA] = projectOntoAxis(ca, axis);
    const [minB, maxB] = projectOntoAxis(cb, axis);
    const gap = Math.max(minA - maxB, minB - maxA);
    // Separated, or overlapping by less than the tolerance -> not colliding.
    if (gap > -tolerance) return false;
  }
  return true;
}

export interface CollisionItem {
  id: string;
  collidable: boolean;
  footprint: OrientedFootprint;
}

// Ids of items that overlap at least one OTHER collidable item. Only collidable
// vs collidable pairs are considered; non-collidable items never collide.
export function collidingIds(
  items: CollisionItem[],
  tolerance = 0.02,
): Set<string> {
  const hits = new Set<string>();
  const c = items.filter((i) => i.collidable);
  for (let i = 0; i < c.length; i++) {
    for (let j = i + 1; j < c.length; j++) {
      if (footprintsOverlap(c[i]!.footprint, c[j]!.footprint, tolerance)) {
        hits.add(c[i]!.id);
        hits.add(c[j]!.id);
      }
    }
  }
  return hits;
}

// A wall as an oriented footprint (length × thickness, centered on its midpoint),
// so furniture/staircases can be collision-tested against it as a barrier. Walls
// are barriers only — they're never collision "subjects" themselves.
export function wallFootprint(wall: Wall): OrientedFootprint {
  const rot =
    (Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180) /
    Math.PI;
  return {
    center: wallMidpoint(wall),
    rotation: rot,
    footprint: { width: wallLength(wall), depth: wall.thickness },
  };
}

// Ids of collidable movable items (furniture/stairs) overlapping another movable
// OR a barrier (a wall). Barriers are not added to the result.
export function collidingMovableIds(
  movables: CollisionItem[],
  barriers: OrientedFootprint[],
  tolerance = 0.02,
): Set<string> {
  const hits = collidingIds(movables, tolerance);
  for (const m of movables) {
    if (!m.collidable || hits.has(m.id)) continue;
    for (const b of barriers) {
      if (footprintsOverlap(m.footprint, b, tolerance)) {
        hits.add(m.id);
        break;
      }
    }
  }
  return hits;
}
