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

// Simplify a closed polygon with Ramer–Douglas–Peucker at tolerance `tol`
// (meters). Collapses fine staircase runs (e.g. a grid-traced diagonal wall)
// into single edges while preserving genuine corners (whose deviation exceeds
// `tol`). Used so an auto-roof footprint reflects the room's real shape: a true
// rectilinear room stays axis-aligned; an angled-walled room becomes diagonal
// (so it reads as non-rectilinear). Anchors at the most distant vertex pair.
export function simplifyPolygon(poly: Vec2[], tol: number): Vec2[] {
  const n = poly.length;
  if (n < 4) return poly.map((p) => ({ ...p }));
  let far = 0;
  let fd = -1;
  for (let i = 1; i < n; i++) {
    const dx = poly[i]!.x - poly[0]!.x;
    const dy = poly[i]!.y - poly[0]!.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > fd) {
      fd = d2;
      far = i;
    }
  }
  const first = poly.slice(0, far + 1);
  const second = poly.slice(far).concat([poly[0]!]);
  const a = rdp(first, tol);
  const b = rdp(second, tol);
  const out = a.slice(0, -1).concat(b.slice(0, -1));
  return out.length >= 3 ? out : poly.map((p) => ({ ...p }));
}

// RDP on an open polyline (first/last kept).
function rdp(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length < 3) return pts.map((p) => ({ ...p }));
  let maxD = -1;
  let idx = 0;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDistance(pts[i]!, a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [{ ...a }, { ...b }];
  const left = rdp(pts.slice(0, idx + 1), tol);
  const right = rdp(pts.slice(idx), tol);
  return left.slice(0, -1).concat(right);
}

function perpDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
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

function vertexCentroid(poly: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

// Does polygon `poly` have a vertex whose interior side lies inside `other`?
// Each vertex is nudged slightly toward its own centroid so a vertex merely
// shared on a boundary isn't counted (that's adjacency, not overlap).
function hasInteriorVertexInside(poly: Vec2[], other: Vec2[]): boolean {
  const c = vertexCentroid(poly);
  for (const v of poly) {
    const p = { x: v.x + (c.x - v.x) * 1e-3, y: v.y + (c.y - v.y) * 1e-3 };
    if (pointInPolygon(p, other)) return true;
  }
  return false;
}

// Do two polygons share any interior area? Edge-only touching (shared boundary,
// no overlap) does not count. Used so a newly drawn floor replaces the floors it
// covers instead of stacking coplanar meshes that z-fight in 3D.
export function polygonsOverlap(a: Vec2[], b: Vec2[]): boolean {
  if (hasInteriorVertexInside(a, b) || hasInteriorVertexInside(b, a))
    return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]!;
    const a2 = a[(i + 1) % a.length]!;
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j]!;
      const b2 = b[(j + 1) % b.length]!;
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

// Is `inner` fully covered by `outer`? (Every inner vertex inside outer and no
// inner edge leaves outer.) Used so a newly drawn floor removes only an old
// floor it completely covers; partially-overlapped floors are kept (and layered).
export function polygonContains(outer: Vec2[], inner: Vec2[]): boolean {
  const c = vertexCentroid(inner);
  for (const v of inner) {
    // Nudge toward the inner centroid so a vertex shared on the outer boundary
    // (e.g. redrawing the exact same region) still counts as inside.
    const p = { x: v.x + (c.x - v.x) * 1e-3, y: v.y + (c.y - v.y) * 1e-3 };
    if (!pointInPolygon(p, outer)) return false;
  }
  for (let i = 0; i < inner.length; i++) {
    const a1 = inner[i]!;
    const a2 = inner[(i + 1) % inner.length]!;
    for (let j = 0; j < outer.length; j++) {
      const b1 = outer[j]!;
      const b2 = outer[(j + 1) % outer.length]!;
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}
