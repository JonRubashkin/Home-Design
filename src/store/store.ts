import { create } from "zustand";
import type { Design, Level, Vec2, Wall } from "../model/types";
import { createDesign, createWall } from "../model/defaults";

export type Tool = "select" | "wall";
export type Selection = { kind: "wall"; id: string } | null;

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

interface AppState {
  design: Design;
  currentLevelId: string;
  activeTool: Tool;
  selection: Selection;

  // Undo/redo: snapshots of the whole Design taken before each committed action.
  past: Design[];
  future: Design[];
  // Baseline captured at the start of a drag; used to record exactly one history
  // entry per drag and to detect no-op drags. Null when not dragging.
  dragBaseline: Design | null;

  // --- view/selection actions ---
  setActiveTool: (tool: Tool) => void;
  setSelection: (selection: Selection) => void;

  // --- committed mutations (each = one undo step) ---
  addWall: (start: Vec2, end: Vec2) => void;
  updateWall: (id: string, patch: Partial<Omit<Wall, "id">>) => void;
  deleteWall: (id: string) => void;
  setDesign: (design: Design) => void;
  newDesign: () => void;

  // --- drag session (transient until endDrag) ---
  beginDrag: () => void;
  moveWallEndpoint: (id: string, which: "start" | "end", point: Vec2) => void;
  translateWall: (id: string, start: Vec2, end: Vec2) => void;
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
    set({ past: next, future: [] });
  };

  // Drop a selection that no longer points at an existing wall.
  const sanitizeSelection = (
    design: Design,
    levelId: string,
    sel: Selection,
  ): Selection => {
    if (sel && !findWall(design, levelId, sel.id)) return null;
    return sel;
  };

  const initialDesign = createDesign();

  return {
    design: initialDesign,
    currentLevelId: initialDesign.levels[0]!.id,
    activeTool: "wall",
    selection: null,
    past: [],
    future: [],
    dragBaseline: null,

    setActiveTool: (tool) => set({ activeTool: tool }),
    setSelection: (selection) => set({ selection }),

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
        const selection = s.selection?.id === id ? null : s.selection;
        return { design, selection };
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
