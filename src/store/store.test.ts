import { describe, it, expect, beforeEach } from "vitest";
import { useStore, selectCurrentLevel } from "./store";
import { createDesign } from "../model/defaults";

const walls = () => selectCurrentLevel(useStore.getState()).walls;
const state = () => useStore.getState();

beforeEach(() => {
  const design = createDesign();
  useStore.setState({
    design,
    currentLevelId: design.levels[0]!.id,
    activeTool: "wall",
    selection: null,
    past: [],
    future: [],
    dragBaseline: null,
    clipboard: null,
  });
});

describe("addWall", () => {
  it("adds a wall to the current level and selects it", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    expect(walls()).toHaveLength(1);
    expect(state().selection?.id).toBe(walls()[0]!.id);
  });

  it("gives new walls default paint on both sides", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    const w = walls()[0]!;
    expect(w.paintA).toEqual({ kind: "solid", color: "#e8e4dc" });
    expect(w.paintB).toEqual({ kind: "solid", color: "#e8e4dc" });
  });
});

describe("undo / redo", () => {
  it("undoes and redoes a single addWall", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    expect(walls()).toHaveLength(1);
    state().undo();
    expect(walls()).toHaveLength(0);
    state().redo();
    expect(walls()).toHaveLength(1);
  });

  it("steps through multiple committed actions one at a time", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    state().addWall({ x: 3, y: 0 }, { x: 3, y: 3 });
    expect(walls()).toHaveLength(2);
    state().undo();
    expect(walls()).toHaveLength(1);
    state().undo();
    expect(walls()).toHaveLength(0);
    state().redo();
    state().redo();
    expect(walls()).toHaveLength(2);
  });

  it("a new action clears the redo stack", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    state().undo();
    expect(state().future).toHaveLength(1);
    state().addWall({ x: 1, y: 1 }, { x: 2, y: 2 });
    expect(state().future).toHaveLength(0);
  });

  it("does nothing when stacks are empty", () => {
    state().undo();
    state().redo();
    expect(walls()).toHaveLength(0);
  });
});

describe("drag sessions", () => {
  it("records exactly one history entry per drag, regardless of moves", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    const id = walls()[0]!.id;
    const pastBefore = state().past.length;

    state().beginDrag();
    state().moveWallEndpoint(id, "end", { x: 4, y: 0 });
    state().moveWallEndpoint(id, "end", { x: 5, y: 0 });
    state().moveWallEndpoint(id, "end", { x: 5, y: 1 });
    state().endDrag();

    expect(state().past.length).toBe(pastBefore + 1);
    expect(walls()[0]!.end).toEqual({ x: 5, y: 1 });

    state().undo();
    expect(walls()[0]!.end).toEqual({ x: 3, y: 0 });
  });

  it("records no history entry for a no-op drag", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    const pastBefore = state().past.length;
    state().beginDrag();
    state().endDrag();
    expect(state().past.length).toBe(pastBefore);
  });

  it("translateWall moves both endpoints as one undo step", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    const id = walls()[0]!.id;
    state().beginDrag();
    state().translateWall(id, { x: 1, y: 1 }, { x: 4, y: 1 });
    state().endDrag();
    expect(walls()[0]!.start).toEqual({ x: 1, y: 1 });
    expect(walls()[0]!.end).toEqual({ x: 4, y: 1 });
    state().undo();
    expect(walls()[0]!.start).toEqual({ x: 0, y: 0 });
  });
});

describe("updateWall / deleteWall", () => {
  it("updates a field as a single undo step", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    const id = walls()[0]!.id;
    state().updateWall(id, { thickness: 0.3 });
    expect(walls()[0]!.thickness).toBe(0.3);
    state().undo();
    expect(walls()[0]!.thickness).toBe(0.15);
  });

  it("deletes a wall, clears its selection, and undo restores it", () => {
    state().addWall({ x: 0, y: 0 }, { x: 3, y: 0 });
    const id = walls()[0]!.id;
    state().setSelection({ kind: "wall", id });
    state().deleteWall(id);
    expect(walls()).toHaveLength(0);
    expect(state().selection).toBeNull();
    state().undo();
    expect(walls()).toHaveLength(1);
  });
});

describe("history cap", () => {
  it("never exceeds 100 entries", () => {
    for (let i = 0; i < 130; i++) {
      state().addWall({ x: i, y: 0 }, { x: i + 1, y: 0 });
    }
    expect(state().past.length).toBeLessThanOrEqual(100);
  });
});

const firstWallId = () => walls()[0]!.id;

