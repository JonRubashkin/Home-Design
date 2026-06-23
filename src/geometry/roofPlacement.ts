import type { Roof, Vec2 } from "../model/types";
import type { Bounds } from "./planview";
import type { Footprint } from "./furniture";
import { pointInFootprint, footprintCorners } from "./furniture";
import { pointInPolygon } from "./polygon";

// Manual roof placement helpers (Phase 5.2). A `Roof` is a rectangle the user
// drags out: centered at `position`, sized width × depth, oriented by `rotation`.
// The 3D renderer builds the roof over the LOCAL (centered, axis-aligned)
// rectangle via `computeRoof`, then a parent group applies the position +
// rotation — so these helpers stay pure and the rotation math lives in three.

// The roof rectangle's local axis-aligned bounds, centered on the origin. Fed to
// `computeRoof` (whose `overhang` then expands the eaves outward symmetrically).
export function roofLocalBounds(roof: Pick<Roof, "width" | "depth">): Bounds {
  return {
    minX: -roof.width / 2,
    maxX: roof.width / 2,
    minY: -roof.depth / 2,
    maxY: roof.depth / 2,
  };
}

// The roof's plan footprint (width × depth) for hit-testing and bounds. The
// overhang is intentionally excluded so selection matches the drawn rectangle.
export function roofFootprint(roof: Pick<Roof, "width" | "depth">): Footprint {
  return { width: roof.width, depth: roof.depth };
}

// Is `point` inside the roof for selection? A rect roof uses its rotated
// rectangle; a polygon roof uses its (static) footprint outline.
export function roofContainsPoint(roof: Roof, point: Vec2): boolean {
  if (roof.shape === "polygon" && roof.footprint && roof.footprint.length >= 3)
    return pointInPolygon(point, roof.footprint);
  return pointInFootprint(point, roof.position, roof.rotation, roofFootprint(roof));
}

// The plan-coord corners/points that frame a roof (for fit-view bounds): a rect
// roof's rotated corners, or a polygon roof's footprint vertices.
export function roofFramePoints(roof: Roof): Vec2[] {
  if (roof.shape === "polygon" && roof.footprint) return roof.footprint;
  return footprintCorners(roof.position, roof.rotation, roofFootprint(roof));
}
