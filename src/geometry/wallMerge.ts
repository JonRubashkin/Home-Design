import type { MaterialRef, Wall } from "../model/types";
import { DEFAULT_PAINT } from "../model/defaults";
import { distance, dot, sub } from "./vec";
import { wallDirection, wallLength } from "./wall";
import { WALL_SNAP_TOLERANCE } from "./wallSnap";

// Auto-merge of collinear, OVERLAPPING walls (Phase 6.3 Part A). When the user
// draws a rectangle inside another so edges coincide, two collinear walls end up
// in the same place; an opening cut in one still shows the other wall solid
// behind it. This module resolves any collinear overlapping pair into a single
// wall covering the shared run exactly once — preserving the survivor's
// properties and carrying ALL openings (windows, doors, mounts) from both walls.
//
// IMPORTANT: only collinear + overlapping pairs merge. Walls that merely TOUCH at
// an endpoint (a normal corner or chain) or run parallel-but-offset are left
// alone. Pure + idempotent; the store runs it after wall-mutating actions.

// Two collinear spans must overlap by more than this (meters) to merge — so
// touching endpoints (overlap ≈ 0) are NOT treated as an overlap.
const OVERLAP_EPS = 1e-4;
// t-distance below which two re-parameterized openings count as the same spot.
const DEDUP_T = 1e-3;

// Signed z of the 2D cross product (a × b).
function crossZ(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.y - a.y * b.x;
}

// Perpendicular distance from p to the infinite line through `a` with unit `dir`.
function perpDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  dir: { x: number; y: number },
): number {
  return Math.abs(crossZ(sub(p, a), dir));
}

function sameMaterial(a: MaterialRef, b: MaterialRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "solid" && b.kind === "solid") return a.color === b.color;
  if (a.kind === "pattern" && b.kind === "pattern")
    return (
      a.pattern === b.pattern && a.colorA === b.colorA && a.colorB === b.colorB
    );
  return false;
}

function isDefaultPaint(m: MaterialRef): boolean {
  return sameMaterial(m, DEFAULT_PAINT);
}

// Keep a painted (non-default) color over a default one; otherwise keep the first.
function preferPainted(a: MaterialRef, b: MaterialRef): MaterialRef {
  if (!isDefaultPaint(a)) return a;
  if (!isDefaultPaint(b)) return b;
  return a;
}

// Are two walls collinear (within tolerance) AND do their spans overlap (beyond
// merely touching at an endpoint)? Only such pairs are merged.
export function wallsMergeable(
  w1: Wall,
  w2: Wall,
  tol = WALL_SNAP_TOLERANCE,
): boolean {
  const L1 = wallLength(w1);
  const L2 = wallLength(w2);
  if (L1 === 0 || L2 === 0) return false;
  const dir1 = wallDirection(w1);
  // Collinear: both of w2's endpoints lie on w1's infinite line.
  if (perpDistance(w2.start, w1.start, dir1) > tol) return false;
  if (perpDistance(w2.end, w1.start, dir1) > tol) return false;
  // Overlap of the projected spans along dir1.
  const p2a = dot(sub(w2.start, w1.start), dir1);
  const p2b = dot(sub(w2.end, w1.start), dir1);
  const lo2 = Math.min(p2a, p2b);
  const hi2 = Math.max(p2a, p2b);
  const overlap = Math.min(L1, hi2) - Math.max(0, lo2);
  return overlap > OVERLAP_EPS;
}

// Re-parameterize an opening's center `t` (0..1 along `src`) onto the merged wall
// (origin `start`, unit `u`, length `Lm`).
function reparamT(
  src: Pick<Wall, "start" | "end">,
  t: number,
  start: { x: number; y: number },
  u: { x: number; y: number },
  Lm: number,
): number {
  const dir = wallDirection(src);
  const L = wallLength(src);
  const center = { x: src.start.x + dir.x * t * L, y: src.start.y + dir.y * t * L };
  const along = dot(sub(center, start), u) / Lm;
  return Math.max(0, Math.min(1, along));
}

