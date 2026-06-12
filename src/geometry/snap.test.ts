import { describe, it, expect } from "vitest";
import { snapToGrid, constrainAngle } from "./snap";
import { wallLength } from "./wall";

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("snapToGrid", () => {
  it("snaps to the 0.1 m grid", () => {
    expect(snapToGrid({ x: 1.23, y: 4.57 })).toEqual({ x: 1.2, y: 4.6 });
  });

  it("rounds halves up", () => {
    const r = snapToGrid({ x: 0.05, y: -0.05 });
    expect(close(r.x, 0.1)).toBe(true);
    // -0.05 rounds toward +0 (Math.round(-0.5) === -0).
    expect(Object.is(r.y, -0) || close(r.y, 0)).toBe(true);
  });

  it("leaves on-grid points unchanged", () => {
    expect(snapToGrid({ x: 3.4, y: 2.0 })).toEqual({ x: 3.4, y: 2.0 });
  });

  it("respects a custom grid size", () => {
    expect(snapToGrid({ x: 0.27, y: 0.27 }, 0.25)).toEqual({
      x: 0.25,
      y: 0.25,
    });
  });
});

describe("constrainAngle", () => {
  const start = { x: 0, y: 0 };

  it("snaps a near-horizontal move to 0° (keeps x, zeroes y)", () => {
    const r = constrainAngle(start, { x: 3, y: 0.2 });
    expect(close(r.y, 0)).toBe(true);
    expect(r.x).toBeGreaterThan(2.9);
  });

  it("snaps a near-vertical move to 90° (keeps y, zeroes x)", () => {
    const r = constrainAngle(start, { x: 0.2, y: 3 });
    expect(close(r.x, 0)).toBe(true);
    expect(r.y).toBeGreaterThan(2.9);
  });

  it("snaps a near-diagonal move to 45° (equal components)", () => {
    const r = constrainAngle(start, { x: 3, y: 2.6 });
    expect(close(r.x, r.y)).toBe(true);
  });

  it("returns start for a zero-length move", () => {
    expect(constrainAngle(start, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("projection keeps the endpoint near the cursor (length <= raw)", () => {
    const p = { x: 3, y: 0.4 };
    const r = constrainAngle(start, p);
    expect(wallLength({ start, end: r })).toBeLessThanOrEqual(
      wallLength({ start, end: p }) + 1e-9,
    );
  });
});
