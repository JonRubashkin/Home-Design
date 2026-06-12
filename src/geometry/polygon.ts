import type { Vec2 } from "../model/types";

// Signed area of a polygon (positive for one winding, negative for the other).
export function polygonArea(poly: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

// Do open segments p1p2 and p3p4 properly cross? Touching only at a shared
// endpoint does not count (so adjacent polygon edges aren't "intersections").
export function segmentsProperlyIntersect(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2,
): boolean {
  const d = (a: Vec2, b: Vec2, c: Vec2) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  // Strict straddle on both segments => a proper crossing.
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

// Does the closed polygon have any pair of non-adjacent edges that cross?
export function isPolygonSelfIntersecting(poly: Vec2[]): boolean {
  const n = poly.length;
  if (n < 4) return false; // a triangle can't self-intersect
  for (let i = 0; i < n; i++) {
    const a1 = poly[i]!;
    const a2 = poly[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // Skip edges that share a vertex (adjacent, including the wrap-around pair).
      if (j === i) continue;
      if (j === (i + 1) % n) continue;
      if ((j + 1) % n === i) continue;
      const b1 = poly[j]!;
      const b2 = poly[(j + 1) % n]!;
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

// A floor polygon is valid when it has >= 3 points, encloses real area, and
// doesn't cross itself.
export function isValidFloorPolygon(poly: Vec2[]): boolean {
  if (poly.length < 3) return false;
  if (Math.abs(polygonArea(poly)) < 1e-6) return false;
  return !isPolygonSelfIntersecting(poly);
}

// Even-odd ray cast: is the point inside the polygon?
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
