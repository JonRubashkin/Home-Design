import type { Staircase, Vec2 } from "../model/types";
import { STAIR_RISER_TARGET, STAIR_TREAD_DEPTH } from "../model/defaults";
import { footprintCorners } from "./furniture";

export interface StairGeometry {
  steps: number;
  riser: number; // actual rise per step (fits the storey exactly)
  runLength: number; // total horizontal run (meters)
  footprint: Vec2[]; // 4 corners, plan coords (width × runLength, rotated)
  opening: Vec2[]; // stairwell hole cut from the floor ABOVE (= footprint)
}

// Pure stair geometry for a given storey height (= the level above's elevation
// minus this level's = wallHeight + FLOOR_SLAB_THICKNESS). Steps auto-fit the
// height: count rounds to the nearest target riser, then the actual riser is the
// exact storey height / count. The footprint is width × runLength centered on the
// stair position and rotated; the opening rectangle is what gets cut from the
// floor above.
export function computeStair(
  stair: Pick<Staircase, "position" | "rotation" | "width">,
  storeyHeight: number,
): StairGeometry {
  const steps = Math.max(1, Math.round(storeyHeight / STAIR_RISER_TARGET));
  const riser = storeyHeight / steps;
  const runLength = steps * STAIR_TREAD_DEPTH;
  const footprint = footprintCorners(stair.position, stair.rotation, {
    width: stair.width,
    depth: runLength,
  });
  return { steps, riser, runLength, footprint, opening: footprint };
}
