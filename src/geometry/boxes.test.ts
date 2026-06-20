import { describe, it, expect } from "vitest";
import {
  wallToBoxes,
  doorLeafBox,
  doubleDoorLeafBoxes,
  slidingDoorBoxes,
  windowMuntinBoxes,
} from "./boxes";
import { createWall } from "../model/defaults";
import type { Wall, WindowOpening } from "../model/types";

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

const win = (over: Partial<WindowOpening>): WindowOpening => ({
  id: "w",
  t: 0.5,
  width: 1.2,
  height: 1.2,
  sillHeight: 0.9,
  style: "plain",
  ...over,
});

// A 4 m wall along +x at the origin, height 2.4, thickness 0.15.
const baseWall = (windows: WindowOpening[] = []): Wall => ({
  ...createWall({ x: 0, y: 0 }, { x: 4, y: 0 }),
  windows,
});

describe("wallToBoxes — no windows", () => {
  it("returns a single full-height box", () => {
    const boxes = wallToBoxes(baseWall());
    expect(boxes).toHaveLength(1);
    const b = boxes[0]!;
    expect(b.size[0]).toBeCloseTo(4); // length
    expect(b.size[1]).toBeCloseTo(2.4); // height
    expect(b.size[2]).toBeCloseTo(0.15); // thickness
    expect(b.center[0]).toBeCloseTo(2); // mid-length
    expect(b.center[1]).toBeCloseTo(1.2); // half height
    expect(b.center[2]).toBeCloseTo(0); // on the x axis (plan y -> world z)
  });

  it("returns nothing for a zero-length wall", () => {
    const zero: Wall = { ...baseWall(), end: { x: 0, y: 0 } };
    expect(wallToBoxes(zero)).toEqual([]);
  });

  it("offsets vertical position by the level elevation", () => {
    const b = wallToBoxes(baseWall(), 3)[0]!;
    expect(b.center[1]).toBeCloseTo(3 + 1.2);
  });
});

describe("wallToBoxes — one centred window", () => {
  it("splits into two piers, an under-sill box, and an over-head box", () => {
    const boxes = wallToBoxes(baseWall([win({ t: 0.5, width: 1.2 })]));
    expect(boxes).toHaveLength(4);

    // The window spans along-wall [1.4, 2.6].
    const piers = boxes.filter((b) => close(b.size[1], 2.4));
    expect(piers).toHaveLength(2);
    expect(piers.map((p) => p.size[0]).sort()).toEqual(
      expect.arrayContaining([expect.closeTo(1.4), expect.closeTo(1.4)]),
    );

    const under = boxes.find((b) => close(b.center[1], 0.45)); // 0..0.9
    expect(under).toBeDefined();
    expect(under!.size).toBeDefined();
    expect(under!.size[1]).toBeCloseTo(0.9);
    expect(under!.size[0]).toBeCloseTo(1.2);

    const over = boxes.find((b) => b.center[1] > 1.2 && close(b.size[0], 1.2));
    expect(over).toBeDefined();
    // head at 0.9 + 1.2 = 2.1, top 2.4 -> height 0.3, center 2.25
    expect(over!.size[1]).toBeCloseTo(0.3);
    expect(over!.center[1]).toBeCloseTo(2.25);
  });
});

describe("wallToBoxes — window edge cases", () => {
  it("omits the under-sill box for a floor-level window", () => {
    const boxes = wallToBoxes(baseWall([win({ sillHeight: 0, height: 2.0 })]));
    // piers x2 + over-head (no under-sill)
    const under = boxes.filter(
      (b) => b.center[1] < 0.5 && close(b.size[0], 1.2),
    );
    expect(under).toHaveLength(0);
  });

  it("omits the over-head box for a full-height window", () => {
    const boxes = wallToBoxes(baseWall([win({ sillHeight: 0, height: 2.4 })]));
    // Only the two piers remain (window opening reaches floor to ceiling).
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => close(b.size[1], 2.4))).toBe(true);
  });

  it("handles two windows: three piers plus their sill/head boxes", () => {
    const boxes = wallToBoxes(
      baseWall([
        win({ id: "a", t: 0.25, width: 1.0 }),
        win({ id: "b", t: 0.75, width: 1.0 }),
      ]),
    );
    const piers = boxes.filter((b) => close(b.size[1], 2.4));
    expect(piers).toHaveLength(3); // before, between, after
    // Each window contributes an under-sill and over-head box.
    expect(boxes).toHaveLength(3 + 4);
  });
});

describe("wallToBoxes — orientation", () => {
  it("rotates the box for a wall along +y (plan) about world Y by ~ -90°", () => {
    const wall: Wall = createWall({ x: 0, y: 0 }, { x: 0, y: 4 });
    const b = wallToBoxes(wall)[0]!;
    // dir = (0,1) -> rotationY = atan2(-1, 0) = -PI/2
    expect(b.rotationY).toBeCloseTo(-Math.PI / 2);
    expect(b.center[0]).toBeCloseTo(0);
    expect(b.center[2]).toBeCloseTo(2); // plan y midpoint -> world z
  });
});

