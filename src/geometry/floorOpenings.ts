import type { Vec2 } from "../model/types";
import {
  clipPolygon,
  insetPolygonTowardCentroid,
  polygonsOverlap,
} from "./polygon";

// How far (meters) to pull a clipped hole off the floor boundary. Tiny — far
// below the 0.1 m grid and wall thickness, so it is invisible — but enough that
// Earcut treats the hole as strictly interior and cuts it.
const HOLE_INSET = 0.002;

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

// The actual hole polygons to subtract from a floor's mesh: for every opening
// that shares area with the floor, CLIP it to the floor outline and inset it a
// hair off the boundary. This is the single source of truth for both the 3D slab
// and the 2D plan path, so they can never disagree.
//
// Why clip+inset, not the raw opening: a Fill-Room floor is traced to the
// interior wall faces, so a stair flush against a wall produces an opening that
// reaches or crosses the floor boundary. THREE's Earcut triangulator silently
// DROPS any hole whose edge touches/crosses the outer contour (a boundary notch
// isn't an interior hole), leaving a solid 3D slab — even though the 2D even-odd
// path drew it fine. Clipping the opening to the floor (the opening is a convex
// rectangle, so it is the clip; the floor — possibly L-shaped — is the subject)
// and nudging it inward makes every hole strictly interior, so Earcut always cuts
// it, regardless of which tool drew the floor (Floor tool or Fill Room).
export function floorHoles(openings: Vec2[][], polygon: Vec2[]): Vec2[][] {
  const holes: Vec2[][] = [];
  for (const op of openingsForFloor(openings, polygon)) {
    const clipped = clipPolygon(polygon, op);
    if (clipped.length < 3) continue;
    const hole = insetPolygonTowardCentroid(clipped, HOLE_INSET);
    if (hole.length >= 3) holes.push(hole);
  }
  return holes;
}
