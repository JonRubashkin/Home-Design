import type { Vec2 } from "../model/types";
import { polygonsOverlap } from "./polygon";

// Which stairwell opening rectangles cut a hole in a given floor polygon.
//
// A level's floor (its slab / drawn floor regions) opens over the stairwell that
// rises from the level BELOW. The mask is authoritative: drawing a floor across
// the opening must still show the hole, in BOTH the 3D slab and the 2D plan path.
//
// The old call sites each inlined `opening.every(corner => pointInPolygon(corner,
// polygon))` — requiring ALL FOUR opening corners to be STRICTLY inside the floor
// polygon. `pointInPolygon` treats boundary points as outside, so a staircase
// sitting flush against a wall (the common layout) — whose opening edge coincides
// with the floor's edge — had two corners land ON the boundary and the hole was
// silently dropped. A Fill-Room floor (traced to interior wall faces) hit the
// same edge coincidence.
//
// We instead keep any opening that shares interior AREA with the floor (fully
// inside OR flush against an edge); edge-only touching with no overlap is
// excluded. One pure helper drives the slab, the floor regions (3D), and the 2D
// even-odd path, so the three can never drift apart again.
export function openingsForFloor(
  openings: Vec2[][],
  polygon: Vec2[],
): Vec2[][] {
  return openings.filter((op) => polygonsOverlap(op, polygon));
}