describe("windows", () => {
  it("adds, selects, and undoes a window", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const id = firstWallId();
    state().addWindow(id, { t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9, style: "picture", muntinMaterial: { kind: "solid", color: "#eef0f2" } });
    expect(walls()[0]!.windows).toHaveLength(1);
    expect(state().selection).toEqual({
      kind: "window",
      wallId: id,
      id: walls()[0]!.windows[0]!.id,
    });
    state().undo();
    expect(walls()[0]!.windows).toHaveLength(0);
  });

  it("moves a window as a single drag step", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const id = firstWallId();
    state().addWindow(id, { t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9, style: "picture", muntinMaterial: { kind: "solid", color: "#eef0f2" } });
    const winId = walls()[0]!.windows[0]!.id;
    const pastBefore = state().past.length;
    state().beginDrag();
    state().moveWindow(id, winId, 0.4);
    state().moveWindow(id, winId, 0.3);
    state().endDrag();
    expect(state().past.length).toBe(pastBefore + 1);
    expect(walls()[0]!.windows[0]!.t).toBeCloseTo(0.3);
    state().undo();
    expect(walls()[0]!.windows[0]!.t).toBeCloseTo(0.5);
  });

  it("deletes a window and clears its selection", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const id = firstWallId();
    state().addWindow(id, { t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9, style: "picture", muntinMaterial: { kind: "solid", color: "#eef0f2" } });
    const winId = walls()[0]!.windows[0]!.id;
    state().deleteWindow(id, winId);
    expect(walls()[0]!.windows).toHaveLength(0);
    expect(state().selection).toBeNull();
  });
});

describe("paintWallSide", () => {
  it("paints one side as a single undo step", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const id = firstWallId();
    state().paintWallSide(id, "A", { kind: "solid", color: "#123456" });
    expect(walls()[0]!.paintA).toEqual({ kind: "solid", color: "#123456" });
    expect(walls()[0]!.paintB).toEqual({ kind: "solid", color: "#e8e4dc" });
    state().undo();
    expect(walls()[0]!.paintA).toEqual({ kind: "solid", color: "#e8e4dc" });
  });
});

const floors = () => selectCurrentLevel(useStore.getState()).floors;

describe("floors", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 3 },
    { x: 0, y: 3 },
  ];

  it("adds, selects, and undoes a floor region", () => {
    state().addFloor(square, { kind: "solid", color: "#abcdef" });
    expect(floors()).toHaveLength(1);
    expect(state().selection).toEqual({ kind: "floor", id: floors()[0]!.id });
    state().undo();
    expect(floors()).toHaveLength(0);
  });

  it("a new floor that fully covers an old one replaces it", () => {
    state().addFloor(square, { kind: "solid", color: "#111111" });
    // A bigger region that fully contains the first replaces it.
    state().addFloor(
      [
        { x: -1, y: -1 },
        { x: 5, y: -1 },
        { x: 5, y: 5 },
        { x: -1, y: 5 },
      ],
      { kind: "solid", color: "#222222" },
    );
    expect(floors()).toHaveLength(1);
    expect(floors()[0]!.material).toEqual({ kind: "solid", color: "#222222" });
  });

  it("a partially overlapping floor keeps both (layered, newest on top)", () => {
    state().addFloor(square, { kind: "solid", color: "#111111" });
    state().addFloor(
      [
        { x: 1, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 6 },
        { x: 1, y: 6 },
      ],
      { kind: "solid", color: "#222222" },
    );
    expect(floors()).toHaveLength(2);
    // newest is last (renders on top of the covered area)
    expect(floors()[1]!.material).toEqual({ kind: "solid", color: "#222222" });
  });

  it("keeps a disjoint floor when adding another", () => {
    state().addFloor(square, { kind: "solid", color: "#111111" });
    state().addFloor(
      [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 12, y: 12 },
      ],
      { kind: "solid", color: "#222222" },
    );
    expect(floors()).toHaveLength(2);
  });

  it("updates a floor material and deletes it", () => {
    state().addFloor(square, { kind: "solid", color: "#abcdef" });
    const id = floors()[0]!.id;
    state().updateFloor(id, {
      material: {
        kind: "pattern",
        pattern: "tile",
        colorA: "#1",
        colorB: "#2",
      },
    });
    expect(floors()[0]!.material).toEqual({
      kind: "pattern",
      pattern: "tile",
      colorA: "#1",
      colorB: "#2",
    });
    state().deleteFloor(id);
    expect(floors()).toHaveLength(0);
    expect(state().selection).toBeNull();
  });
});

describe("currentMaterial", () => {
  it("updates the current material", () => {
    state().setCurrentMaterial({ kind: "solid", color: "#ff8800" });
    expect(state().currentMaterial).toEqual({
      kind: "solid",
      color: "#ff8800",
    });
  });
});