describe("wallToBoxes — doors", () => {
  const door = (over: Partial<import("../model/types").DoorOpening> = {}) => ({
    id: "d",
    t: 0.5,
    width: 0.9,
    height: 2.0,
    style: "single" as const,
    hinge: "start" as const,
    swing: "A" as const,
    material: { kind: "solid" as const, color: "#9a6b4f" },
    ...over,
  });

  it("splits a wall around a door with NO box under it (just a header)", () => {
    const w: Wall = {
      ...createWall({ x: 0, y: 0 }, { x: 4, y: 0 }),
      doors: [door()],
    };
    const boxes = wallToBoxes(w);
    // two full-height piers + one header box over the door (no under-sill box)
    expect(boxes).toHaveLength(3);
    const piers = boxes.filter((b) => close(b.size[1], 2.4));
    expect(piers).toHaveLength(2);
    const header = boxes.find((b) => b.center[1] > 1.5);
    expect(header).toBeDefined();
    expect(header!.size[1]).toBeCloseTo(0.4); // 2.4 - 2.0
    expect(header!.center[1]).toBeCloseTo(2.2);
    // nothing sits below the door opening
    const belowDoor = boxes.find(
      (b) => close(b.center[0], 2.0) && b.center[1] < 1.0,
    );
    expect(belowDoor).toBeUndefined();
  });

  it("handles a wall with both a window and a door", () => {
    const win = {
      id: "w",
      t: 0.25,
      width: 1.0,
      height: 1.2,
      sillHeight: 0.9,
      style: "plain" as const,
    };
    const w: Wall = {
      ...createWall({ x: 0, y: 0 }, { x: 4, y: 0 }),
      windows: [win],
      doors: [door({ t: 0.75 })],
    };
    const boxes = wallToBoxes(w);
    // pier, window under-sill, window over-head, pier, door header, pier = 6
    expect(boxes).toHaveLength(6);
  });
});

describe("door leaf styles", () => {
  // 4 m wall along +x; door centred at t=0.5, width 0.9 -> opening [1.55, 2.45].
  const w: Wall = {
    ...createWall({ x: 0, y: 0 }, { x: 4, y: 0 }),
    doors: [],
  };
  const d = { t: 0.5, width: 0.9, height: 2.0 };

  it("single leaf spans the opening (one box, centred)", () => {
    const leaf = doorLeafBox(w, d);
    expect(leaf.center[0]).toBeCloseTo(2.0); // opening centre
    expect(leaf.size[0]).toBeGreaterThan(0.7); // ~width minus the frame
    expect(leaf.size[0]).toBeLessThan(0.9);
  });

  it("double = two half-width leaves on either side of the opening centre", () => {
    const leaves = doubleDoorLeafBoxes(w, d);
    expect(leaves).toHaveLength(2);
    const [start, end] = leaves;
    // each leaf is roughly half the single-leaf width
    const single = doorLeafBox(w, d);
    expect(start!.size[0]).toBeCloseTo(single.size[0] / 2, 1);
    // they sit on opposite sides of the opening centre (2.0)
    expect(start!.center[0]).toBeLessThan(2.0);
    expect(end!.center[0]).toBeGreaterThan(2.0);
  });

  it("sliding parks the panel beside the opening, offset onto side A's face", () => {
    const { panel, track } = slidingDoorBoxes(w, d);
    // panel is parked toward the wall start, ending at the opening start (1.55)
    expect(panel.center[0]).toBeLessThan(1.55);
    expect(panel.size[0]).toBeCloseTo(0.9, 6); // full door width
    // offset onto the face: side A normal of a +x wall points to -y -> -z world.
    expect(panel.center[2]).toBeLessThan(0);
    // the track rides at the door head, above the panel
    expect(track.center[1]).toBeGreaterThan(panel.center[1]);
  });
});

describe("window muntin styles", () => {
  // 4 m wall along +x; window centred at t=0.5, width 1.2, height 1.2, sill 0.9.
  const w: Wall = {
    ...createWall({ x: 0, y: 0 }, { x: 4, y: 0 }),
    windows: [],
  };
  const win = { t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9 };

  it("plain and picture have no muntins", () => {
    expect(windowMuntinBoxes(w, { ...win, style: "plain" })).toHaveLength(0);
    expect(windowMuntinBoxes(w, { ...win, style: "picture" })).toHaveLength(0);
  });

  it("divided has a single centered vertical bar", () => {
    const bars = windowMuntinBoxes(w, { ...win, style: "divided" });
    expect(bars).toHaveLength(1);
    // the bar is centered along the opening (t=0.5 -> x=2) and spans the height
    expect(bars[0]!.center[0]).toBeCloseTo(2.0);
    expect(bars[0]!.size[1]).toBeCloseTo(1.2); // full window height
  });

  it("grid is a 2x3 layout: 1 vertical + 2 horizontal bars", () => {
    const bars = windowMuntinBoxes(w, { ...win, style: "grid" });
    expect(bars).toHaveLength(3);
    const verticals = bars.filter((b) => b.size[1] > b.size[0]);
    const horizontals = bars.filter((b) => b.size[0] > b.size[1]);
    expect(verticals).toHaveLength(1);
    expect(horizontals).toHaveLength(2);
    // horizontals split the height into thirds: y = sill + h/3 and + 2h/3
    const ys = horizontals.map((b) => b.center[1]).sort((p, q) => p - q);
    expect(ys[0]).toBeCloseTo(0.9 + 1.2 / 3);
    expect(ys[1]).toBeCloseTo(0.9 + (2 * 1.2) / 3);
  });
});
