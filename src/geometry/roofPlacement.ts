import type { Roof } from "../model/types";
import type { Bounds } from "./planview";
import type { Footprint } from "./furniture";

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
