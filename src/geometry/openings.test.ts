import { describe, it, expect } from "vitest";
import {
  openingOccupiedSpan,
  openingsOverlap,
  overlappingOpeningIds,
} from "./openings";
import type { Wall } from "../model/types";

const L = 4; // a 4 m wall for the span math (centers in meters = t * 4)

describe("openingOccupiedSpan", () => {
  it("returns the hole span for a plain window/door", () => {
    // center at t=0.5 -> 2 m, width 1 -> [1.5, 2.5]
    expect(openingOccupiedSpan(L, { t: 0.5, width: 1 })).toEqual({
      lo: 1.5,
      hi: 2.5,
    });
  });

  it("extends one width toward the start for a sliding door", () => {
    // hole [1.5, 2.5]; sliding panel parks in [0.5, 1.5] -> occupied [0.5, 2.5]
    expect(openingOccupiedSpan(L, { t: 0.5, width: 1, style: "sliding" })).toEqual(
      { lo: 0.5, hi: 2.5 },
    );
  });

  it("clamps the sliding panel to the wall start", () => {
    // center 0.6 m, width 1 -> hole [0.1, 1.1]; parked would be [-0.9, 0.1] -> 0
    const s = openingOccupiedSpan(L, { t: 0.15, width: 1, style: "sliding" });
    expect(s.lo).toBe(0);
    expect(s.hi).toBeCloseTo(1.1, 9);
  });
});

describe("openingsOverlap", () => {
  it("detects two plain openings overlapping", () => {
    const a = { t: 0.4, width: 1 }; // [1.1, 2.1]
    const b = { t: 0.5, width: 1 }; // [1.5, 2.5]
    expect(openingsOverlap(L, a, b)).toBe(true);
  });

  it("treats touching edges as NOT overlapping", () => {
    const a = { t: 0.25, width: 1 }; // center 1 -> [0.5, 1.5]
    const b = { t: 0.5, width: 1 }; // center 2 -> [1.5, 2.5], shares 1.5
    expect(openingsOverlap(L, a, b)).toBe(false);
  });

  it("catches the sliding-door-covers-window case", () => {
    // A window sitting just before a door's hole. The door's hole doesn't reach
    // the window, but its sliding panel (parked toward the start) does.
    const window = { t: 0.25, width: 0.8 }; // center 1 -> [0.6, 1.4]
    const door = { t: 0.5, width: 1, style: "sliding" }; // hole [1.5,2.5]
    // hole-vs-hole: no overlap
    expect(openingsOverlap(L, window, { t: 0.5, width: 1 })).toBe(false);
    // panel parks in [0.5, 1.5], which overlaps the window's [0.6, 1.4]
    expect(openingsOverlap(L, window, door)).toBe(true);
  });

  it("does not flag well-separated openings", () => {
    const a = { t: 0.2, width: 0.5 }; // [0.55, 1.05]
    const b = { t: 0.8, width: 0.5 }; // [2.95, 3.45]
    expect(openingsOverlap(L, a, b)).toBe(false);
  });
});

function wall(windows: Wall["windows"], doors: Wall["doors"]): Wall {
  return {
    id: "w",
    start: { x: 0, y: 0 },
    end: { x: 4, y: 0 },
    height: 2.4,
    thickness: 0.15,
    paintA: { kind: "solid", color: "#fff" },
    paintB: { kind: "solid", color: "#fff" },
    windows,
    doors,
    mounts: [],
  };
}

const win = (id: string, t: number, width: number): Wall["windows"][number] => ({
  id,
  t,
  width,
  height: 1.2,
  sillHeight: 0.9,
  style: "picture",
  muntinMaterial: { kind: "solid", color: "#eee" },
});

const door = (
  id: string,
  t: number,
  width: number,
  style: "single" | "double" | "sliding" = "single",
): Wall["doors"][number] => ({
  id,
  t,
  width,
  height: 2,
  style,
  hinge: "start",
  swing: "A",
  material: { kind: "solid", color: "#9a6b4f" },
});

describe("overlappingOpeningIds", () => {
  it("flags both members of an overlapping window+door pair", () => {
    const w = wall([win("win1", 0.25, 0.8)], [door("door1", 0.5, 1, "sliding")]);
    const hits = overlappingOpeningIds(w);
    expect(hits.has("win1")).toBe(true);
    expect(hits.has("door1")).toBe(true);
  });

  it("returns empty when nothing overlaps", () => {
    const w = wall([win("win1", 0.2, 0.5)], [door("door1", 0.8, 0.5)]);
    expect(overlappingOpeningIds(w).size).toBe(0);
  });
});
