import type { Vec2, Wall } from "../model/types";
import { wallLength, wallDirection } from "./wall";
import { dot, sub } from "./vec";

// A window must keep this clear margin from each wall end (meters).
export const WINDOW_END_MARGIN = 0.1;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

// Parameter t (0..1) of the closest point on the wall to p, clamped to the wall.
export function projectPointToWallT(
  wall: Pick<Wall, "start" | "end">,
  p: Vec2,
): number {
  const L = wallLength(wall);
  if (L === 0) return 0;
  const along = dot(sub(p, wall.start), wallDirection(wall));
  return clamp(along / L, 0, 1);
}

// Along-wall span [a, b] in meters for a window of `width` centred at `t`.
export function windowSpan(
  L: number,
  t: number,
  width: number,
): { a: number; b: number } {
  const c = t * L;
  return { a: c - width / 2, b: c + width / 2 };
}

export interface WindowValidity {
  ok: boolean;
  reason?: string;
}

export interface WindowCandidate {
  t: number;
  width: number;
  height: number;
  sillHeight: number;
}

// Validate a window against its wall: fits within the length (with end margins),
// doesn't overlap other windows, and doesn't exceed the wall height.
export function validateWindow(
  wall: Wall,
  win: WindowCandidate,
  excludeId?: string,
): WindowValidity {
  const L = wallLength(wall);
  if (win.width <= 0 || win.height <= 0)
    return { ok: false, reason: "Invalid size" };
  if (win.sillHeight < 0) return { ok: false, reason: "Sill below floor" };
  if (win.sillHeight + win.height > wall.height + 1e-9)
    return { ok: false, reason: "Taller than the wall" };

  const { a, b } = windowSpan(L, win.t, win.width);
  if (a < WINDOW_END_MARGIN - 1e-9)
    return { ok: false, reason: "Too close to the wall start" };
  if (b > L - WINDOW_END_MARGIN + 1e-9)
    return { ok: false, reason: "Too close to the wall end" };

  for (const other of wall.windows) {
    if (excludeId && other.id === excludeId) continue;
    const o = windowSpan(L, other.t, other.width);
    if (a < o.b - 1e-9 && b > o.a + 1e-9)
      return { ok: false, reason: "Overlaps another window" };
  }
  return { ok: true };
}

// Clamp t so a window of `width` stays within the wall's end margins (overlap is
// validated separately). Used while dragging a window along its wall.
export function clampWindowT(wall: Wall, width: number, t: number): number {
  const L = wallLength(wall);
  const half = width / 2;
  const min = (WINDOW_END_MARGIN + half) / L;
  const max = (L - WINDOW_END_MARGIN - half) / L;
  if (min > max) return 0.5; // window wider than the wall allows
  return clamp(t, min, max);
}

// Solid spans (piers) along the wall in meters, i.e. the wall with its window
// openings removed. Used to draw the broken wall outline in the 2D plan.
export function wallPlanSegments(wall: Wall): { a: number; b: number }[] {
  const L = wallLength(wall);
  const openings = wall.windows
    .map((w) => windowSpan(L, w.t, w.width))
    .map((s) => ({ a: clamp(s.a, 0, L), b: clamp(s.b, 0, L) }))
    .filter((s) => s.b - s.a > 1e-6)
    .sort((p, q) => p.a - q.a);

  const segs: { a: number; b: number }[] = [];
  let cursor = 0;
  for (const o of openings) {
    if (o.a > cursor + 1e-9) segs.push({ a: cursor, b: o.a });
    cursor = Math.max(cursor, o.b);
  }
  if (cursor < L - 1e-9) segs.push({ a: cursor, b: L });
  return segs;
}
