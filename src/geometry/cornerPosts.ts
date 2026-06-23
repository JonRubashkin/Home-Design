import type { MaterialRef, Vec2, Wall } from "../model/types";
import { DEFAULT_PAINT } from "../model/defaults";
import { distance, dot, normalize, perpLeft, sub } from "./vec";
import { closestPointOnSegment } from "./wallSnap";
import { paintMaterialAtT, sameMaterial } from "./wallPaint";
import { projectPointToWallT } from "./windows";

// A corner post fills the join where thick walls meet so corners read clean (no
// notch/overlap artifact) — NOT true mitering. Render-side only; no schema change.
export interface CornerPost {
  center: Vec2; // post footprint center (plan coords). For a T-junction this is
  // offset off the through-wall centerline onto the stub side (see below).
  size: number; // square footprint side, ≈ max wall thickness at the corner
  height: number; // full height, = max wall height at the corner
  wallIds: string[]; // walls meeting at this junction (for cutaway facing)
  // Paint to match the connected wall's face adjacent to this corner; undefined
  // means "no painted wall to match" and the renderer uses its neutral fallback.
  material?: MaterialRef;
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

// Pick the paint the post should wear so it reads as part of the painted wall.
// Order (deterministic, documented): (1) for a T-junction, the through wall's
// stub-side adjacent face — the surface the post actually sits against; then
// (2) the thickest meeting wall's adjacent faces (ties broken by id), both sides.
// The first NON-default painted material wins; if every adjacent face is still
// the default paint, return undefined so the renderer falls back to neutral.
function cornerPostMaterial(
  meeting: Wall[],
  p: Vec2,
  throughWall: Wall | null,
  stubSide: "A" | "B" | null,
): MaterialRef | undefined {
  const candidates: MaterialRef[] = [];
  if (throughWall && stubSide) {
    candidates.push(adjacentPaint(throughWall, p, stubSide));
  }
  const ordered = [...meeting].sort(
    (a, b) =>
      b.thickness - a.thickness ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const w of ordered) {
    candidates.push(adjacentPaint(w, p, "A"), adjacentPaint(w, p, "B"));
  }
  for (const m of candidates) {
    if (!sameMaterial(m, DEFAULT_PAINT)) return m;
  }
  return undefined;
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
    let throughWall: Wall | null = null;
    let stubSide: "A" | "B" | null = null;

    if (through.length > 0 && stubs.length > 0) {
      // Use the thickest through wall to orient the offset.
      throughWall = through.reduce((a, b) => (b.thickness > a.thickness ? b : a));
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
        stubSide = sign > 0 ? "A" : "B";
      }
      // If stubs are balanced on both sides (s ≈ 0) the through wall is flanked
      // either way, so a centered square is correct — no far-empty side.
    }

    posts.push({
      center,
      size,
      height,
      wallIds: meeting.map((w) => w.id),
      material: cornerPostMaterial(meeting, p, throughWall, stubSide),
    });
  }
  return posts;
}
