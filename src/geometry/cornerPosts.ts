import type { MaterialRef, Vec2, Wall } from "../model/types";
import { DEFAULT_PAINT } from "../model/defaults";
import { distance, dot, normalize, perpLeft, sub } from "./vec";
import { closestPointOnSegment } from "./wallSnap";
import { paintMaterialAtT, sameMaterial } from "./wallPaint";
import { projectPointToWallT } from "./windows";

// A corner post fills the join where thick walls meet so corners read clean (no
// notch/overlap artifact) — NOT true mitering. Render-side only; no schema change.
//
// Color is PER-FACE and SAME-SIDE ONLY (Phase 6.3 follow-up): each vertical face
// of the post is colored from the connecting wall's paint on the side that faces
// the SAME way as that face, never from the wall's opposite side — so an interior
// paint color can't bleed onto the post's exterior-facing side (or vice versa).
export interface CornerPost {
  center: Vec2; // post footprint center (plan coords). For a T-junction this is
  // offset off the through-wall centerline onto the stub side (see below).
  size: number; // square footprint side, ≈ max wall thickness at the corner
  height: number; // full height, = max wall height at the corner
  wallIds: string[]; // walls meeting at this junction (for cutaway facing)
  // Paint per vertical face, keyed by the face's outward direction in WORLD axes
  // (plan x→world x, plan y→world z): px=+x, nx=−x, pz=+z, nz=−z. Each is the
  // same-side connecting wall's adjacent paint, or undefined when that same-side
  // face is unpainted/default (the renderer uses its neutral fallback per face —
  // it never borrows the opposite side to avoid neutral).
  materials: CornerPostFaces;
}

export interface CornerPostFaces {
  px?: MaterialRef;
  nx?: MaterialRef;
  pz?: MaterialRef;
  nz?: MaterialRef;
}

const EPS = 1e-3;

// Does wall `w` meet point `p` — at one of its endpoints (L/X junction) or on the
// interior of its segment (a T-junction where another wall's endpoint snapped to
// this wall's face)? Endpoints are exact-coincident after wall-snap.
function wallMeets(w: Wall, p: Vec2): boolean {
  if (distance(p, w.start) <= EPS || distance(p, w.end) <= EPS) return true;
  const c = closestPointOnSegment(p, w.start, w.end);
  if (distance(p, c) > EPS) return false;
  // Interior only — endpoint coincidence is handled above.
  return distance(c, w.start) > EPS && distance(c, w.end) > EPS;
}

// Does `w` pass THROUGH `p` (interior meet → T-junction), as opposed to ending at
// it (endpoint meet → L/corner/stem)?
function meetsInterior(w: Wall, p: Vec2): boolean {
  if (distance(p, w.start) <= EPS || distance(p, w.end) <= EPS) return false;
  return distance(p, closestPointOnSegment(p, w.start, w.end)) <= EPS;
}

// The paint covering wall `w`'s face `side` at the point on it nearest `p`.
function adjacentPaint(w: Wall, p: Vec2, side: "A" | "B"): MaterialRef {
  const t = projectPointToWallT(w, p);
  return paintMaterialAtT(side === "A" ? w.paintA : w.paintB, t);
}

// The outward plan-space normal of wall side A (= left of start→end). Side B is
// the negation. perpLeft((1,0)) = (0,-1), so for a wall along +x side A faces −y.
function sideNormal(w: Wall, side: "A" | "B"): Vec2 {
  const a = perpLeft(normalize(sub(w.end, w.start)));
  return side === "A" ? a : { x: -a.x, y: -a.y };
}

