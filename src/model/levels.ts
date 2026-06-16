import type { Level } from "./types";
import { FLOOR_SLAB_THICKNESS } from "./defaults";

// Multi-level helpers. Elevation is DERIVED, never hand-edited: level 0 sits at 0
// and each level above sits at the previous level's elevation + its wallHeight +
// the floor-slab thickness. The `levels` array is ordered ground-first.

// World Y of each level's walking surface, in array order (ground first).
export function computeElevations(levels: Pick<Level, "wallHeight">[]): number[] {
  const out: number[] = [];
  let elevation = 0;
  for (const level of levels) {
    out.push(elevation);
    elevation += level.wallHeight + FLOOR_SLAB_THICKNESS;
  }
  return out;
}

// Write the computed elevations back onto the levels (call after any add/remove
// or wallHeight change so `level.elevation` always matches the stack).
export function restackElevations(levels: Level[]): void {
  const elevations = computeElevations(levels);
  levels.forEach((level, i) => {
    level.elevation = elevations[i]!;
  });
}

// Default name for the level at a given index (American convention: the bottom
// level is the First floor — no "Ground floor").
const ORDINALS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth",
];

export function defaultLevelName(index: number): string {
  const ordinal = ORDINALS[index] ?? `${index + 1}th`;
  return `${ordinal} floor`;
}
