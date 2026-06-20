import { describe, it, expect } from "vitest";
import {
  projectPointToWallT,
  windowSpan,
  validateWindow,
  clampWindowT,
  wallPlanSegments,
} from "./windows";
import { createWall } from "../model/defaults";
import type { Wall, WindowOpening } from "../model/types";

// 4 m wall along +x, height 2.4.
const wall = (windows: WindowOpening[] = []): Wall => ({
  ...createWall({ x: 0, y: 0 }, { x: 4, y: 0 }),
  windows,
});

const win = (over: Partial<WindowOpening>): WindowOpening => ({
  id: "w",
  t: 0.5,
  width: 1.2,
  height: 1.2,
  sillHeight: 0.9,
  style: "plain",
  ...over,
});

describe("projectPointToWallT", () => {
  it("projects onto the wall and normalises to 0..1", () => {
    expect(projectPointToWallT(wall(), { x: 1, y: 0.5 })).toBeCloseTo(0.25);
  });
  it("clamps points beyond the ends", () => {
    expect(projectPointToWallT(wall(), { x: -3, y: 0 })).toBe(0);
    expect(projectPointToWallT(wall(), { x: 10, y: 0 })).toBe(1);
  });
});

describe("windowSpan", () => {
  it("centres the span on t", () => {
    expect(windowSpan(4, 0.5, 1.2)).toEqual({ a: 2 - 0.6, b: 2 + 0.6 });
  });
});

describe("validateWindow", () => {
  it("accepts a centred default window", () => {
    expect(validateWindow(wall(), win({})).ok).toBe(true);
  });
  it("rejects a window past the start margin", () => {
    const r = validateWindow(wall(), win({ t: 0.05 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/start/i);
  });
  it("rejects a window past the end margin", () => {
    expect(validateWindow(wall(), win({ t: 0.97 })).ok).toBe(false);
  });
  it("rejects a window taller than the wall", () => {
    const r = validateWindow(wall(), win({ sillHeight: 2.0, height: 1.0 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/wall/i);
  });
  it("rejects overlap with an existing window", () => {
    const existing = win({ id: "a", t: 0.4, width: 1.2 });
    const r = validateWindow(wall([existing]), win({ id: "b", t: 0.55 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/overlap/i);
  });
  it("ignores the window being edited when checking overlap", () => {
    const existing = win({ id: "a", t: 0.5, width: 1.2 });
    expect(
      validateWindow(wall([existing]), win({ id: "a", t: 0.5 }), "a").ok,
    ).toBe(true);
  });
  it("allows two non-overlapping windows", () => {
    const existing = win({ id: "a", t: 0.25, width: 1.0 });
    expect(
      validateWindow(wall([existing]), win({ id: "b", t: 0.75, width: 1.0 }))
        .ok,
    ).toBe(true);
  });
});

describe("clampWindowT", () => {
  it("keeps a window within the end margins", () => {
    // half = 0.6, margin 0.1 -> min t = 0.7/4 = 0.175, max = 3.3/4 = 0.825
    expect(clampWindowT(wall(), 1.2, 0)).toBeCloseTo(0.175);
    expect(clampWindowT(wall(), 1.2, 1)).toBeCloseTo(0.825);
    expect(clampWindowT(wall(), 1.2, 0.5)).toBeCloseTo(0.5);
  });
});

describe("wallPlanSegments", () => {
  it("returns the whole wall when there are no windows", () => {
    expect(wallPlanSegments(wall())).toEqual([{ a: 0, b: 4 }]);
  });
  it("splits around one window", () => {
    const segs = wallPlanSegments(wall([win({ t: 0.5, width: 1.2 })]));
    expect(segs).toEqual([
      { a: 0, b: 1.4 },
      { a: 2.6, b: 4 },
    ]);
  });
  it("produces three piers for two windows", () => {
    const segs = wallPlanSegments(
      wall([
        win({ id: "a", t: 0.25, width: 1.0 }),
        win({ id: "b", t: 0.75, width: 1.0 }),
      ]),
    );
    expect(segs).toHaveLength(3);
  });
});
