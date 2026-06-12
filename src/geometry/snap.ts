import type { Vec2 } from "../model/types";
import { GRID_SNAP } from "../model/defaults";
import { dot, length, normalize, scale, sub, add } from "./vec";

// Round away binary-float drift so snapped coords stay clean (e.g. exactly 3.4,
// not 3.4000000000000004). Matters for endpoint-snap equality and display.
function clean(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

// Snap a plan-space point to the 0.1 m grid.
export function snapToGrid(p: Vec2, grid: number = GRID_SNAP): Vec2 {
  return {
    x: clean(Math.round(p.x / grid) * grid),
    y: clean(Math.round(p.y / grid) * grid),
  };
}

// Constrain p so the segment start->p lies on the nearest 0/45/90° direction.
// The result is the projection of p onto that direction's ray from start, which
// keeps the endpoint close to the cursor. Caller still grid-snaps the result.
export function constrainAngle(start: Vec2, p: Vec2): Vec2 {
  const v = sub(p, start);
  const len = length(v);
  if (len === 0) return { ...start };

  // Snap the angle to the nearest multiple of 45° (atan2 uses +y-down screen
  // space, which is fine — the eight 45° directions are symmetric).
  const angle = Math.atan2(v.y, v.x);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  const dir = { x: Math.cos(snapped), y: Math.sin(snapped) };

  // Project v onto the snapped direction (non-negative since dir is nearest).
  const proj = Math.max(0, dot(v, dir));
  return add(start, scale(normalize(dir), proj));
}
