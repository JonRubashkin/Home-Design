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
    state().addWindow(id, { t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9 });
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
    state().addWindow(id, { t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9 });
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
    state().addWindow(id, { t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9 });
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
    // rug is axes { x:[0.5,2.5], z:[0.5,2.5] }, y locked.
    state().placeFurniture("rug", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    state().setFurnitureScale(id, { x: 9, y: 9, z: 0.1 });
    expect(furniture()[0]!.scale).toEqual({ x: 2.5, y: 1, z: 0.5 });
  });

  it("clamps a uniform item equally on every axis", () => {
    state().placeFurniture("armchair", { x: 0, y: 0 }, 0);
    const id = furniture()[0]!.id;
    state().setFurnitureScale(id, { x: 1.5, y: 1.5, z: 1.5 });
    // uniform [0.85,1.2] -> clamps to 1.2 on every axis
    expect(furniture()[0]!.scale).toEqual({ x: 1.2, y: 1.2, z: 1.2 });
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
