import { describe, it, expect } from "vitest";
import { planToWorld } from "./mapping";

describe("planToWorld", () => {
  it("maps plan (x, y) to world (x, 0, y) at elevation 0", () => {
    expect(planToWorld({ x: 2, y: 5 }, 0)).toEqual([2, 0, 5]);
  });

  it("offsets world Y by the level elevation", () => {
    expect(planToWorld({ x: 1, y: -3 }, 2.7)).toEqual([1, 2.7, -3]);
  });
});
