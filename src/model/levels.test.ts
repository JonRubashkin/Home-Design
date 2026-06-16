import { describe, it, expect } from "vitest";
import { computeElevations, defaultLevelName } from "./levels";
import { FLOOR_SLAB_THICKNESS } from "./defaults";

describe("computeElevations", () => {
  it("stacks levels by wallHeight + slab thickness, ground at 0", () => {
    const levels = [
      { wallHeight: 2.4 },
      { wallHeight: 2.4 },
      { wallHeight: 3.0 },
    ];
    const e = computeElevations(levels);
    expect(e[0]).toBe(0);
    expect(e[1]).toBeCloseTo(2.4 + FLOOR_SLAB_THICKNESS);
    expect(e[2]).toBeCloseTo(2.4 + FLOOR_SLAB_THICKNESS + 2.4 + FLOOR_SLAB_THICKNESS);
  });

  it("handles a single level and an empty list", () => {
    expect(computeElevations([{ wallHeight: 2.4 }])).toEqual([0]);
    expect(computeElevations([])).toEqual([]);
  });
});

describe("defaultLevelName", () => {
  it("names floors by the American convention (no ground floor)", () => {
    expect(defaultLevelName(0)).toBe("First floor");
    expect(defaultLevelName(1)).toBe("Second floor");
    expect(defaultLevelName(2)).toBe("Third floor");
    expect(defaultLevelName(10)).toBe("11th floor");
  });
});
