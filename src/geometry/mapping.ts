import type { Vec2 } from "../model/types";

// Plan space (x, y) maps to world space (x, 0, y); a level's elevation offsets
// world Y. Three.js is Y-up. Verified here for Phase 1b's 3D preview to inherit.
export function planToWorld(
  p: Vec2,
  elevation: number,
): [number, number, number] {
  return [p.x, elevation, p.y];
}
