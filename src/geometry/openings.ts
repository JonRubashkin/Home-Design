import type { Wall } from "../model/types";
import { wallLength } from "./wall";
import { windowSpan } from "./windows";

// Opening-overlap detection (Phase 6.1 Part B). Unlike the placement validators
// (which only compare the OPENING HOLE spans), this compares each opening's
// VISIBLE / occupied span, which differs by style: a SLIDING door's panel parks
// to one side of the hole, so it occupies space the hole doesn't. This is a
// warning-only signal — it never blocks or clamps.

// Minimal shape of an opening needed to compute its occupied span.
export interface OpeningSpanInput {
  t: number; // center along the wall, 0..1
  width: number; // hole width in meters
  // Window styles never shift the span; only a door "sliding" style does.
  style?: string;
}

// Occupied span [lo, hi] in meters along the wall for one opening. For windows
// and swinging (single/double) doors this equals the hole span. A SLIDING door
// also occupies the parked-panel zone one door-width toward the wall start
// (clamped to the wall start), matching how the panel renders in plan and 3D.
export function openingOccupiedSpan(
  L: number,
  opening: OpeningSpanInput,
): { lo: number; hi: number } {
  const { a, b } = windowSpan(L, opening.t, opening.width);
  if (opening.style === "sliding") {
    return { lo: Math.max(0, a - opening.width), hi: b };
  }
  return { lo: a, hi: b };
}

// A small tolerance (meters) so merely-touching edges don't count as overlap.
const OVERLAP_TOL = 1e-6;

// Do two openings on the SAME wall (length L) overlap along the wall, accounting
// for each one's style-dependent occupied span? Touching edges do not overlap.
export function openingsOverlap(
  L: number,
  a: OpeningSpanInput,
  b: OpeningSpanInput,
  tolerance = OVERLAP_TOL,
): boolean {
  const sa = openingOccupiedSpan(L, a);
  const sb = openingOccupiedSpan(L, b);
  return sa.lo < sb.hi - tolerance && sb.lo < sa.hi - tolerance;
}

// Ids of openings (windows + doors) on a wall whose occupied spans overlap at
// least one OTHER opening on the same wall — the set to warn-tint. Windows and
// doors are checked together (any two openings can overlap).
export function overlappingOpeningIds(
  wall: Wall,
  tolerance = OVERLAP_TOL,
): Set<string> {
  const L = wallLength(wall);
  const spans = [
    ...wall.windows.map((w) => ({
      id: w.id,
      ...openingOccupiedSpan(L, w),
    })),
    ...(wall.doors ?? []).map((d) => ({
      id: d.id,
      ...openingOccupiedSpan(L, d),
    })),
  ];
  const hits = new Set<string>();
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const p = spans[i]!;
      const q = spans[j]!;
      if (p.lo < q.hi - tolerance && q.lo < p.hi - tolerance) {
        hits.add(p.id);
        hits.add(q.id);
      }
    }
  }
  return hits;
}
