import type { Bounds } from "./planview";
import { boundsOfPoints } from "./planview";
import { polygonArea, pointInPolygon } from "./polygon";
import type { Vec2 } from "../model/types";

// Roof geometry generated from the top level's footprint bounding rectangle
// (Phase 5e). A single rectangular roof over the bbox is correct for this phase;
// multi-section / L-shaped roofs are explicitly deferred (a non-rectangular
// footprint still gets one roof over its bounding rectangle).

export type RoofType = "flat" | "gabled" | "hipped" | "pitched";

// One planar polygon of the roof in WORLD space (x, y up, z). The renderer
// fan-triangulates each part and renders it double-sided.
export interface RoofPart {
  vertices: [number, number, number][];
}

export interface RoofResult {
  parts: RoofPart[];
  ridgeY: number; // peak world-Y (eave height for flat) — handy for framing
}

const DEG = Math.PI / 180;

// Build the roof parts. `bbox` is the footprint in plan coords (x→world x,
// y→world z); `baseY` is the eave height (top of the top level's walls). The bbox
// is expanded outward by `overhang` for the eaves. `pitch` (degrees) is ignored
// for a flat roof. The caller lifts `baseY` a hair above the wall tops (see
// `ROOF_LIFT`) so the roof never shares the wall-top plane and z-fights; for the
// flat type `thickness` (meters, default 0) gives the slab a real body. The
// sloped types ignore `thickness` (they already rise away from the eaves).
export function computeRoof(
  bbox: Bounds,
  type: RoofType,
  pitch: number,
  overhang: number,
  baseY: number,
  thickness = 0,
): RoofResult {
  const x0 = bbox.minX - overhang;
  const x1 = bbox.maxX + overhang;
  const z0 = bbox.minY - overhang;
  const z1 = bbox.maxY + overhang;
  const width = x1 - x0; // X extent
  const depth = z1 - z0; // Z extent
  const t = Math.tan(Math.max(0, pitch) * DEG);

  if (type === "flat") {
    // A real slab (not a paper-thin coplanar plane): the underside sits at the
    // lifted `baseY` (kept off the wall-top plane by the caller's ROOF_LIFT) and
    // the top is `thickness` above it, so the roof reads as a slab edge.
    const yb = baseY; // underside
    const yt = baseY + Math.max(0, thickness); // top
    return {
      ridgeY: yt,
      parts: [
        // Top + bottom faces.
        quad([x0, yt, z0], [x1, yt, z0], [x1, yt, z1], [x0, yt, z1]),
        quad([x0, yb, z1], [x1, yb, z1], [x1, yb, z0], [x0, yb, z0]),
        // Four side faces (the slab edge).
        quad([x0, yb, z0], [x1, yb, z0], [x1, yt, z0], [x0, yt, z0]),
        quad([x1, yb, z1], [x0, yb, z1], [x0, yt, z1], [x1, yt, z1]),
        quad([x0, yb, z1], [x0, yb, z0], [x0, yt, z0], [x0, yt, z1]),
        quad([x1, yb, z0], [x1, yb, z1], [x1, yt, z1], [x1, yt, z0]),
      ],
    };
  }

  if (type === "pitched") {
    // Single slope (shed) rising along +Z, eave-to-eave.
    const highY = baseY + depth * t;
    return {
      ridgeY: highY,
      parts: [
        // Sloped panel.
        quad([x0, baseY, z0], [x1, baseY, z0], [x1, highY, z1], [x0, highY, z1]),
        // Vertical gable on the high (z1) side.
        quad([x0, baseY, z1], [x0, highY, z1], [x1, highY, z1], [x1, baseY, z1]),
        // Triangular gable ends.
        tri([x0, baseY, z0], [x0, highY, z1], [x0, baseY, z1]),
        tri([x1, baseY, z0], [x1, baseY, z1], [x1, highY, z1]),
      ],
    };
  }

  // Gabled / hipped: ridge runs along the LONGER axis.
  const alongX = width >= depth;
  const halfSpan = (alongX ? depth : width) / 2;
  const ridgeY = baseY + halfSpan * t;

  if (type === "gabled") {
    if (alongX) {
      const zm = (z0 + z1) / 2;
      const R0: V = [x0, ridgeY, zm];
      const R1: V = [x1, ridgeY, zm];
      return {
        ridgeY,
        parts: [
          quad([x0, baseY, z0], [x1, baseY, z0], R1, R0), // slope to z0
          quad(R0, R1, [x1, baseY, z1], [x0, baseY, z1]), // slope to z1
          tri([x0, baseY, z0], R0, [x0, baseY, z1]), // gable at x0
          tri([x1, baseY, z0], [x1, baseY, z1], R1), // gable at x1
        ],
      };
    }
    const xm = (x0 + x1) / 2;
    const R0: V = [xm, ridgeY, z0];
    const R1: V = [xm, ridgeY, z1];
    return {
      ridgeY,
      parts: [
        quad([x0, baseY, z0], R0, R1, [x0, baseY, z1]), // slope to x0
        quad(R0, [x1, baseY, z0], [x1, baseY, z1], R1), // slope to x1
        tri([x0, baseY, z0], [x1, baseY, z0], R0), // gable at z0
        tri([x0, baseY, z1], R1, [x1, baseY, z1]), // gable at z1
      ],
    };
  }

  // Hipped: central ridge, inset by the half-span, with four slopes (two
  // trapezoids + two triangular hip ends).
  if (alongX) {
    const zm = (z0 + z1) / 2;
    const rx0 = x0 + halfSpan;
    const rx1 = x1 - halfSpan;
    const R0: V = [rx0, ridgeY, zm];
    const R1: V = [rx1, ridgeY, zm];
    return {
      ridgeY,
      parts: [
        quad([x0, baseY, z0], [x1, baseY, z0], R1, R0), // long slope to z0
        quad(R0, R1, [x1, baseY, z1], [x0, baseY, z1]), // long slope to z1
        tri([x0, baseY, z0], R0, [x0, baseY, z1]), // hip end at x0
        tri([x1, baseY, z0], [x1, baseY, z1], R1), // hip end at x1
      ],
    };
  }
  const xm = (x0 + x1) / 2;
  const rz0 = z0 + halfSpan;
  const rz1 = z1 - halfSpan;
  const R0: V = [xm, ridgeY, rz0];
  const R1: V = [xm, ridgeY, rz1];
  return {
    ridgeY,
    parts: [
      quad([x0, baseY, z0], R0, R1, [x0, baseY, z1]), // long slope to x0
      quad(R0, [x1, baseY, z0], [x1, baseY, z1], R1), // long slope to x1
      tri([x0, baseY, z0], [x1, baseY, z0], R0), // hip end at z0
      tri([x0, baseY, z1], R1, [x1, baseY, z1]), // hip end at z1
    ],
  };
}

