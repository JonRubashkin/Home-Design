import { describe, it, expect } from "vitest";
import { validateDesign } from "./storage";
import { createDesign } from "../model/defaults";

describe("validateDesign", () => {
  it("accepts a freshly created design", () => {
    const result = validateDesign(createDesign());
    expect(result.ok).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(validateDesign(null).ok).toBe(false);
    expect(validateDesign(42).ok).toBe(false);
    expect(validateDesign("nope").ok).toBe(false);
  });

  it("rejects a missing schemaVersion", () => {
    const r = validateDesign({ name: "x", levels: [] });
    expect(r.ok).toBe(false);
  });

  it("refuses a newer schema version with a helpful message", () => {
    const r = validateDesign({ schemaVersion: 2, name: "x", levels: [{}] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/i);
  });

  it("rejects a design with no levels", () => {
    const r = validateDesign({ schemaVersion: 1, name: "x", levels: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects a missing name", () => {
    const r = validateDesign({ schemaVersion: 1, levels: [{}] });
    expect(r.ok).toBe(false);
  });
});

describe("validateDesign — windows, floors, materials", () => {
  const base = () => createDesign();

  it("accepts a design with a valid window and floor", () => {
    const d = base();
    d.levels[0]!.walls.push({
      id: "w1",
      start: { x: 0, y: 0 },
      end: { x: 4, y: 0 },
      height: 2.4,
      thickness: 0.15,
      paintA: { kind: "solid", color: "#fff" },
      paintB: {
        kind: "pattern",
        pattern: "planks",
        colorA: "#a",
        colorB: "#b",
      },
      windows: [
        { id: "win", t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9 },
      ],
    });
    d.levels[0]!.floors.push({
      id: "f1",
      polygon: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
      ],
      material: {
        kind: "pattern",
        pattern: "tile",
        colorA: "#1",
        colorB: "#2",
      },
    });
    expect(validateDesign(d).ok).toBe(true);
  });

  it("rejects a malformed window", () => {
    const d = base();
    d.levels[0]!.walls.push({
      id: "w1",
      start: { x: 0, y: 0 },
      end: { x: 4, y: 0 },
      height: 2.4,
      thickness: 0.15,
      paintA: { kind: "solid", color: "#fff" },
      paintB: { kind: "solid", color: "#fff" },
      // missing sillHeight
      windows: [{ id: "x", t: 0.5, width: 1, height: 1 } as never],
    });
    expect(validateDesign(d).ok).toBe(false);
  });

  it("rejects a floor with fewer than three points", () => {
    const d = base();
    d.levels[0]!.floors.push({
      id: "f1",
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      material: { kind: "solid", color: "#abc" },
    });
    expect(validateDesign(d).ok).toBe(false);
  });

  it("rejects an invalid material kind", () => {
    const d = base();
    d.levels[0]!.floors.push({
      id: "f1",
      polygon: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
      ],
      material: { kind: "gradient" } as never,
    });
    expect(validateDesign(d).ok).toBe(false);
  });
});
