import { create } from "zustand";
import type {
  Design,
  FloorRegion,
  Level,
  MaterialRef,
  Vec2,
  Wall,
  WindowOpening,
} from "../model/types";
import {
  createDesign,
  createFloor,
  createWall,
  createWindow,
} from "../model/defaults";
import {
  loadViewPrefs,
  saveViewPrefs,
  type CutawayStyle,
  type Layout,
  type ViewMode,
} from "../persistence/viewPrefs";

export type Tool = "select" | "wall" | "window" | "floor" | "paint";
export type WallSide = "A" | "B";
export type Selection =
  | { kind: "wall"; id: string }
  | { kind: "window"; wallId: string; id: string }
  | { kind: "floor"; id: string }
  | null;

const HISTORY_CAP = 100;

const clone = <T>(value: T): T => structuredClone(value);

function levelOf(design: Design, levelId: string): Level {
  const level = design.levels.find((l) => l.id === levelId);
  if (!level) {
    // currentLevelId should always be valid; fall back rather than crash.
    const first = design.levels[0];
    if (!first) throw new Error("Design has no levels");
    return first;
  }
  return level;
}

function findWall(
  design: Design,
  levelId: string,
  wallId: string,
): Wall | undefined {
  return levelOf(design, levelId).walls.find((w) => w.id === wallId);
}

function findWindow(
  design: Design,
  levelId: string,
  wallId: string,
  windowId: string,
): WindowOpening | undefined {
  return findWall(design, levelId, wallId)?.windows.find(
    (w) => w.id === windowId,
  );
}

function findFloor(
  design: Design,
  levelId: string,
  floorId: string,
): FloorRegion | undefined {
  return levelOf(design, levelId).floors.find((f) => f.id === floorId);
}

// Does a selection still point at something that exists?
function selectionExists(
  design: Design,
  levelId: string,
  sel: Selection,
): boolean {
  if (!sel) return false;
  if (sel.kind === "wall") return !!findWall(design, levelId, sel.id);
  if (sel.kind === "window")
    return !!findWindow(design, levelId, sel.wallId, sel.id);
  return !!findFloor(design, levelId, sel.id);
}

interface AppState {
  design: Design;
  currentLevelId: string;
  activeTool: Tool;
  selection: Selection;

  // Transient hover hint: which wall side to spotlight in the plan (paint tool
  // hover and the properties-panel side chips). Not persisted, not in history.
  sideHighlight: { wallId: string; side: WallSide } | null;

  // 3D view preferences (persisted to localStorage, never in the Design).
  viewMode: ViewMode;
  cutawayStyle: CutawayStyle;
  layout: Layout;

  // The material the paint and floor tools apply (a UI preference, persisted).
  currentMaterial: MaterialRef;

  // Undo/redo: snapshots of the whole Design taken before each committed action.
  past: Design[];
  future: Design[];
  // Baseline captured at the start of a drag; used to record exactly one history
  // entry per drag and to detect no-op drags. Null when not dragging.
  dragBaseline: Design | null;
  // Collapse rapid commits to the same target (e.g. dragging the color wheel)
  // into a single undo step. Internal.
  coalesceKey: string | null;
  coalesceAt: number;

  // --- view/selection actions ---
  setActiveTool: (tool: Tool) => void;
  setSelection: (selection: Selection) => void;
  setSideHighlight: (
    highlight: { wallId: string; side: WallSide } | null,
  ) => void;
  setViewMode: (mode: ViewMode) => void;
  setCutawayStyle: (style: CutawayStyle) => void;
  setLayout: (layout: Layout) => void;
  setCurrentMaterial: (material: MaterialRef) => void;

  // --- committed mutations (each = one undo step) ---
  addWall: (start: Vec2, end: Vec2) => void;
  updateWall: (id: string, patch: Partial<Omit<Wall, "id">>) => void;
  deleteWall: (id: string) => void;
  paintWallSide: (id: string, side: WallSide, material: MaterialRef) => void;
  addWindow: (wallId: string, window: Omit<WindowOpening, "id">) => void;
  updateWindow: (
    wallId: string,
    id: string,
    patch: Partial<Omit<WindowOpening, "id">>,
  ) => void;
  deleteWindow: (wallId: string, id: string) => void;
  addFloor: (polygon: Vec2[], material: MaterialRef) => void;
  updateFloor: (id: string, patch: Partial<Omit<FloorRegion, "id">>) => void;
  setFloorMaterial: (id: string, material: MaterialRef) => void;
  deleteFloor: (id: string) => void;
  setDesign: (design: Design) => void;
  newDesign: () => void;

