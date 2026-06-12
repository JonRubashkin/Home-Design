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
