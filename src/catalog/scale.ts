import type { Vec3 } from "../model/types";
import type { CatalogEntry, CatalogScaling } from "./types";

const clamp1 = (v: number, [lo, hi]: [number, number]) =>
  Math.max(lo, Math.min(hi, v));

export const UNIT_SCALE: Vec3 = { x: 1, y: 1, z: 1 };

// Clamp a requested scale to the catalog item's policy:
// - "none"    -> always 1 on every axis
// - "uniform" -> all axes equal, clamped to the uniform range
// - "axes"    -> each free axis clamped to its range; omitted axes locked to 1
export function clampScale(scaling: CatalogScaling, requested: Vec3): Vec3 {
  if (scaling.mode === "none") return { ...UNIT_SCALE };
  if (scaling.mode === "uniform") {
    const range = scaling.uniform ?? [1, 1];
    const s = clamp1(requested.x, range);
    return { x: s, y: s, z: s };
  }
  const ax = scaling.axes ?? {};
  return {
    x: ax.x ? clamp1(requested.x, ax.x) : 1,
    y: ax.y ? clamp1(requested.y, ax.y) : 1,
    z: ax.z ? clamp1(requested.z, ax.z) : 1,
  };
}

// The single source of truth for an item's real-world size: catalog footprint /
// height multiplied by the per-item scale. Every call site (3D mesh, plan
// symbol, hit-test, wall-hugger snap, properties read-out) must use this.
export function effectiveDimensions(
  entry: CatalogEntry,
  scale: Vec3,
): { width: number; depth: number; height: number } {
  return {
    width: entry.footprint.width * scale.x,
    depth: entry.footprint.depth * scale.z,
    height: entry.height * scale.y,
  };
}

// Height-aware collision inputs (Phase 4d Part C) for an item at the given
// scale: its mounted base elevation, scaled height, the scaled leg clearance (if
// leggy), and the scaled tuck height (defaulting to the full height when the
// entry omits one). Every collision call site builds its CollisionItem
// vertical/tuck fields from this. `base` is the floor-to-bottom elevation
// (`entry.baseHeight`, default 0) — an item that hangs above the floor (upper
// cabinet) reports its real base so its vertical extent sits above floor items.
// The base is an absolute mount height (anchored at the floor below), so it does
// NOT scale with the item's own y-scale; only the height does.
export function collisionExtent(
  entry: CatalogEntry,
  scale: Vec3,
): { base: number; height: number; legClearance?: number; tuckHeight: number } {
  return {
    base: entry.baseHeight ?? 0,
    height: entry.height * scale.y,
    legClearance:
      entry.legClearance != null ? entry.legClearance * scale.y : undefined,
    tuckHeight: (entry.tuckHeight ?? entry.height) * scale.y,
  };
}

// Inverse of one axis of effectiveDimensions: turn a desired real-world
// dimension (meters) into the scale multiplier for that axis, given the base
// (unscaled) dimension. Lets the properties panel accept typed meters; the
// result still passes through clampScale so out-of-range entries are clamped.
export function dimensionToMultiplier(meters: number, base: number): number {
  return base > 0 && isFinite(meters) ? meters / base : 1;
}