  // --- drag session (transient until endDrag) ---
  beginDrag: () => void;
  moveWallEndpoint: (id: string, which: "start" | "end", point: Vec2) => void;
  translateWall: (id: string, start: Vec2, end: Vec2) => void;
  moveWindow: (wallId: string, id: string, t: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;

  // --- history ---
  undo: () => void;
  redo: () => void;
}

export const useStore = create<AppState>((set, get) => {
  // Snapshot the current Design onto the undo stack and clear the redo stack.
  const pushHistory = () => {
    const { design, past } = get();
    const next = [...past, clone(design)];
    while (next.length > HISTORY_CAP) next.shift();
    set({ past: next, future: [], coalesceKey: null });
  };

  // Commit a material/property change, collapsing rapid edits to the same target
  // (e.g. dragging the color wheel) into a single undo step.
  const commitCoalesced = (key: string, producer: (d: Design) => void) => {
    const now = Date.now();
    const s = get();
    const coalesce = s.coalesceKey === key && now - s.coalesceAt < 1200;
    if (!coalesce) {
      const next = [...s.past, clone(s.design)];
      while (next.length > HISTORY_CAP) next.shift();
      set({ past: next, future: [] });
    }
    const design = clone(get().design);
    producer(design);
    set({ design, coalesceKey: key, coalesceAt: now });
  };

  // Drop a selection that no longer points at an existing entity.
  const sanitizeSelection = (
    design: Design,
    levelId: string,
    sel: Selection,
  ): Selection => (selectionExists(design, levelId, sel) ? sel : null);

  const initialDesign = createDesign();
  const prefs = loadViewPrefs();

  // Write the current view prefs through to localStorage after a change.
  const persistViewPrefs = () => {
    const { viewMode, cutawayStyle, layout, currentMaterial } = get();
    saveViewPrefs({ viewMode, cutawayStyle, layout, currentMaterial });
  };

  return {
    design: initialDesign,
    currentLevelId: initialDesign.levels[0]!.id,
    activeTool: "wall",
    selection: null,
    sideHighlight: null,
    viewMode: prefs.viewMode,
    cutawayStyle: prefs.cutawayStyle,
    layout: prefs.layout,
    currentMaterial: prefs.currentMaterial,
    past: [],
    future: [],
    dragBaseline: null,
    coalesceKey: null,
    coalesceAt: 0,

    setActiveTool: (tool) => set({ activeTool: tool }),
    setSelection: (selection) => set({ selection }),
    setSideHighlight: (sideHighlight) => set({ sideHighlight }),
    setViewMode: (viewMode) => {
      set({ viewMode });
      persistViewPrefs();
    },
    setCutawayStyle: (cutawayStyle) => {
      set({ cutawayStyle });
      persistViewPrefs();
    },
    setLayout: (layout) => {
      set({ layout });
      persistViewPrefs();
    },
    setCurrentMaterial: (currentMaterial) => {
      set({ currentMaterial });
      persistViewPrefs();
    },

    addWall: (start, end) => {
      pushHistory();
      const wall = createWall(start, end);
      set((s) => {
        const design = clone(s.design);
        levelOf(design, s.currentLevelId).walls.push(wall);
        return { design, selection: { kind: "wall", id: wall.id } };
      });
    },

    updateWall: (id, patch) => {
      const existing = findWall(get().design, get().currentLevelId, id);
      if (!existing) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const wall = findWall(design, s.currentLevelId, id);
        if (wall) Object.assign(wall, patch);
        return { design };
      });
    },

    deleteWall: (id) => {
      const existing = findWall(get().design, get().currentLevelId, id);
      if (!existing) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        level.walls = level.walls.filter((w) => w.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    paintWallSide: (id, side, material) => {
      if (!findWall(get().design, get().currentLevelId, id)) return;
      commitCoalesced(`paint:${id}:${side}`, (design) => {
        const wall = findWall(design, get().currentLevelId, id);
        if (wall) {
          if (side === "A") wall.paintA = clone(material);
          else wall.paintB = clone(material);
        }
      });
    },

    addWindow: (wallId, window) => {
      const wall = findWall(get().design, get().currentLevelId, wallId);
      if (!wall) return;
      pushHistory();
      const win = createWindow(window);
      set((s) => {
        const design = clone(s.design);
        findWall(design, s.currentLevelId, wallId)?.windows.push(win);
        return { design, selection: { kind: "window", wallId, id: win.id } };
      });
    },

    updateWindow: (wallId, id, patch) => {
      const existing = findWindow(
        get().design,
        get().currentLevelId,
        wallId,
        id,
      );
      if (!existing) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const win = findWindow(design, s.currentLevelId, wallId, id);
        if (win) Object.assign(win, patch);
        return { design };
      });
    },

    deleteWindow: (wallId, id) => {
      const wall = findWall(get().design, get().currentLevelId, wallId);
      if (!wall) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const w = findWall(design, s.currentLevelId, wallId);
        if (w) w.windows = w.windows.filter((win) => win.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    addFloor: (polygon, material) => {
      pushHistory();
      const floor = createFloor(polygon, material);
      set((s) => {
        const design = clone(s.design);
        levelOf(design, s.currentLevelId).floors.push(floor);
        return { design, selection: { kind: "floor", id: floor.id } };
      });
    },

    updateFloor: (id, patch) => {
      const existing = findFloor(get().design, get().currentLevelId, id);
      if (!existing) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const floor = findFloor(design, s.currentLevelId, id);
        if (floor) Object.assign(floor, patch);
        return { design };
      });
    },

    setFloorMaterial: (id, material) => {
      if (!findFloor(get().design, get().currentLevelId, id)) return;
      commitCoalesced(`floor-mat:${id}`, (design) => {
        const floor = findFloor(design, get().currentLevelId, id);
        if (floor) floor.material = clone(material);
      });
    },

    deleteFloor: (id) => {
      const existing = findFloor(get().design, get().currentLevelId, id);
      if (!existing) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        level.floors = level.floors.filter((f) => f.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    setDesign: (design) => {
      pushHistory();
      const next = clone(design);
      set({
        design: next,
        currentLevelId: next.levels[0]!.id,
        selection: null,
      });
    },

    newDesign: () => {
      pushHistory();
      const design = createDesign();
      set({
        design,
        currentLevelId: design.levels[0]!.id,
        selection: null,
      });
    },

    beginDrag: () => set((s) => ({ dragBaseline: clone(s.design) })),

    moveWallEndpoint: (id, which, point) =>
      set((s) => {
        const design = clone(s.design);
        const wall = findWall(design, s.currentLevelId, id);
        if (!wall) return {};
        if (which === "start") wall.start = point;
        else wall.end = point;
        return { design };
      }),

    translateWall: (id, start, end) =>
      set((s) => {
        const design = clone(s.design);
        const wall = findWall(design, s.currentLevelId, id);
        if (!wall) return {};
        wall.start = start;
        wall.end = end;
        return { design };
      }),

    moveWindow: (wallId, id, t) =>
      set((s) => {
        const design = clone(s.design);
        const win = findWindow(design, s.currentLevelId, wallId, id);
        if (!win) return {};
        win.t = t;
        return { design };
      }),

    endDrag: () =>
      set((s) => {
        const baseline = s.dragBaseline;
        if (!baseline) return { dragBaseline: null };
        // Commit one history entry only if the drag actually changed something.
        const changed = JSON.stringify(baseline) !== JSON.stringify(s.design);
        if (!changed) return { dragBaseline: null };
        const next = [...s.past, baseline];
        while (next.length > HISTORY_CAP) next.shift();
        return { past: next, future: [], dragBaseline: null };
      }),

    cancelDrag: () =>
      set((s) => {
        if (!s.dragBaseline) return {};
        return { design: s.dragBaseline, dragBaseline: null };
      }),

    undo: () =>
      set((s) => {
        const prev = s.past[s.past.length - 1];
        if (!prev) return {};
        const past = s.past.slice(0, -1);
        const future = [clone(s.design), ...s.future];
        return {
          design: prev,
          past,
          future,
          selection: sanitizeSelection(prev, s.currentLevelId, s.selection),
        };
      }),

    redo: () =>
      set((s) => {
        const next = s.future[0];
        if (!next) return {};
        const future = s.future.slice(1);
        const past = [...s.past, clone(s.design)];
        while (past.length > HISTORY_CAP) past.shift();
        return {
          design: next,
          past,
          future,
          selection: sanitizeSelection(next, s.currentLevelId, s.selection),
        };
      }),
  };
});

// Convenience selector: the level currently shown in the UI.
export function selectCurrentLevel(s: AppState): Level {
  return levelOf(s.design, s.currentLevelId);
}