// Merge two known-mergeable walls into one wall covering the union of their spans.
// Properties: thicker thickness, taller height, painted-over-default paint per
// side. ALL openings from both walls are carried onto the survivor with their `t`
// re-parameterized (and door swing/mount face flipped if a source wall runs
// opposite to the merged direction) so they stay at the same world position.
export function mergeWallPair(w1: Wall, w2: Wall): Wall {
  const dir1 = wallDirection(w1);
  const L1 = wallLength(w1);
  const candidates = [
    { p: w1.start, proj: 0 },
    { p: w1.end, proj: L1 },
    { p: w2.start, proj: dot(sub(w2.start, w1.start), dir1) },
    { p: w2.end, proj: dot(sub(w2.end, w1.start), dir1) },
  ];
  let lo = candidates[0]!;
  let hi = candidates[0]!;
  for (const c of candidates) {
    if (c.proj < lo.proj) lo = c;
    if (c.proj > hi.proj) hi = c;
  }
  const start = { x: lo.p.x, y: lo.p.y };
  const end = { x: hi.p.x, y: hi.p.y };
  const Lm = distance(start, end);
  const u = wallDirection({ start, end });

  const aligned = (w: Wall) => dot(wallDirection(w), u) >= 0;
  // Map each wall's A/B paint onto the merged orientation (a reversed wall's
  // side A becomes the merged side B).
  const a1 = aligned(w1);
  const a2 = aligned(w2);
  const paintA = preferPainted(
    a1 ? w1.paintA : w1.paintB,
    a2 ? w2.paintA : w2.paintB,
  );
  const paintB = preferPainted(
    a1 ? w1.paintB : w1.paintA,
    a2 ? w2.paintB : w2.paintA,
  );

  const flipFace = (f: "A" | "B"): "A" | "B" => (f === "A" ? "B" : "A");
  const flipHinge = (h: "start" | "end"): "start" | "end" =>
    h === "start" ? "end" : "start";

  const windows: Wall["windows"] = [];
  const doors: Wall["doors"] = [];
  const mounts: Wall["mounts"] = [];
  for (const w of [w1, w2]) {
    const rev = !aligned(w);
    for (const win of w.windows) {
      windows.push({ ...win, t: reparamT(w, win.t, start, u, Lm) });
    }
    for (const d of w.doors) {
      doors.push({
        ...d,
        t: reparamT(w, d.t, start, u, Lm),
        ...(rev ? { hinge: flipHinge(d.hinge), swing: flipFace(d.swing) } : {}),
      });
    }
    for (const m of w.mounts) {
      mounts.push({
        ...m,
        t: reparamT(w, m.t, start, u, Lm),
        ...(rev ? { face: flipFace(m.face) } : {}),
      });
    }
  }

  return {
    id: w1.id,
    start,
    end,
    thickness: Math.max(w1.thickness, w2.thickness),
    height: Math.max(w1.height, w2.height),
    paintA,
    paintB,
    windows: dedupOpenings(windows, (x) => x.width),
    doors: dedupOpenings(doors, (x) => x.width),
    mounts: dedupOpenings(mounts, () => 0, (x) => x.catalogId + ":" + x.face),
  };
}

// Drop openings that landed at the same spot (same `t`, same size signature) as
// an earlier one — so a shared run that existed on both walls isn't doubled.
function dedupOpenings<T extends { t: number }>(
  items: T[],
  size: (x: T) => number,
  tag: (x: T) => string = () => "",
): T[] {
  const out: T[] = [];
  for (const it of items) {
    const dup = out.some(
      (o) =>
        Math.abs(o.t - it.t) < DEDUP_T &&
        Math.abs(size(o) - size(it)) < 1e-6 &&
        tag(o) === tag(it),
    );
    if (!dup) out.push(it);
  }
  return out;
}

// Resolve all collinear/overlapping walls in a set into non-overlapping coverage.
// Returns the cleaned wall list and whether any merge happened. Idempotent:
// re-running on an already-clean set changes nothing and reports merged=false.
export function resolveWallOverlaps(walls: Wall[]): {
  walls: Wall[];
  merged: boolean;
} {
  const out = [...walls];
  let merged = false;
  let again = true;
  while (again) {
    again = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (wallsMergeable(out[i]!, out[j]!)) {
          const m = mergeWallPair(out[i]!, out[j]!);
          out.splice(j, 1);
          out[i] = m;
          merged = true;
          again = true;
          break outer;
        }
      }
    }
  }
  return { walls: out, merged };
}
