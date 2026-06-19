import type { Vec2, Wall } from "../model/types";
import { GRID_SNAP } from "../model/defaults";
import { boundsOfPoints, type Bounds } from "./planview";
import { distancePointToSegment } from "./wall";
import { pointInPolygon } from "./polygon";
import {
  makeGrid,
  rasterizeWalls,
  flood,
  traceContour,
  cellCenter,
  type Grid,
} from "./roomFill";

// Roof mass detection + rectilinear decomposition (Phase 5.1).
//
// A "mass" is a connected group of walls (by shared endpoints / T-junctions) and
// the outer footprint polygon it encloses. Each mass is roofed by one roof
// section; a non-rectangular (L/T/U) footprint is split into axis-aligned
// rectangles so the section's single type/pitch produces matching roof pieces
// that meet at ridges/valleys. We reuse the room flood-fill / boundary trace from
// roomFill.ts so the footprint outline matches the room detector exactly.

const ENDPOINT_EPS = 1e-3; // endpoints within this distance are "the same"
const T_TOL = 0.05; // meters: an endpoint this close to a segment is a T-junction
const MASS_MARGIN = 1.0; // meters of exterior buffer so the grid corner is clear
const RECT_EPS = 1e-6;

export interface RoofMass {
  anchor: Vec2; // a representative INTERIOR point of the mass (inside footprint)
  footprint: Vec2[]; // outer rectilinear boundary polygon (plan coords)
}

// Group walls into connected components by shared endpoints, also joining
// T-junctions (an endpoint lying on another wall's segment). Disjoint wall groups
// (e.g. a house + a detached garage) come out as separate components.
function connectedComponents(walls: Wall[]): Wall[][] {
  const parent = walls.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const key = (p: Vec2) =>
    `${Math.round(p.x / ENDPOINT_EPS)},${Math.round(p.y / ENDPOINT_EPS)}`;

  // Shared endpoints.
  const endpointMap = new Map<string, number>();
  walls.forEach((w, i) => {
    for (const p of [w.start, w.end]) {
      const k = key(p);
      const j = endpointMap.get(k);
      if (j !== undefined) union(i, j);
      else endpointMap.set(k, i);
    }
  });

  // T-junctions: an endpoint of one wall touching the body of another.
  for (let i = 0; i < walls.length; i++) {
    for (let j = 0; j < walls.length; j++) {
      if (i === j || find(i) === find(j)) continue;
      const w = walls[i]!;
      const o = walls[j]!;
      if (
        distancePointToSegment(w.start, o.start, o.end) <= T_TOL ||
        distancePointToSegment(w.end, o.start, o.end) <= T_TOL
      ) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, Wall[]>();
  walls.forEach((w, i) => {
    const r = find(i);
    const arr = groups.get(r);
    if (arr) arr.push(w);
    else groups.set(r, [w]);
  });
  return [...groups.values()];
}

// Outer footprint polygon + interior anchor of one connected wall component.
// The footprint = every grid cell NOT reachable by an exterior flood (walls plus
// any space they enclose), whose boundary is traced into a rectilinear polygon.
function footprintOfComponent(walls: Wall[], cell: number): RoofMass | null {
  const pts = walls.flatMap((w) => [w.start, w.end]);
  const bb = boundsOfPoints(pts);
  if (!bb) return null;
  const bounds: Bounds = {
    minX: bb.minX - MASS_MARGIN,
    minY: bb.minY - MASS_MARGIN,
    maxX: bb.maxX + MASS_MARGIN,
    maxY: bb.maxY + MASS_MARGIN,
  };
  const g = makeGrid(bounds, cell);
  const barrier = rasterizeWalls(walls, g);
  // The top-left corner is exterior thanks to the margin; flood it to mark all
  // exterior-reachable open cells.
  const ext = flood(barrier, g, { c: 0, r: 0 });
  const mask = new Uint8Array(g.cols * g.rows);
  for (let i = 0; i < mask.length; i++) mask[i] = ext.interior[i] ? 0 : 1;
  const footprint = traceContour(mask, g);
  if (footprint.length < 3) return null;
  return { anchor: representativePoint(mask, g, footprint), footprint };
}

// Pick a point strictly inside the footprint polygon, near its centroid (so it
// reliably re-associates the mass with a roof section across edits).
function representativePoint(mask: Uint8Array, g: Grid, footprint: Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  for (const p of footprint) {
    cx += p.x;
    cy += p.y;
  }
  cx /= footprint.length;
  cy /= footprint.length;
  const centroid = { x: cx, y: cy };
  if (pointInPolygon(centroid, footprint)) return centroid;
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!mask[r * g.cols + c]) continue;
      const ctr = cellCenter(g, c, r);
      if (!pointInPolygon(ctr, footprint)) continue;
      const d = (ctr.x - cx) ** 2 + (ctr.y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = ctr;
      }
    }
  }
  return best ?? centroid;
}

