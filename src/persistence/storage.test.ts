import { describe, it, expect } from "vitest";
import { validateDesign } from "./storage";
import { LATEST_SCHEMA_VERSION } from "../model/migrations";
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
    const r = validateDesign({ schemaVersion: 99, name: "x", levels: [{}] });
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
      doors: [],
      mounts: [],
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

  it("accepts the landscape patterns (grass, water, gravel) on a floor", () => {
    for (const pattern of ["grass", "water", "gravel"] as const) {
      const d = base();
      d.levels[0]!.floors.push({
        id: `f-${pattern}`,
        polygon: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 },
        ],
        material: { kind: "pattern", pattern, colorA: "#123456", colorB: "#abcdef" },
      });
      expect(validateDesign(d).ok).toBe(true);
    }
  });

  it("accepts and round-trips per-level roof sections", () => {
    const d = base();
    d.levels[0]!.roofs.push({
      id: "roof1",
      anchor: { x: 2, y: 1.5 },
      type: "gabled",
      pitch: 30,
      overhang: 0.4,
      visible: true,
      material: { kind: "solid", color: "#8a5a44" },
    });
    const r = validateDesign(JSON.parse(JSON.stringify(d)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.design.levels[0]!.roofs).toEqual(d.levels[0]!.roofs);
  });

  it("rejects a malformed roof section", () => {
    const d = base() as unknown as Record<string, unknown>;
    (d.levels as Record<string, unknown>[])[0]!.roofs = [
      { id: "x", anchor: { x: 0, y: 0 }, type: "mansard", pitch: 30, overhang: 0.4, visible: true },
    ];
    expect(validateDesign(d).ok).toBe(false);
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
      doors: [],
      mounts: [],
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

describe("validateDesign — v1 migration on import", () => {
  it("imports a pre-doors v1 design and adds empty doors arrays", () => {
    const v1 = {
      schemaVersion: 1,
      name: "Legacy",
      levels: [
        {
          id: "l",
          name: "Ground floor",
          elevation: 0,
          wallHeight: 2.4,
          walls: [
            {
              id: "w",
              start: { x: 0, y: 0 },
              end: { x: 3, y: 0 },
              height: 2.4,
              thickness: 0.15,
              paintA: { kind: "solid", color: "#fff" },
              paintB: { kind: "solid", color: "#fff" },
              windows: [],
            },
          ],
          floors: [],
        },
      ],
    };
    const r = validateDesign(v1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.design.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
      expect(r.design.levels[0]!.walls[0]!.doors).toEqual([]);
      expect(r.design.levels[0]!.walls[0]!.mounts).toEqual([]);
      expect(r.design.levels[0]!.furniture).toEqual([]);
      expect(r.design.levels[0]!.staircases).toEqual([]);
      expect(r.design.site.width).toBeGreaterThan(0);
    }
  });
});