describe("doors", () => {
  const door = {
    t: 0.5,
    width: 0.9,
    height: 2.0,
    style: "single" as const,
    hinge: "start" as const,
    swing: "A" as const,
    material: { kind: "solid" as const, color: "#9a6b4f" },
  };

  it("adds, selects, and undoes a door", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const id = firstWallId();
    state().addDoor(id, door);
    expect(walls()[0]!.doors).toHaveLength(1);
    expect(state().selection).toEqual({
      kind: "door",
      wallId: id,
      id: walls()[0]!.doors[0]!.id,
    });
    state().undo();
    expect(walls()[0]!.doors).toHaveLength(0);
  });

  it("updates hinge/swing and moves as a single drag step", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const id = firstWallId();
    state().addDoor(id, door);
    const doorId = walls()[0]!.doors[0]!.id;
    state().updateDoor(id, doorId, { hinge: "end", swing: "B" });
    expect(walls()[0]!.doors[0]!.hinge).toBe("end");
    expect(walls()[0]!.doors[0]!.swing).toBe("B");

    const pastBefore = state().past.length;
    state().beginDrag();
    state().moveDoor(id, doorId, 0.4);
    state().moveDoor(id, doorId, 0.3);
    state().endDrag();
    expect(state().past.length).toBe(pastBefore + 1);
    expect(walls()[0]!.doors[0]!.t).toBeCloseTo(0.3);
  });

  it("coalesces door material edits and deletes the door", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const id = firstWallId();
    state().addDoor(id, door);
    const doorId = walls()[0]!.doors[0]!.id;
    const pastBefore = state().past.length;
    state().setDoorMaterial(id, doorId, { kind: "solid", color: "#111111" });
    state().setDoorMaterial(id, doorId, { kind: "solid", color: "#222222" });
    expect(state().past.length).toBe(pastBefore + 1); // coalesced
    expect(walls()[0]!.doors[0]!.material).toEqual({
      kind: "solid",
      color: "#222222",
    });
    state().deleteDoor(id, doorId);
    expect(walls()[0]!.doors).toHaveLength(0);
    expect(state().selection).toBeNull();
  });
});

const furniture = () => selectCurrentLevel(useStore.getState()).furniture;