type V = [number, number, number];
const quad = (a: V, b: V, c: V, d: V): RoofPart => ({ vertices: [a, b, c, d] });
const tri = (a: V, b: V, c: V): RoofPart => ({ vertices: [a, b, c] });

// ---------------------------------------------------------------------------
// Polygon-footprint roofs (Phase 6.2). An auto-generated roof covers a room's
// TRUE footprint (incl. L/T/U). Flat & pitched tile the whole polygon (so they
// cover ANY polygon, even angled, exactly); gabled & hipped rectilinear-
// decompose the footprint into rectangles and reuse `computeRoof` per rectangle
// (one piece each, all under the single roof object). Pieces meeting at inner
// corners show an APPROXIMATE ridge/valley join — true valley mitering stays
// deferred. A non-rectilinear (angled) footprint can't be decomposed, so
// gabled/hipped fall back to the bounding rectangle (the caller warns the user).
// ---------------------------------------------------------------------------

// True when every edge of the footprint is axis-aligned within `tolDeg`. A
// rectilinear polygon (rectangle, L, T, U…) can be decomposed into rectangles;
// an angled (diagonal-walled) one cannot. `tolDeg` is generous so a near-axis
// hand-drawn wall still reads as rectilinear.
export function isRectilinear(poly: Vec2[], tolDeg = 8): boolean {
  const tol = Math.tan(tolDeg * DEG); // max minor/major component ratio
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const maxc = Math.max(dx, dy);
    if (maxc < 1e-9) continue; // degenerate edge
    if (Math.min(dx, dy) / maxc > tol) return false; // diagonal edge
  }
  return true;
}

// Decompose a rectilinear polygon into axis-aligned rectangles by horizontal
// slabs: between each pair of consecutive distinct vertex Y values, scan the
// polygon's X crossings at the strip mid-line and pair them into spans. Robust
// for any rectilinear footprint regardless of point count (rect=1, L=2, U=3…).
export function decomposeRectilinear(poly: Vec2[]): Bounds[] {
  const ys = [...new Set(poly.map((p) => p.y))].sort((a, b) => a - b);
  const rects: Bounds[] = [];
  for (let i = 0; i + 1 < ys.length; i++) {
    const y0 = ys[i]!;
    const y1 = ys[i + 1]!;
    if (y1 - y0 < 1e-9) continue;
    const midY = (y0 + y1) / 2;
    const xs: number[] = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k]!;
      const b = poly[(k + 1) % poly.length]!;
      // A half-open crossing test so each edge counts once (even-odd pairing).
      if ((a.y <= midY && b.y > midY) || (b.y <= midY && a.y > midY)) {
        const t = (midY - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const xa = xs[m]!;
      const xb = xs[m + 1]!;
      if (xb - xa > 1e-9)
        rects.push({ minX: xa, maxX: xb, minY: y0, maxY: y1 });
    }
  }
  return rects;
}

