import { describe, it, expect } from "vitest";
import type { Vec2, Wall } from "../model/types";
import { reconcileRoofSections } from "./roofReconcile";
import { detectMasses } from "./roofMass";
import { createRoofSection } from "../model/defaults";

let wallSeq = 0;
function wall(x1: number, y1: number, x2: number, y2: number): Wall {
  return {
    id: `w${wallSeq++}`,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    height: 2.4,
    thickness: 0.15,
    paintA: { kind: "solid", color: "#fff" },
    paintB: { kind: "solid", color: "#fff" },
    windows: [],
    doors: [],
    mounts: [],
  };
}

function room(ox: number, oy: number, w: number, d: number): Wall[] {
  return [
    wall(ox, oy, ox + w, oy),
    wall(ox + w, oy, ox + w, oy + d),
    wall(ox + w, oy + d, ox, oy + d),
    wall(ox, oy + d, ox, oy),
  ];
}

describe("reconcileRoofSections", () => {
  it("no walls and no sections leaves everything empty", () => {
    const r = reconcileRoofSections([], []);
    expect(r.sections).toEqual([]);
    expect(r.suppressed).toEqual([]);
  });

  it("auto-creates a default section for a new mass", () => {
    const r = reconcileRoofSections(room(0, 0, 4, 3), []);
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0]!.type).toBe("gabled");
  });

  it("auto-creates one section per disconnected mass", () => {
    const walls = [...room(0, 0, 4, 3), ...room(10, 0, 4, 3)];
    const r = reconcileRoofSections(walls, []);
    expect(r.sections).toHaveLength(2);
  });

  it("keeps an existing section that still matches a mass (settings persist)", () => {
    const walls = room(0, 0, 4, 3);
    const mass = detectMasses(walls)[0]!;
    const existing = createRoofSection(mass.anchor, { type: "hipped", pitch: 22 });
    const r = reconcileRoofSections(walls, [existing]);
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0]!.id).toBe(existing.id);
    expect(r.sections[0]!.type).toBe("hipped");
    expect(r.sections[0]!.pitch).toBe(22);
  });

  it("drops a section whose anchor is inside no current mass", () => {
    const orphan = createRoofSection({ x: 999, y: 999 });
    const r = reconcileRoofSections(room(0, 0, 4, 3), [orphan]);
    // The orphan is removed; the mass gets a fresh default.
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0]!.id).not.toBe(orphan.id);
  });

  it("suppresses auto-creation for a removed mass anchor", () => {
    const walls = room(0, 0, 4, 3);
    const mass = detectMasses(walls)[0]!;
    const r = reconcileRoofSections(walls, [], [mass.anchor]);
    expect(r.sections).toHaveLength(0);
    expect(r.suppressed).toHaveLength(1);
  });

  it("clears suppression once the mass is gone (walls removed)", () => {
    const suppressed: Vec2[] = [{ x: 2, y: 1.5 }];
    const r = reconcileRoofSections([], [], suppressed);
    expect(r.suppressed).toEqual([]);
  });
});