describe("furniture", () => {
  it("places, selects, and undoes an item", () => {
    state().placeFurniture("sofa-3seat", { x: 2, y: 3 }, 0);
    expect(furniture()).toHaveLength(1);
    expect(state().selection).toEqual({
      kind: "furniture",
      id: furniture()[0]!.id,
    });
    state().undo();
    expect(furniture()).toHaveLength(0);
  });

  it("moves as a single drag step and rotates in snapped 15° steps", () => {
    state().placeFurniture("armchair", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    const pastBefore = state().past.length;
    state().beginDrag();
    state().moveFurniture(id, { x: 1, y: 0 });
    state().moveFurniture(id, { x: 1, y: 1 });
    state().endDrag();
    expect(state().past.length).toBe(pastBefore + 1);
    expect(furniture()[0]!.position).toEqual({ x: 1, y: 1 });

    state().rotateFurniture(id, 15);
    expect(furniture()[0]!.rotation).toBe(15);
    state().rotateFurniture(id, -30);
    expect(furniture()[0]!.rotation).toBe(345);
  });

  it("sets and resets per-slot materials (material edits coalesce)", () => {
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    const pastBefore = state().past.length;
    state().setFurnitureMaterial(id, "legs", {
      kind: "solid",
      color: "#111111",
    });
    state().setFurnitureMaterial(id, "legs", {
      kind: "solid",
      color: "#222222",
    });
    expect(state().past.length).toBe(pastBefore + 1); // coalesced
    expect(furniture()[0]!.materials.legs).toEqual({
      kind: "solid",
      color: "#222222",
    });
    state().resetFurnitureMaterials(id);
    expect(furniture()[0]!.materials).toEqual({});
  });

  it("deletes an item and clears its selection", () => {
    state().placeFurniture("rug", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    state().deleteFurniture(id);
    expect(furniture()).toHaveLength(0);
    expect(state().selection).toBeNull();
  });

  it("places new items at unit scale", () => {
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    expect(furniture()[0]!.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("clamps scale to the catalog policy and locks omitted axes", () => {
    // rug is axes { x:[0.3,4], z:[0.3,4] }, y locked.
    state().placeFurniture("rug", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    state().setFurnitureScale(id, { x: 9, y: 9, z: 0.1 });
    expect(furniture()[0]!.scale).toEqual({ x: 4, y: 1, z: 0.3 });
  });

  it("clamps a uniform item equally on every axis", () => {
    state().placeFurniture("armchair", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    state().setFurnitureScale(id, { x: 5, y: 5, z: 5 });
    // uniform [0.6,1.6] -> clamps to 1.6 on every axis
    expect(furniture()[0]!.scale).toEqual({ x: 1.6, y: 1.6, z: 1.6 });
  });

  it("forces unit scale for fixed-size (none) items", () => {
    state().placeFurniture("microwave", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    state().setFurnitureScale(id, { x: 1.5, y: 0.5, z: 2 });
    expect(furniture()[0]!.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("coalesces scale-slider edits into one undo step and resets size", () => {
    state().placeFurniture("rug", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    const pastBefore = state().past.length;
    state().setFurnitureScale(id, { x: 1.5, y: 1, z: 1 });
    state().setFurnitureScale(id, { x: 2.0, y: 1, z: 1 });
    expect(state().past.length).toBe(pastBefore + 1); // coalesced
    expect(furniture()[0]!.scale.x).toBe(2.0);
    state().resetFurnitureScale(id);
    expect(furniture()[0]!.scale).toEqual({ x: 1, y: 1, z: 1 });
    state().undo();
    expect(furniture()[0]!.scale.x).toBe(2.0);
  });
});

const levels = () => state().design.levels;

describe("levels", () => {
  it("adds a floor above, names + stacks it, and makes it active", () => {
    state().addLevelAbove();
    expect(levels()).toHaveLength(2);
    expect(levels()[1]!.name).toBe("Second floor");
    // bottom floor at 0, the floor above at wallHeight (2.4) + slab (0.2)
    expect(levels()[0]!.elevation).toBe(0);
    expect(levels()[1]!.elevation).toBeCloseTo(2.6);
    expect(state().currentLevelId).toBe(levels()[1]!.id);
  });

  it("re-stacks elevations and clears active when a lower level is deleted", () => {
    state().addLevelAbove(); // first
    state().addLevelAbove(); // second
    const groundId = levels()[0]!.id;
    const firstId = levels()[1]!.id;
    state().deleteLevel(firstId);
    expect(levels()).toHaveLength(2);
    expect(levels().map((l) => l.id)).not.toContain(firstId);
    // the (former second, now upper) level re-stacks to 2.6
    expect(levels()[1]!.elevation).toBeCloseTo(2.6);
    expect(levels()[0]!.id).toBe(groundId);
  });

  it("never deletes the last remaining level", () => {
    const id = levels()[0]!.id;
    state().deleteLevel(id);
    expect(levels()).toHaveLength(1);
  });

  it("renames a level (undoable)", () => {
    const id = levels()[0]!.id;
    state().renameLevel(id, "Basement");
    expect(levels()[0]!.name).toBe("Basement");
    state().undo();
    expect(levels()[0]!.name).toBe("First floor");
  });

  it("makes add/delete undoable", () => {
    state().addLevelAbove();
    expect(levels()).toHaveLength(2);
    state().undo();
    expect(levels()).toHaveLength(1);
    state().redo();
    expect(levels()).toHaveLength(2);
  });
});

describe("addRoom (rectangle tool)", () => {
  it("creates four joined walls with shared corners in one undo step", () => {
    const pastBefore = state().past.length;
    state().addRoom({ x: 0, y: 0 }, { x: 4, y: 3 });
    expect(walls()).toHaveLength(4);
    expect(state().past.length).toBe(pastBefore + 1);
    // every corner is shared by exactly two walls (closed loop)
    const ends = walls().flatMap((w) => [w.start, w.end]);
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    const counts = new Map<string, number>();
    for (const e of ends) counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
    expect(counts.size).toBe(4);
    state().undo();
    expect(walls()).toHaveLength(0);
  });

  it("ignores a degenerate (zero-area) rectangle", () => {
    state().addRoom({ x: 1, y: 1 }, { x: 1, y: 5 });
    expect(walls()).toHaveLength(0);
  });

  it("snaps a corner onto an existing wall endpoint", () => {
    state().addWall({ x: 0, y: 0 }, { x: 6, y: 0 });
    // a rectangle whose corner is just shy of (6,0) should fuse onto it
    state().addRoom({ x: 6.1, y: 0.1 }, { x: 9, y: 3 });
    const corners = walls()
      .flatMap((w) => [w.start, w.end])
      .filter((p) => Math.abs(p.x - 6) < 1e-9 && Math.abs(p.y - 0) < 1e-9);
    expect(corners.length).toBeGreaterThan(0);
  });
});

describe("copyWallsToAbove", () => {
  it("creates the floor above, copies walls + openings with fresh ids, switches active", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const wallId = walls()[0]!.id;
    state().addWindow(wallId, { t: 0.5, width: 1, height: 1, sillHeight: 0.9, style: "picture", muntinMaterial: { kind: "solid", color: "#eef0f2" } });
    const groundId = state().currentLevelId;
    state().copyWallsToAbove();
    expect(state().design.levels).toHaveLength(2);
    expect(state().currentLevelId).not.toBe(groundId); // switched to target
    const upper = state().design.levels[1]!;
    expect(upper.walls).toHaveLength(1);
    expect(upper.walls[0]!.id).not.toBe(wallId); // fresh id
    expect(upper.walls[0]!.windows).toHaveLength(1);
  });

  it("skips exact duplicates and is one undo step", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    state().copyWallsToAbove(); // creates first floor with the wall, active=first
    // back to ground and copy again into the existing first floor
    const groundId = state().design.levels[0]!.id;
    state().setCurrentLevel(groundId);
    const pastBefore = state().past.length;
    state().copyWallsToAbove();
    expect(state().design.levels[1]!.walls).toHaveLength(1); // dup skipped
    expect(state().past.length).toBe(pastBefore + 1);
    state().undo();
    // undo restores the active level + design; first floor still has its 1 wall
    expect(state().design.levels[1]!.walls).toHaveLength(1);
  });

  it("copies only the selected wall when ids are given", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    state().addWall({ x: 0, y: 2 }, { x: 4, y: 2 });
    const firstWall = walls()[0]!.id;
    state().copyWallsToAbove([firstWall]);
    expect(state().design.levels[1]!.walls).toHaveLength(1);
  });
});

describe("furniture collision (hard mode)", () => {
  beforeEach(() => state().setCollisionMode("hard"));

  it("blocks placing a collidable item onto another, allows a clear spot", () => {
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    expect(furniture()).toHaveLength(1);
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0); // overlaps -> blocked
    expect(furniture()).toHaveLength(1);
    state().placeFurniture("sofa-3seat", { x: 6, y: 6 }, 0); // clear -> placed
    expect(furniture()).toHaveLength(2);
  });

  it("never blocks non-collidable items (rug over a sofa)", () => {
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    state().placeFurniture("rug", { x: 0, y: 0 }, 0);
    expect(furniture()).toHaveLength(2);
  });

  it("reverts a rotation that would overlap a neighbor", () => {
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    const aId = furniture()[0]!.id;
    state().placeFurniture("sofa-3seat", { x: 0, y: 1.3 }, 0); // fits at rot 0
    expect(furniture()).toHaveLength(2);
    state().rotateFurniture(aId, 90); // rot 90 would overlap -> revert
    expect(furniture().find((f) => f.id === aId)!.rotation).toBe(0);
  });
});

describe("collision off/soft never block", () => {
  it("off and soft both allow overlapping placement", () => {
    state().setCollisionMode("off");
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    expect(furniture()).toHaveLength(2);
    state().setCollisionMode("soft");
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0);
    expect(furniture()).toHaveLength(3);
  });
});

const stairs = () => selectCurrentLevel(useStore.getState()).staircases;

describe("staircases", () => {
  it("places a stair on the active level, auto-creating the level above", () => {
    expect(state().design.levels).toHaveLength(1);
    state().placeStaircase({ x: 2, y: 2 }, 0);
    expect(state().design.levels).toHaveLength(2); // upper auto-created
    expect(stairs()).toHaveLength(1); // on the (lower) active level
    expect(state().currentLevelId).toBe(state().design.levels[0]!.id); // stays lower
    expect(state().selection).toEqual({
      kind: "staircase",
      id: stairs()[0]!.id,
    });
  });

  it("adds to the existing level above instead of creating another", () => {
    state().addLevelAbove(); // creates first floor, active = first
    state().setCurrentLevel(state().design.levels[0]!.id); // back to ground
    state().placeStaircase({ x: 1, y: 1 }, 0);
    expect(state().design.levels).toHaveLength(2); // no extra level
  });

  it("rotates in 15° steps, moves, and deletes (undoable)", () => {
    state().placeStaircase({ x: 0, y: 0 }, 0);
    const id = stairs()[0]!.id;
    state().rotateStaircase(id, 90);
    expect(stairs()[0]!.rotation).toBe(90);
    state().updateStaircase(id, { width: 1.4 });
    expect(stairs()[0]!.width).toBe(1.4);
    state().deleteStaircase(id);
    expect(stairs()).toHaveLength(0);
    state().undo(); // undo delete
    expect(stairs()).toHaveLength(1);
  });

  it("collides with furniture in Hard mode (stair blocks a sofa drop)", () => {
    state().setCollisionMode("hard");
    state().placeStaircase({ x: 0, y: 0 }, 0);
    expect(stairs()).toHaveLength(1);
    state().placeFurniture("sofa-3seat", { x: 0, y: 0 }, 0); // over the stair
    expect(
      selectCurrentLevel(useStore.getState()).furniture,
    ).toHaveLength(0); // blocked
    state().setCollisionMode("soft");
  });
});

describe("fillRoom", () => {
  const closeRoom = () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    state().addWall({ x: 4, y: 0 }, { x: 4, y: 3 });
    state().addWall({ x: 4, y: 3 }, { x: 0, y: 3 });
    state().addWall({ x: 0, y: 3 }, { x: 0, y: 0 });
  };

  it("fills floor + paints interior walls in one undo step", () => {
    closeRoom();
    const pastBefore = state().past.length;
    const ok = state().fillRoom({ x: 2, y: 1.5 }, "both");
    expect(ok).toBe(true);
    expect(floors()).toHaveLength(1);
    expect(state().past.length).toBe(pastBefore + 1);
    state().undo();
    expect(floors()).toHaveLength(0);
  });

  it("returns false and changes nothing for an open room", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    state().addWall({ x: 4, y: 0 }, { x: 4, y: 3 });
    state().addWall({ x: 4, y: 3 }, { x: 0, y: 3 }); // left wall missing
    const pastBefore = state().past.length;
    const ok = state().fillRoom({ x: 2, y: 1.5 }, "both");
    expect(ok).toBe(false);
    expect(floors()).toHaveLength(0);
    expect(state().past.length).toBe(pastBefore);
  });

  it("re-filling the same room replaces rather than stacking floors", () => {
    closeRoom();
    state().fillRoom({ x: 2, y: 1.5 }, "floor");
    state().fillRoom({ x: 2, y: 1.5 }, "floor");
    expect(floors()).toHaveLength(1);
  });

  it("walls-only paints interior faces and adds no floor", () => {
    closeRoom();
    const ok = state().fillRoom({ x: 2, y: 1.5 }, "walls");
    expect(ok).toBe(true);
    expect(floors()).toHaveLength(0);
    const painted = walls().some(
      (w) =>
        (w.paintA.kind === "solid" && w.paintA.color !== "#e8e4dc") ||
        (w.paintB.kind === "solid" && w.paintB.color !== "#e8e4dc"),
    );
    expect(painted).toBe(true);
  });
});

describe("furniture vs wall collision (hard mode)", () => {
  beforeEach(() => state().setCollisionMode("hard"));

  it("blocks placing furniture overlapping a wall, allows a clear spot", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    state().placeFurniture("sofa-3seat", { x: 2, y: 0 }, 0); // on the wall
    expect(selectCurrentLevel(useStore.getState()).furniture).toHaveLength(0);
    state().placeFurniture("sofa-3seat", { x: 2, y: 2 }, 0); // clear of the wall
    expect(selectCurrentLevel(useStore.getState()).furniture).toHaveLength(1);
    state().setCollisionMode("soft");
  });
});

describe("furniture vs stairwell opening (hard mode)", () => {
  it("blocks furniture placed over the floor hole on the level above", () => {
    state().placeStaircase({ x: 2, y: 2 }, 0); // ground; auto-creates upper level
    const upperId = state().design.levels[1]!.id;
    state().setCurrentLevel(upperId);
    state().setCollisionMode("hard");
    state().placeFurniture("sofa-3seat", { x: 2, y: 2 }, 0); // over the opening
    expect(selectCurrentLevel(useStore.getState()).furniture).toHaveLength(0);
    state().placeFurniture("sofa-3seat", { x: 12, y: 12 }, 0); // clear
    expect(selectCurrentLevel(useStore.getState()).furniture).toHaveLength(1);
    state().setCollisionMode("soft");
  });
});

describe("wall mounts", () => {
  const mounts = () => walls()[0]!.mounts;

  it("adds, selects, updates, and deletes a wall mount (undoable)", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const wallId = walls()[0]!.id;
    state().addWallMount(wallId, {
      catalogId: "wall-tv",
      t: 0.5,
      heightUpWall: 1.3,
      face: "A",
      scale: { x: 1, y: 1, z: 1 },
      materials: {},
    });
    expect(mounts()).toHaveLength(1);
    const mountId = mounts()[0]!.id;
    expect(state().selection).toEqual({ kind: "wallMount", wallId, id: mountId });

    state().updateWallMount(wallId, mountId, { heightUpWall: 1.6, face: "B" });
    expect(mounts()[0]!.heightUpWall).toBe(1.6);
    expect(mounts()[0]!.face).toBe("B");

    state().undo(); // revert the update
    expect(mounts()[0]!.heightUpWall).toBe(1.3);
    expect(mounts()[0]!.face).toBe("A");

    state().deleteWallMount(wallId, mountId);
    expect(mounts()).toHaveLength(0);
    state().undo();
    expect(mounts()).toHaveLength(1);
  });

  it("clamps a mount's scale to the catalog policy", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const wallId = walls()[0]!.id;
    state().addWallMount(wallId, {
      catalogId: "wall-tv",
      t: 0.5,
      heightUpWall: 1.3,
      face: "A",
      scale: { x: 1, y: 1, z: 1 },
      materials: {},
    });
    const mountId = walls()[0]!.mounts[0]!.id;
    // wall-tv allows x in [0.6, 1.8]; an over-range value clamps.
    state().setWallMountScale(wallId, mountId, { x: 5, y: 1, z: 1 });
    expect(walls()[0]!.mounts[0]!.scale.x).toBeCloseTo(1.8, 5);
  });

  it("carries mounts when the wall is copied to the floor above", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const wallId = walls()[0]!.id;
    state().addWallMount(wallId, {
      catalogId: "wall-art",
      t: 0.4,
      heightUpWall: 1.6,
      face: "A",
      scale: { x: 1, y: 1, z: 1 },
      materials: {},
    });
    const originalMountId = walls()[0]!.mounts[0]!.id;
    state().copyWallsToAbove([wallId]);
    // active level switched to the new upper level; its wall has a fresh mount.
    const upper = selectCurrentLevel(useStore.getState());
    expect(upper.walls[0]!.mounts).toHaveLength(1);
    expect(upper.walls[0]!.mounts[0]!.catalogId).toBe("wall-art");
    expect(upper.walls[0]!.mounts[0]!.id).not.toBe(originalMountId);
  });
});

describe("height-aware collision (hard mode tuck-under)", () => {
  const furn = () => selectCurrentLevel(useStore.getState()).furniture;

  it("lets a dining chair tuck under a dining table but blocks a wardrobe", () => {
    state().placeFurniture("dining-table", { x: 5, y: 5 }, 0);
    state().setCollisionMode("hard");
    // chair tucks under the table -> placed
    state().placeFurniture("dining-chair", { x: 5, y: 5 }, 0);
    expect(furn().filter((f) => f.catalogId === "dining-chair")).toHaveLength(1);
    // a wardrobe over the same spot collides (no leg clearance) -> blocked
    state().placeFurniture("wardrobe", { x: 5, y: 5 }, 0);
    expect(furn().filter((f) => f.catalogId === "wardrobe")).toHaveLength(0);
    state().setCollisionMode("soft");
  });

  it("still blocks a second overlapping chair (two chairs collide)", () => {
    state().placeFurniture("dining-chair", { x: 5, y: 5 }, 0);
    state().setCollisionMode("hard");
    state().placeFurniture("dining-chair", { x: 5, y: 5 }, 0);
    expect(furn().filter((f) => f.catalogId === "dining-chair")).toHaveLength(1);
    state().setCollisionMode("soft");
  });
});

const roofs = () => selectCurrentLevel(useStore.getState()).roofs;

describe("manual roofs (Phase 5.2)", () => {
  it("places a roof centered on the dragged rectangle, defaulting to gabled", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    expect(roofs()).toHaveLength(1);
    expect(roofs()[0]!.type).toBe("gabled");
    expect(roofs()[0]!.position).toEqual({ x: 2, y: 1.5 });
    expect(roofs()[0]!.width).toBe(4);
    expect(roofs()[0]!.depth).toBe(3);
    // Placing selects the new roof.
    expect(state().selection).toEqual({ kind: "roof", id: roofs()[0]!.id });
  });

  it("never auto-generates a roof when walls are drawn", () => {
    state().addRoom({ x: 0, y: 0 }, { x: 4, y: 3 });
    expect(roofs()).toHaveLength(0);
  });

  it("places two independent roofs for an L-shape", () => {
    state().addRoof({ x: 2, y: 2 }, 4, 4);
    state().addRoof({ x: 6, y: 2 }, 4, 2);
    expect(roofs()).toHaveLength(2);
  });

  it("edits a roof's fields undoably", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    const id = roofs()[0]!.id;
    state().updateRoof(id, { type: "hipped" });
    expect(roofs()[0]!.type).toBe("hipped");
    state().undo();
    expect(roofs()[0]!.type).toBe("gabled");
  });

  it("rotates a roof in 15° steps", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    const id = roofs()[0]!.id;
    state().rotateRoof(id, 20);
    expect(roofs()[0]!.rotation).toBe(15);
  });

  it("deletes a roof and clears its selection", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    const id = roofs()[0]!.id;
    state().deleteRoof(id);
    expect(roofs()).toHaveLength(0);
    expect(state().selection).toBeNull();
  });

  it("reassigns a roof to another floor and follows it (active level switches)", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    const roofId = roofs()[0]!.id;
    const groundId = useStore.getState().currentLevelId;
    state().addLevelAbove(); // creates + switches to the upper level
    const upperId = useStore.getState().currentLevelId;
    state().setCurrentLevel(groundId); // back to the roof's level
    state().moveRoofToLevel(roofId, upperId);
    // The active level follows the roof to the target, where it now lives.
    expect(useStore.getState().currentLevelId).toBe(upperId);
    expect(roofs()).toHaveLength(1);
    const ground = useStore
      .getState()
      .design.levels.find((l) => l.id === groundId)!;
    expect(ground.roofs).toHaveLength(0);
    expect(state().selection).toEqual({ kind: "roof", id: roofId });
    state().undo();
    expect(useStore.getState().currentLevelId).toBe(upperId);
  });

  it("leaves roofs untouched when a floor above is added", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    const groundId = useStore.getState().currentLevelId;
    expect(roofs()).toHaveLength(1);
    state().addLevelAbove();
    expect(roofs()).toHaveLength(0); // active level is now the (roofless) upper one
    const ground = useStore
      .getState()
      .design.levels.find((l) => l.id === groundId)!;
    expect(ground.roofs).toHaveLength(1);
  });

  it("never re-tops or moves a lower roof when walls are copied up", () => {
    state().addRoom({ x: 0, y: 0 }, { x: 4, y: 3 });
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    const groundId = useStore.getState().currentLevelId;
    state().copyWallsToAbove();
    // Upper level got walls but NO roof; the ground roof is unchanged.
    expect(roofs()).toHaveLength(0);
    const ground = useStore
      .getState()
      .design.levels.find((l) => l.id === groundId)!;
    expect(ground.roofs).toHaveLength(1);
    expect(ground.roofs[0]!.position).toEqual({ x: 2, y: 1.5 });
  });
});