// Detect every roof mass on a level's walls: one per connected wall component.
export function detectMasses(walls: Wall[], cell = GRID_SNAP): RoofMass[] {
  const masses: RoofMass[] = [];
  for (const group of connectedComponents(walls)) {
    const m = footprintOfComponent(group, cell);
    if (m) masses.push(m);
  }
  return masses;
}

// Is every edge of the polygon axis-aligned?
function isRectilinear(poly: Vec2[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (Math.abs(a.x - b.x) > RECT_EPS && Math.abs(a.y - b.y) > RECT_EPS)
      return false;
  }
  return true;
}

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]!) > RECT_EPS)
      out.push(v);
  }
  return out;
}

// Decompose a rectilinear footprint polygon into axis-aligned rectangles (a roof
// piece per rectangle). Builds the grid of all vertex x/y lines, marks the cells
// whose centre is inside the polygon, then greedily merges them into maximal
// rectangles. Non-rectilinear (angled) footprints fall back to a single bounding
// rectangle — acceptable per Phase 5.1 (exact angled roofs are deferred).
export function decomposeRectangles(polygon: Vec2[]): Bounds[] {
  const bb = boundsOfPoints(polygon);
  if (!bb) return [];
  if (polygon.length < 4 || !isRectilinear(polygon)) return [bb];

  const xs = uniqueSorted(polygon.map((p) => p.x));
  const ys = uniqueSorted(polygon.map((p) => p.y));
  const ncols = xs.length - 1;
  const nrows = ys.length - 1;
  if (ncols < 1 || nrows < 1) return [bb];

  const filled = new Uint8Array(ncols * nrows);
  for (let r = 0; r < nrows; r++) {
    for (let c = 0; c < ncols; c++) {
      const cx = (xs[c]! + xs[c + 1]!) / 2;
      const cy = (ys[r]! + ys[r + 1]!) / 2;
      if (pointInPolygon({ x: cx, y: cy }, polygon)) filled[r * ncols + c] = 1;
    }
  }

  const used = new Uint8Array(ncols * nrows);
  const rects: Bounds[] = [];
  for (let r = 0; r < nrows; r++) {
    for (let c = 0; c < ncols; c++) {
      const idx = r * ncols + c;
      if (!filled[idx] || used[idx]) continue;
      // Extend right across filled, unused cells.
      let c1 = c;
      while (
        c1 + 1 < ncols &&
        filled[r * ncols + c1 + 1] &&
        !used[r * ncols + c1 + 1]
      )
        c1++;
      // Extend down while the whole [c..c1] band stays filled and unused.
      let r1 = r;
      let canExtend = true;
      while (canExtend && r1 + 1 < nrows) {
        for (let cc = c; cc <= c1; cc++) {
          const ii = (r1 + 1) * ncols + cc;
          if (!filled[ii] || used[ii]) {
            canExtend = false;
            break;
          }
        }
        if (canExtend) r1++;
      }
      for (let rr = r; rr <= r1; rr++)
        for (let cc = c; cc <= c1; cc++) used[rr * ncols + cc] = 1;
      rects.push({
        minX: xs[c]!,
        minY: ys[r]!,
        maxX: xs[c1 + 1]!,
        maxY: ys[r1 + 1]!,
      });
    }
  }
  return rects.length > 0 ? rects : [bb];
}
