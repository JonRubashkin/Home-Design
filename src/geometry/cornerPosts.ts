import type { Vec2, Wall } from "../model/types";
import { distance } from "./vec";
import { closestPointOnSegment } from "./wallSnap";

// A corner post fills the join where thick walls meet so corners read clean (no
// notch/overlap artifact) — NOT true mitering. Render-side only; no schema change.
export interface CornerPost {
  center: Vec2; // the shared junction point (plan coords)
  size: number; // square footprint side, ≈ max wall thickness at the corner
  height: number; // full height, = max wall height at the corner
  wallIds: string[]; // walls meeting at this junction (for cutaway facing)
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

// Junctions of 2+ walls and the post that covers each. Candidate junction points
// are all wall endpoints (deduped by coincidence); a point is a junction when two
// or more walls meet there. The post is sized to the thickest wall at the corner
// and as tall as the tallest, centered on the shared point.
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
    posts.push({
      center: { x: p.x, y: p.y },
      size: Math.max(...meeting.map((w) => w.thickness)),
      height: Math.max(...meeting.map((w) => w.height)),
      wallIds: meeting.map((w) => w.id),
    });
  }
  return posts;
}