describe("auto roof (Phase 6.2)", () => {
  const closeRoom = () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    state().addWall({ x: 4, y: 0 }, { x: 4, y: 3 });
    state().addWall({ x: 4, y: 3 }, { x: 0, y: 3 });
    state().addWall({ x: 0, y: 3 }, { x: 0, y: 0 });
  };

  it("generates ONE polygon roof fitted to an enclosed room, selected, one undo", () => {
    closeRoom();
    const pastBefore = state().past.length;
    const res = state().addRoofAuto({ x: 2, y: 1.5 });
    expect(res.generated).toBe(true);
    expect(res.rectilinear).toBe(true);
    expect(roofs()).toHaveLength(1);
    const roof = roofs()[0]!;
    expect(roof.shape).toBe("polygon");
    expect(roof.footprint && roof.footprint.length).toBeGreaterThanOrEqual(4);
    expect(roof.type).toBe("gabled"); // default
    expect(state().selection).toEqual({ kind: "roof", id: roof.id });
    expect(state().past.length).toBe(pastBefore + 1);
    state().undo();
    expect(roofs()).toHaveLength(0);
  });

  it("generates nothing for an unenclosed area", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    state().addWall({ x: 4, y: 0 }, { x: 4, y: 3 });
    state().addWall({ x: 4, y: 3 }, { x: 0, y: 3 }); // left wall missing
    const res = state().addRoofAuto({ x: 2, y: 1.5 });
    expect(res.generated).toBe(false);
    expect(roofs()).toHaveLength(0);
  });

  it("covers an L-shaped room's true footprint (more than 4 corners)", () => {
    // An L: outer 6x6 with a 3x3 notch removed from the bottom-right.
    state().addWall({ x: 0, y: 0 }, { x: 6, y: 0 });
    state().addWall({ x: 6, y: 0 }, { x: 6, y: 3 });
    state().addWall({ x: 6, y: 3 }, { x: 3, y: 3 });
    state().addWall({ x: 3, y: 3 }, { x: 3, y: 6 });
    state().addWall({ x: 3, y: 6 }, { x: 0, y: 6 });
    state().addWall({ x: 0, y: 6 }, { x: 0, y: 0 });
    const res = state().addRoofAuto({ x: 1, y: 1 });
    expect(res.generated).toBe(true);
    expect(roofs()[0]!.footprint!.length).toBeGreaterThanOrEqual(6);
  });

  it("a generated roof survives wall edits (footprint is static)", () => {
    closeRoom();
    state().addRoofAuto({ x: 2, y: 1.5 });
    const before = JSON.stringify(roofs()[0]!.footprint);
    // Add another wall — the captured footprint must not change.
    state().addWall({ x: 10, y: 10 }, { x: 12, y: 10 });
    expect(JSON.stringify(roofs()[0]!.footprint)).toBe(before);
  });

  it("moves a polygon roof by translating its whole footprint", () => {
    closeRoom();
    state().addRoofAuto({ x: 2, y: 1.5 });
    const roof = roofs()[0]!;
    const before = roof.footprint!.map((p) => ({ ...p }));
    state().beginDrag();
    state().moveRoof(roof.id, { x: roof.position.x + 1, y: roof.position.y });
    state().endDrag();
    const after = roofs()[0]!.footprint!;
    after.forEach((p, i) => {
      expect(p.x).toBeCloseTo(before[i]!.x + 1, 6);
      expect(p.y).toBeCloseTo(before[i]!.y, 6);
    });
  });
});

