import type { Vec2, Wall } from "../model/types";
import { distance, dot, sub } from "./vec";

// How close (meters) a wall endpoint must be to another endpoint or wall face to
// fuse onto it. Applied across every wall create/edit path: freehand drawing, the
// rectangle/room tool, endpoint dragging, and copy-to-floor-above.
export const WALL_SNAP_TOLERANCE = 0.2;

export type WallSnapKind = "endpoint" | "segment" | "none";

export interface WallSnap {
  point: Vec2;
  kind: WallSnapKind;
}

// Nearest point on the finite segment a→b.
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  if (lenSq === 0) return { x: a.x, y: a.y };
  let t = dot(sub(p, a), ab) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

export function endpointsCoincident(
  a: Vec2,
  b: Vec2,
  tolerance = WALL_SNAP_TOLERANCE,
): boolean {
  return distance(a, b) <= tolerance;
}

// Snap a wall endpoint, in priority order:
//   1. onto an existing wall endpoint within tolerance (exact coincidence);
//   2. else onto the nearest point of a wall segment (T-junction);
//   3. else leave it (caller falls back to grid snap).
export function snapEndpoint(
  point: Vec2,
  walls: Wall[],
  tolerance = WALL_SNAP_TOLERANCE,
): WallSnap {
  let bestEp: Vec2 | null = null;
  let bestEpD = tolerance;
  for (const w of walls) {
    for (const ep of [w.start, w.end]) {
      const d = distance(point, ep);
      if (d <= bestEpD) {
        bestEpD = d;
        bestEp = ep;
      }
    }
  }
  if (bestEp) return { point: { x: bestEp.x, y: bestEp.y }, kind: "endpoint" };

  let bestSeg: Vec2 | null = null;
  let bestSegD = tolerance;
  for (const w of walls) {
    const c = closestPointOnSegment(point, w.start, w.end);
    const d = distance(point, c);
    if (d <= bestSegD) {
      bestSegD = d;
      bestSeg = c;
    }
  }
  if (bestSeg) return { point: bestSeg, kind: "segment" };

  return { point: { x: point.x, y: point.y }, kind: "none" };
}
