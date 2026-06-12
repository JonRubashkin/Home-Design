import type { Vec2, Wall } from "../model/types";
import { distance, dot, normalize, perpLeft, sub } from "./vec";

export function wallLength(wall: Pick<Wall, "start" | "end">): number {
  return distance(wall.start, wall.end);
}

// Unit direction start->end. Zero-length walls return {0,0}.
export function wallDirection(wall: Pick<Wall, "start" | "end">): Vec2 {
  return normalize(sub(wall.end, wall.start));
}

// Unit normal pointing to side A (left of start->end direction).
export function wallNormal(wall: Pick<Wall, "start" | "end">): Vec2 {
  return perpLeft(wallDirection(wall));
}

// Midpoint of a wall in plan space.
export function wallMidpoint(wall: Pick<Wall, "start" | "end">): Vec2 {
  return {
    x: (wall.start.x + wall.end.x) / 2,
    y: (wall.start.y + wall.end.y) / 2,
  };
}

// Shortest distance from a point to a finite segment.
export function distancePointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  if (lenSq === 0) return distance(p, a);
  let t = dot(sub(p, a), ab) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return distance(p, closest);
}

// Nearest existing wall endpoint within radius, or null. Used so chained walls
// snap their corners exactly. Endpoint snap takes priority over grid snap.
export function nearestEndpoint(
  point: Vec2,
  walls: Wall[],
  radius: number,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = radius;
  for (const wall of walls) {
    for (const ep of [wall.start, wall.end]) {
      const d = distance(point, ep);
      if (d <= bestDist) {
        bestDist = d;
        best = ep;
      }
    }
  }
  return best ? { ...best } : null;
}

// True when point is within the wall's thick body (thickness/2) plus tolerance.
export function hitTestWall(point: Vec2, wall: Wall, tolerance = 0): boolean {
  const d = distancePointToSegment(point, wall.start, wall.end);
  return d <= wall.thickness / 2 + tolerance;
}