const furn = () => selectCurrentLevel(useStore.getState()).furniture;

describe("copy / paste", () => {
  it("copies and pastes a roof with a fresh id, offset and selected", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    const id = roofs()[0]!.id;
    expect(state().copySelection()).toBe(true);
    expect(state().pasteClipboard()).toBe(true);
    expect(roofs()).toHaveLength(2);
    const copy = roofs()[1]!;
    expect(copy.id).not.toBe(id);
    expect(copy.position).toEqual({ x: 2.5, y: 2 });
    expect(copy.width).toBe(4);
    expect(state().selection).toEqual({ kind: "roof", id: copy.id });
  });

  it("copies and pastes furniture", () => {
    state().placeFurniture("dining-chair", { x: 1, y: 1 }, 30);
    state().copySelection();
    state().pasteClipboard();
    const chairs = furn().filter((f) => f.catalogId === "dining-chair");
    expect(chairs).toHaveLength(2);
    expect(chairs[1]!.position).toEqual({ x: 1.5, y: 1.5 });
    expect(chairs[1]!.rotation).toBe(30);
    expect(chairs[1]!.id).not.toBe(chairs[0]!.id);
  });

  it("copies a wall with its openings under fresh ids", () => {
    state().addWall({ x: 0, y: 0 }, { x: 4, y: 0 });
    const wallId = walls()[0]!.id;
    state().addWindow(wallId, { t: 0.5, width: 1, height: 1, sillHeight: 0.9, style: "picture", muntinMaterial: { kind: "solid", color: "#eef0f2" } });
    state().setSelection({ kind: "wall", id: wallId });
    state().copySelection();
    state().pasteClipboard();
    expect(walls()).toHaveLength(2);
    const copy = walls()[1]!;
    expect(copy.id).not.toBe(wallId);
    expect(copy.start).toEqual({ x: 0.5, y: 0.5 });
    expect(copy.windows).toHaveLength(1);
    expect(copy.windows[0]!.id).not.toBe(walls()[0]!.windows[0]!.id);
  });

  it("pastes across floors (clipboard survives a level switch)", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    state().copySelection();
    state().addLevelAbove(); // switches to the new upper level
    expect(roofs()).toHaveLength(0);
    state().pasteClipboard();
    expect(roofs()).toHaveLength(1);
  });

  it("is a no-op with an empty clipboard or an uncopyable selection", () => {
    expect(state().pasteClipboard()).toBe(false);
    state().addFloor(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ],
      { kind: "solid", color: "#fff" },
    );
    // A floor is selected but not copyable.
    expect(state().copySelection()).toBe(false);
  });

  it("paste is one undo step", () => {
    state().addRoof({ x: 2, y: 1.5 }, 4, 3);
    state().copySelection();
    state().pasteClipboard();
    expect(roofs()).toHaveLength(2);
    state().undo();
    expect(roofs()).toHaveLength(1);
  });
});