// Color for ONE post face whose outward plan normal is `n`. Among the meeting
// walls, find the wall SIDE whose outward normal faces the same way as `n` (best
// alignment, dot > 0 — a wall running along `n` has both sides perpendicular to it
// and so contributes nothing) and use that side's segment adjacent to the corner.
// SAME-SIDE ONLY: a side is considered for a face only when it faces that way, so
// the opposite side never reaches across. Tiebreak when two walls present a face
// on the same side: the thickest wall's adjacent segment, else the first meeting
// wall (iteration order). If the chosen same-side face is default/unpainted, the
// face is left undefined so the renderer uses its neutral fallback (we do NOT
// borrow the opposite side just to avoid neutral).
function faceMaterial(meeting: Wall[], p: Vec2, n: Vec2): MaterialRef | undefined {
  let best: { dot: number; thickness: number; material: MaterialRef } | null =
    null;
  for (const w of meeting) {
    for (const side of ["A", "B"] as const) {
      const d = dot(sideNormal(w, side), n);
      if (d <= EPS) continue; // not facing this way → not same-side
      // Replace only on a STRICT improvement so equal dot + equal thickness keeps
      // the first meeting wall (deterministic tiebreak).
      if (
        !best ||
        d > best.dot + EPS ||
        (Math.abs(d - best.dot) <= EPS && w.thickness > best.thickness + EPS)
      ) {
        best = { dot: d, thickness: w.thickness, material: adjacentPaint(w, p, side) };
      }
    }
  }
  if (!best || sameMaterial(best.material, DEFAULT_PAINT)) return undefined;
  return best.material;
}

// The four vertical faces' same-side colors, keyed by world-axis outward normal.
function cornerPostFaces(meeting: Wall[], p: Vec2): CornerPostFaces {
  return {
    px: faceMaterial(meeting, p, { x: 1, y: 0 }),
    nx: faceMaterial(meeting, p, { x: -1, y: 0 }),
    pz: faceMaterial(meeting, p, { x: 0, y: 1 }),
    nz: faceMaterial(meeting, p, { x: 0, y: -1 }),
  };
}

// Junctions of 2+ walls and the post that covers each. Candidate junction points
// are all wall endpoints (deduped by coincidence); a point is a junction when two
// or more walls meet there. The post is sized to the thickest wall at the corner
// and as tall as the tallest.
//
// At a T-junction (one wall passing through `p`, the others ending against its
// face) the through wall is continuous, so the only real gap is on the side the
// stub(s) meet. A box centered on `p` would straddle the through-wall centerline
// and poke a stray face out the FAR side. So we offset the post fully onto the
// stub side (its back face flush with the centerline) — it fills the genuine gap
// without appearing behind the through wall. L/corners (all endpoint meets) keep
// the centered square that covers their outer-notch / inner-overlap.
export function cornerPosts(walls: Wall[]): CornerPost[] {
  const candidates: Vec2[] = [];
  for (const w of walls) candidates.push(w.start, w.end);

  const unique: Vec2[] = [];
  for (const p of candidates) {
    if (!unique.some((q) => distance(p, q) <= EPS)) unique.push(p);
  }

  const posts: CornerPost[] = [];
  for (const p of unique) {
    const meeting = walls.filter((w) => wallMeets(w, p));
    if (meeting.length < 2) continue;

    const size = Math.max(...meeting.map((w) => w.thickness));
    const height = Math.max(...meeting.map((w) => w.height));

    const through = meeting.filter((w) => meetsInterior(w, p));
    const stubs = meeting.filter((w) => !meetsInterior(w, p));

    let center: Vec2 = { x: p.x, y: p.y };

    if (through.length > 0 && stubs.length > 0) {
      // Use the thickest through wall to orient the offset.
      const throughWall = through.reduce((a, b) =>
        b.thickness > a.thickness ? b : a,
      );
      const n = perpLeft(normalize(sub(throughWall.end, throughWall.start)));
      // Net side of the stub walls along the through-wall normal.
      let s = 0;
      for (const w of stubs) {
        const far = distance(p, w.start) <= EPS ? w.end : w.start;
        s += dot(sub(far, p), n);
      }
      if (Math.abs(s) > EPS) {
        const sign = s > 0 ? 1 : -1; // +1 → stubs on side A, -1 → side B
        center = {
          x: p.x + n.x * sign * (size / 2),
          y: p.y + n.y * sign * (size / 2),
        };
      }
      // If stubs are balanced on both sides (s ≈ 0) the through wall is flanked
      // either way, so a centered square is correct — no far-empty side.
    }

    posts.push({
      center,
      size,
      height,
      wallIds: meeting.map((w) => w.id),
      materials: cornerPostFaces(meeting, p),
    });
  }
  return posts;
}