// Offset a simple polygon outward by `d` (a miter/eave offset for the overhang).
// Each edge is pushed along its outward normal and adjacent offset lines are
// intersected. Outward is found by sampling the interior, so winding doesn't
// matter. Small `d` (≤ ~1.5 m overhang) keeps this well-behaved.
export function offsetPolygon(poly: Vec2[], d: number): Vec2[] {
  const n = poly.length;
  if (n < 3 || Math.abs(d) < 1e-9) return poly.map((p) => ({ ...p }));
  const off: { p: Vec2; dir: Vec2 }[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    let nx = ey / len;
    let ny = -ex / len;
    const mid = { x: (a.x + b.x) / 2 + nx * 1e-3, y: (a.y + b.y) / 2 + ny * 1e-3 };
    if (pointInPolygon(mid, poly)) {
      nx = -nx;
      ny = -ny;
    }
    off.push({ p: { x: a.x + nx * d, y: a.y + ny * d }, dir: { x: ex, y: ey } });
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = off[(i - 1 + n) % n]!;
    const cur = off[i]!;
    out.push(lineIntersect(prev.p, prev.dir, cur.p, cur.dir) ?? { ...cur.p });
  }
  return out;
}

function lineIntersect(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): Vec2 | null {
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-9) return null; // parallel
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denom;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

// Ear-clipping triangulation of a simple (possibly non-convex) polygon, so an
// L/T/U footprint's faces don't fan-triangulate across the notch. Returns index
// triples into `poly`.
export function triangulate(poly: Vec2[]): [number, number, number][] {
  const n = poly.length;
  if (n < 3) return [];
  const idx = [...Array(n).keys()];
  if (polygonArea(poly) < 0) idx.reverse(); // force CCW (cross > 0 = convex ear)
  const tris: [number, number, number][] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n + 10) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i - 1 + idx.length) % idx.length]!;
      const i1 = idx[i]!;
      const i2 = idx[(i + 1) % idx.length]!;
      const a = poly[i0]!;
      const b = poly[i1]!;
      const c = poly[i2]!;
      if (cross(a, b, c) <= 0) continue; // reflex / collinear → not an ear
      let contains = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTriangle(poly[j]!, a, b, c)) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      tris.push([i0, i1, i2]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // degenerate; stop to avoid a hang
  }
  if (idx.length === 3) tris.push([idx[0]!, idx[1]!, idx[2]!]);
  return tris;
}

const cross = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos); // inside or on edge
}

// Map a 2D footprint to roof faces (triangulated) at heights from `heightFn`.
function polyFaces(poly: Vec2[], heightFn: (p: Vec2) => number): RoofPart[] {
  return triangulate(poly).map(([a, b, c]) => ({
    vertices: [
      [poly[a]!.x, heightFn(poly[a]!), poly[a]!.y],
      [poly[b]!.x, heightFn(poly[b]!), poly[b]!.y],
      [poly[c]!.x, heightFn(poly[c]!), poly[c]!.y],
    ] as [V, V, V],
  }));
}

const polyBounds = (poly: Vec2[]): Bounds =>
  boundsOfPoints(poly) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };

// Build a roof over a polygon footprint. `footprint` is plan coords (x→world x,
// y→world z). Flat & pitched cover the whole polygon (overhang offsets it
// outward); gabled & hipped decompose a rectilinear polygon into rectangles
// (each via `computeRoof`) or, for an angled polygon, fall back to the bounding
// rectangle. The renderer fan-triangulates each part double-sided.
export function computePolygonRoof(
  footprint: Vec2[],
  type: RoofType,
  pitch: number,
  overhang: number,
  baseY: number,
  thickness = 0,
): RoofResult {
  if (footprint.length < 3) return { parts: [], ridgeY: baseY };
  const poly =
    overhang > 1e-9 ? offsetPolygon(footprint, overhang) : footprint;

  if (type === "flat") {
    const yb = baseY;
    const yt = baseY + Math.max(0, thickness);
    const parts: RoofPart[] = [
      ...polyFaces(poly, () => yt), // top
      ...polyFaces(poly, () => yb), // bottom
    ];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      parts.push(
        quad([a.x, yb, a.y], [b.x, yb, b.y], [b.x, yt, b.y], [a.x, yt, a.y]),
      );
    }
    return { ridgeY: yt, parts };
  }

  if (type === "pitched") {
    const bb = polyBounds(poly);
    const alongX = bb.maxX - bb.minX >= bb.maxY - bb.minY;
    const lo = alongX ? bb.minX : bb.minY;
    const t = Math.tan(Math.max(0, pitch) * DEG);
    const heightAt = (p: Vec2) => baseY + ((alongX ? p.x : p.y) - lo) * t;
    const parts = polyFaces(poly, heightAt);
    let ridgeY = baseY;
    for (const part of parts)
      for (const v of part.vertices) ridgeY = Math.max(ridgeY, v[1]);
    return { ridgeY, parts };
  }

  // Gabled / hipped: rectilinear-decompose, else bounding-rectangle fallback.
  if (isRectilinear(footprint)) {
    const rects = decomposeRectilinear(footprint);
    if (rects.length > 0) {
      const parts: RoofPart[] = [];
      let ridgeY = baseY;
      for (const rect of rects) {
        const r = computeRoof(rect, type, pitch, overhang, baseY);
        parts.push(...r.parts);
        ridgeY = Math.max(ridgeY, r.ridgeY);
      }
      return { parts, ridgeY };
    }
  }
  return computeRoof(polyBounds(footprint), type, pitch, overhang, baseY);
}
