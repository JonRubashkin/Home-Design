import type { MaterialRef, PaintSpan, Wall, WallPaint } from "../model/types";
import { distancePointToSegment, wallLength } from "./wall";
import { projectPointToWallT } from "./windows";

// Per-segment wall-face paint (Phase 6.3 Part B). A wall side borders one or more
// rooms; splitting the face at the junctions where OTHER walls meet it lets paint
// stay within a single room. A side's paint is therefore either ONE material for
// the whole side (back-compat) OR a list of spans along the wall in t (0..1).
//
// `facePaintSpans` is the single source of truth both the 2D plan and the 3D
// preview read, so per-segment colors never drift between the two. The PaintSpan
// / WallPaint types live in model/types.ts (the data model) to avoid a cycle.

const EPS = 1e-6;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// t-distance below which two junction split points (or boundaries) coincide.
const T_EPS = 1e-4;
// How close (meters) another wall's endpoint must be to this wall's segment to
// count as a junction that splits the face. Endpoints are coincident after snap.
export const WALL_JUNCTION_TOL = 0.01;

export function isPaintSpans(p: WallPaint): p is PaintSpan[] {
  return Array.isArray(p);
}

export function sameMaterial(a: MaterialRef, b: MaterialRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "solid" && b.kind === "solid") return a.color === b.color;
  if (a.kind === "pattern" && b.kind === "pattern")
    return (
      a.pattern === b.pattern && a.colorA === b.colorA && a.colorB === b.colorB
    );
  return false;
}

// Normalize a side's paint into an ordered list of spans (in t). A plain
// MaterialRef becomes a single full-width span; an array is sorted/clamped.
export function facePaintSpans(paint: WallPaint): PaintSpan[] {
  if (!isPaintSpans(paint)) return [{ from: 0, to: 1, material: paint }];
  const spans = paint
    .map((s) => ({
      from: clamp01(s.from),
      to: clamp01(s.to),
      material: s.material,
    }))
    .filter((s) => s.to - s.from > EPS)
    .sort((a, b) => a.from - b.from);
  if (spans.length === 0)
    return [{ from: 0, to: 1, material: paint[0]!.material }];
  return spans;
}

// A single representative material for a side (e.g. the properties-panel chip or
// a structural skirt that can't show variation).
export function representativeFacePaint(paint: WallPaint): MaterialRef {
  return isPaintSpans(paint) ? facePaintSpans(paint)[0]!.material : paint;
}

// The material covering position `t` (0..1) on a side.
export function paintMaterialAtT(paint: WallPaint, t: number): MaterialRef {
  const spans = facePaintSpans(paint);
  const tc = clamp01(t);
  for (const s of spans) {
    if (tc >= s.from - EPS && tc <= s.to + EPS) return s.material;
  }
  return spans[spans.length - 1]!.material;
}

// Merge adjacent spans with equal material; collapse to a single MaterialRef when
// the whole side ends up one color (keeps existing single-material walls simple).
function normalize(spans: PaintSpan[]): WallPaint {
  const merged: PaintSpan[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (
      last &&
      Math.abs(last.to - s.from) < T_EPS &&
      sameMaterial(last.material, s.material)
    ) {
      last.to = s.to;
    } else {
      merged.push({ ...s });
    }
  }
  if (merged.length === 1) return merged[0]!.material;
  return merged;
}

// Paint the sub-segment [from, to] (t) of a side with `material`, keeping the
// rest of the side untouched. Returns the new side paint (collapsed to a plain
// material if the whole side becomes one color).
export function applyPaintSpan(
  paint: WallPaint,
  from: number,
  to: number,
  material: MaterialRef,
): WallPaint {
  const lo = clamp01(Math.min(from, to));
  const hi = clamp01(Math.max(from, to));
  if (hi - lo < EPS) return paint; // nothing to paint
  const base = facePaintSpans(paint);
  const out: PaintSpan[] = [];
  for (const s of base) {
    // Part of this base span left of the painted range.
    if (s.from < lo - EPS)
      out.push({ from: s.from, to: Math.min(s.to, lo), material: s.material });
    // Part right of the painted range.
    if (s.to > hi + EPS)
      out.push({ from: Math.max(s.from, hi), to: s.to, material: s.material });
  }
  out.push({ from: lo, to: hi, material });
  out.sort((a, b) => a.from - b.from);
  return normalize(out);
}

// Painted spans of a wall side as along-wall METER ranges (for 2D/3D rendering).
export function wallSidePaintRegions(
  wall: Wall,
  side: "A" | "B",
): { a: number; b: number; material: MaterialRef }[] {
  const L = wallLength(wall);
  const paint = side === "A" ? wall.paintA : wall.paintB;
  return facePaintSpans(paint).map((s) => ({
    a: s.from * L,
    b: s.to * L,
    material: s.material,
  }));
}

// Interior meter positions where the per-side paint changes (either side), for
// subdividing the 3D wall boxes so each box carries one paint material per side.
export function paintBoundariesMeters(wall: Wall): number[] {
  const L = wallLength(wall);
  const out: number[] = [];
  for (const side of ["A", "B"] as const) {
    for (const s of facePaintSpans(side === "A" ? wall.paintA : wall.paintB)) {
      for (const t of [s.from, s.to]) {
        const m = t * L;
        if (m > T_EPS && m < L - T_EPS && !out.some((o) => Math.abs(o - m) < T_EPS))
          out.push(m);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

// The t positions (0..1) where another wall's endpoint meets THIS wall's body —
// the junctions that split the face. Excludes this wall's own ends.
export function wallSplitTs(
  wall: Wall,
  others: Wall[],
  tol = WALL_JUNCTION_TOL,
): number[] {
  const L = wallLength(wall);
  if (L === 0) return [];
  const ts: number[] = [];
  for (const o of others) {
    for (const ep of [o.start, o.end]) {
      if (distancePointToSegment(ep, wall.start, wall.end) > tol) continue;
      const t = projectPointToWallT(wall, ep);
      if (t > T_EPS && t < 1 - T_EPS) ts.push(t);
    }
  }
  ts.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of ts) if (!out.some((o) => Math.abs(o - t) < T_EPS)) out.push(t);
  return out;
}

// The sub-segment [from, to] (t) bracketing `t`, between the nearest junctions
// (and the wall ends). Used by the Paint tool to paint just one room's portion.
export function bracketSpan(
  wall: Wall,
  others: Wall[],
  t: number,
): { from: number; to: number } {
  const splits = [0, ...wallSplitTs(wall, others), 1];
  const tc = clamp01(t);
  for (let i = 0; i < splits.length - 1; i++) {
    if (tc >= splits[i]! - EPS && tc <= splits[i + 1]! + EPS)
      return { from: splits[i]!, to: splits[i + 1]! };
  }
  return { from: 0, to: 1 };
}
