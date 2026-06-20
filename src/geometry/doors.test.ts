import { describe, it, expect } from "vitest";
import { validateDoor, doorSymbol } from "./doors";
import { createWall } from "../model/defaults";
import type { DoorOpening, Vec2, Wall, WindowOpening } from "../model/types";

const door = (over: Partial<DoorOpening>): DoorOpening => ({
  id: "d",
  t: 0.5,
  width: 0.9,
  height: 2.0,
  style: "single",
  hinge: "start",
  swing: "A",
  material: { kind: "solid", color: "#9a6b4f" },
  ...over,
});

// 4 m wall along +x, height 2.4.
const wall = (
  windows: WindowOpening[] = [],
  doors: DoorOpening[] = [],
): Wall => ({
  ...createWall({ x: 0, y: 0 }, { x: 4, y: 0 }),
  windows,
  doors,
});

describe("validateDoor", () => {
  it("accepts a centred default door", () => {
    expect(validateDoor(wall(), door({})).ok).toBe(true);
  });
  it("rejects a door past the end margin", () => {
    expect(validateDoor(wall(), door({ t: 0.98 })).ok).toBe(false);
  });
  it("rejects a door taller than the wall", () => {
    const r = validateDoor(wall(), door({ height: 3.0 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/wall/i);
  });
  it("rejects overlap with a window", () => {
    const win: WindowOpening = {
      id: "w",
      t: 0.5,
      width: 1.2,
      height: 1.2,
      sillHeight: 0.9,
      style: "picture",
      muntinMaterial: { kind: "solid", color: "#eef0f2" },
    };
    const r = validateDoor(wall([win]), door({ t: 0.5 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/overlap/i);
  });
  it("rejects overlap with another door", () => {
    const existing = door({ id: "a", t: 0.4 });
    expect(
      validateDoor(wall([], [existing]), door({ id: "b", t: 0.55 })).ok,
    ).toBe(false);
  });
  it("ignores the door being edited when checking overlap", () => {
    const existing = door({ id: "a", t: 0.5 });
    expect(
      validateDoor(wall([], [existing]), door({ id: "a", t: 0.5 }), "a").ok,
    ).toBe(true);
  });
  it("allows a door and a non-overlapping window on the same wall", () => {
    const win: WindowOpening = {
      id: "w",
      t: 0.2,
      width: 0.8,
      height: 1.2,
      sillHeight: 0.9,
      style: "picture",
      muntinMaterial: { kind: "solid", color: "#eef0f2" },
    };
    expect(validateDoor(wall([win]), door({ t: 0.8 })).ok).toBe(true);
  });
});

describe("doorSymbol", () => {
  // Wall along +x; side A normal points to -y (perpLeft of (1,0)).
  const w = wall();

  it("hinges at the near end and swings to the chosen side", () => {
    const s = doorSymbol(w, { t: 0.5, width: 0.9, hinge: "start", swing: "A" });
    // door spans [1.55, 2.45]; hinge at start edge 1.55, jamb at 2.45
    expect(s.hinge.x).toBeCloseTo(1.55);
    expect(s.jamb.x).toBeCloseTo(2.45);
    // swing A -> leaf tip toward -y, length 0.9
    expect(s.leafEnd.x).toBeCloseTo(1.55);
    expect(s.leafEnd.y).toBeCloseTo(-0.9);
  });

  it("hinge=end moves the hinge to the far edge", () => {
    const s = doorSymbol(w, { t: 0.5, width: 0.9, hinge: "end", swing: "A" });
    expect(s.hinge.x).toBeCloseTo(2.45);
    expect(s.jamb.x).toBeCloseTo(1.55);
  });

  it("swing=B flips the leaf to the other side", () => {
    const s = doorSymbol(w, { t: 0.5, width: 0.9, hinge: "start", swing: "B" });
    expect(s.leafEnd.y).toBeCloseTo(0.9);
  });

  // The SVG arc (jamb -> leafEnd, radius = width, large-arc 0, our sweepFlag)
  // must be the quarter circle centred on the hinge. Verify via the SVG
  // endpoint->center algorithm for all four hinge/swing combinations.
  it("sweep flag yields an arc centred on the hinge (standard symbol)", () => {
    const svgArcCenter = (P1: Vec2, P2: Vec2, r: number, fS: 0 | 1): Vec2 => {
      const x1p = (P1.x - P2.x) / 2;
      const y1p = (P1.y - P2.y) / 2;
      const mx = (P1.x + P2.x) / 2;
      const my = (P1.y + P2.y) / 2;
      const num = r ** 4 - r * r * y1p * y1p - r * r * x1p * x1p;
      const den = r * r * y1p * y1p + r * r * x1p * x1p;
      const sign = 0 !== fS ? 1 : -1; // fA = 0
      const coef = sign * Math.sqrt(Math.max(0, num / den));
      return { x: coef * y1p + mx, y: -coef * x1p + my };
    };
    for (const hinge of ["start", "end"] as const) {
      for (const swing of ["A", "B"] as const) {
        const s = doorSymbol(w, { t: 0.5, width: 0.9, hinge, swing });
        const c = svgArcCenter(s.jamb, s.leafEnd, s.radius, s.sweepFlag);
        expect(c.x).toBeCloseTo(s.hinge.x);
        expect(c.y).toBeCloseTo(s.hinge.y);
      }
    }
  });
});
