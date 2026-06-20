import { create } from "zustand";
import type {
  CeilingLight,
  Design,
  DoorOpening,
  FloorRegion,
  FurnitureItem,
  Level,
  MaterialRef,
  Roof,
  Site,
  Staircase,
  Vec2,
  Vec3,
  Wall,
  WallMount,
  WindowOpening,
} from "../model/types";
import {
  clampScale,
  getCatalogEntry,
  effectiveDimensions,
  collisionExtent,
  type CatalogEntry,
} from "../catalog";
import {
  footprintsOverlap,
  collidableItemsCollide,
  wallFootprint,
  type CollisionItem,
  type OrientedFootprint,
} from "../geometry/furniture";
import { computeStair } from "../geometry/stair";
import { detectRoom, ROOM_FILL_MARGIN } from "../geometry/roomFill";
import {
  boundsOfPoints,
  siteBounds,
  unionBounds,
} from "../geometry/planview";
import {
  createCeilingLight,
  createDesign,
  createDoor,
  createFloor,
  createFurniture,
  createLevel,
  createRoof,
  createStaircase,
  createWall,
  createWallMount,
  createWindow,
  makeId,
  FLOOR_SLAB_THICKNESS,
} from "../model/defaults";
import { defaultLevelName, restackElevations } from "../model/levels";
import { snapToGrid } from "../geometry/snap";
import { rectangleSegments } from "../geometry/wall";
import { snapEndpoint } from "../geometry/wallSnap";
import {
  loadViewPrefs,
  saveViewPrefs,
  type CollisionMode,
  type CutawayStyle,
  type Layout,
  type ViewMode,
} from "../persistence/viewPrefs";
import { polygonContains, pointInPolygon } from "../geometry/polygon";

export type FillTarget = "floor" | "walls" | "both";

// Oriented (scaled, rotated) footprint of a placed item, for collision checks.
function orientedFootprint(
  item: FurnitureItem,
  entry: CatalogEntry,
): OrientedFootprint {
  const d = effectiveDimensions(entry, item.scale);
  return {
    center: item.position,
    rotation: item.rotation,
    footprint: { width: d.width, depth: d.depth },
  };
}

// A height-aware collision item for a placed furniture piece: footprint plus its
// vertical extent (base 0 on the floor) and tuck info (leg clearance / tuck
// height) so chairs can tuck under tables (Phase 4d Part C).
function furnitureCollisionItem(
  item: FurnitureItem,
  entry: CatalogEntry,
): CollisionItem {
  const ext = collisionExtent(entry, item.scale);
  return {
    id: item.id,
    collidable: entry.collidable,
    footprint: orientedFootprint(item, entry),
    vertical: { base: 0, height: ext.height },
    tuck: { legClearance: ext.legClearance, tuckHeight: ext.tuckHeight },
  };
}

// A staircase as a bulky, full-height collision item (no tuck-under).
function stairCollisionItem(stair: Staircase, level: Level): CollisionItem {
  return {
    id: stair.id,
    collidable: true,
    footprint: stairOrientedFootprint(stair, level),
    vertical: { base: 0, height: storeyHeightOf(level) },
  };
}

// Every collidable thing on a level as height-aware collision items: collidable
// furniture + all staircases (stairs are always bulky/collidable).
function levelCollidables(level: Level): CollisionItem[] {
  const out: CollisionItem[] = [];
  for (const item of level.furniture) {
    const entry = getCatalogEntry(item.catalogId);
    if (entry?.collidable) out.push(furnitureCollisionItem(item, entry));
  }
  for (const stair of level.staircases) {
    out.push(stairCollisionItem(stair, level));
  }
  return out;
}

// Stairwell opening footprints cut into a level's floor by the staircases on the
// level BELOW it — barriers so furniture can't be placed over the hole.
function belowStairFootprints(
  design: Design,
  levelId: string,
): OrientedFootprint[] {
  const idx = design.levels.findIndex((l) => l.id === levelId);
  const below = idx > 0 ? design.levels[idx - 1] : undefined;
  return below
    ? below.staircases.map((s) => stairOrientedFootprint(s, below))
    : [];
}

// Does a candidate collide with any OTHER collidable thing on the level (other
// furniture/staircases — height-aware, with tuck-under), a wall, or a stairwell
// opening (the hole from a staircase on the level below)? Walls and openings are
// hard barriers (footprint-only; no vertical/tuck exemption).
function collidesOnLevel(
  design: Design,
  levelId: string,
  candidate: CollisionItem,
): boolean {
  const level = levelOf(design, levelId);
  for (const other of levelCollidables(level)) {
    if (other.id === candidate.id) continue;
    if (collidableItemsCollide(candidate, other)) return true;
  }
  for (const wall of level.walls) {
    if (footprintsOverlap(candidate.footprint, wallFootprint(wall))) return true;
  }
  for (const opening of belowStairFootprints(design, levelId)) {
    if (footprintsOverlap(candidate.footprint, opening)) return true;
  }
  return false;
}

// Would this (collidable) furniture item overlap anything else? Used by Hard mode.
function itemCollides(
  design: Design,
  levelId: string,
  item: FurnitureItem,
): boolean {
  const entry = getCatalogEntry(item.catalogId);
  if (!entry?.collidable) return false;
  return collidesOnLevel(design, levelId, furnitureCollisionItem(item, entry));
}

export type Tool =
  | "select"
  | "wall"
  | "room"
  | "window"
  | "door"
  | "floor"
  | "paint"
  | "fill"
  | "furniture"
  | "stair"
  | "roof";
export type WallSide = "A" | "B";
export type Selection =
  | { kind: "wall"; id: string }
  | { kind: "window"; wallId: string; id: string }
  | { kind: "door"; wallId: string; id: string }
  | { kind: "wallMount"; wallId: string; id: string }
  | { kind: "floor"; id: string }
  | { kind: "furniture"; id: string }
  | { kind: "staircase"; id: string }
  | { kind: "ceilingLight"; id: string }
  | { kind: "roof"; id: string }
  | null;

// Copy/paste clipboard (not persisted, not in undo history). Holds a deep clone
// of a copied top-level object; paste creates a fresh-id duplicate offset a touch
// from the original on the active level. Wall children (windows/doors/mounts)
// come along with a copied wall; standalone openings aren't independently copied.
export type Clipboard =
  | { kind: "wall"; data: Wall }
  | { kind: "furniture"; data: FurnitureItem }
  | { kind: "roof"; data: Roof }
  | { kind: "staircase"; data: Staircase }
  | { kind: "ceilingLight"; data: CeilingLight }
  | null;

// Plan-space offset (meters) applied to a pasted copy so it doesn't land exactly
// on the original. Grid-aligned (0.1 m grid) so the copy stays snapped.
const PASTE_OFFSET: Vec2 = { x: 0.5, y: 0.5 };

const HISTORY_CAP = 100;

const clone = <T>(value: T): T => structuredClone(value);

const SEG_EPS = 1e-6;
const samePoint = (p: Vec2, q: Vec2) =>
  Math.abs(p.x - q.x) < SEG_EPS && Math.abs(p.y - q.y) < SEG_EPS;

// Two walls are the "same segment" if their endpoints match in either order.
function sameSegment(a: Pick<Wall, "start" | "end">, b: Pick<Wall, "start" | "end">): boolean {
  return (
    (samePoint(a.start, b.start) && samePoint(a.end, b.end)) ||
    (samePoint(a.start, b.end) && samePoint(a.end, b.start))
  );
}

// Deep copy a wall (with its openings) under fresh ids.
function cloneWallWithNewIds(wall: Wall): Wall {
  const copy = clone(wall);
  copy.id = makeId("wall");
  copy.windows = copy.windows.map((w) => ({ ...w, id: makeId("win") }));
  copy.doors = copy.doors.map((d) => ({ ...d, id: makeId("door") }));
  copy.mounts = copy.mounts.map((m) => ({ ...m, id: makeId("mount") }));
  return copy;
}

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

function findDoor(
  design: Design,
  levelId: string,
  wallId: string,
  doorId: string,
): DoorOpening | undefined {
  return findWall(design, levelId, wallId)?.doors.find((d) => d.id === doorId);
}

function findWallMount(
  design: Design,
  levelId: string,
  wallId: string,
  mountId: string,
): WallMount | undefined {
  return findWall(design, levelId, wallId)?.mounts.find((m) => m.id === mountId);
}

function findFloor(
  design: Design,
  levelId: string,
  floorId: string,
): FloorRegion | undefined {
  return levelOf(design, levelId).floors.find((f) => f.id === floorId);
}

function findFurniture(
  design: Design,
  levelId: string,
  itemId: string,
): FurnitureItem | undefined {
  return levelOf(design, levelId).furniture.find((f) => f.id === itemId);
}

function findStaircase(
  design: Design,
  levelId: string,
  stairId: string,
): Staircase | undefined {
  return levelOf(design, levelId).staircases.find((s) => s.id === stairId);
}

function findCeilingLight(
  design: Design,
  levelId: string,
  lightId: string,
): CeilingLight | undefined {
  return levelOf(design, levelId).ceilingLights.find((l) => l.id === lightId);
}

function findRoof(
  design: Design,
  levelId: string,
  roofId: string,
): Roof | undefined {
  return levelOf(design, levelId).roofs.find((r) => r.id === roofId);
}

// Storey height a staircase ascends (its level's wallHeight + slab).
function storeyHeightOf(level: Level): number {
  return level.wallHeight + FLOOR_SLAB_THICKNESS;
}

// Oriented (rotated) footprint of a staircase on its level, for collision.
function stairOrientedFootprint(
  stair: Staircase,
  level: Level,
): OrientedFootprint {
  const g = computeStair(stair, storeyHeightOf(level));
  return {
    center: stair.position,
    rotation: stair.rotation,
    footprint: { width: stair.width, depth: g.runLength },
  };
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
  if (sel.kind === "door")
    return !!findDoor(design, levelId, sel.wallId, sel.id);
  if (sel.kind === "wallMount")
    return !!findWallMount(design, levelId, sel.wallId, sel.id);
  if (sel.kind === "furniture") return !!findFurniture(design, levelId, sel.id);
  if (sel.kind === "staircase") return !!findStaircase(design, levelId, sel.id);
  if (sel.kind === "ceilingLight")
    return !!findCeilingLight(design, levelId, sel.id);
  if (sel.kind === "roof") return !!findRoof(design, levelId, sel.id);
  return !!findFloor(design, levelId, sel.id);
}

interface AppState {
  design: Design;
  currentLevelId: string;
  activeTool: Tool;
  selection: Selection;

  // Welcome flow (not persisted, not in history). `started` is false until the
  // user picks Continue or creates a new design; `hasSavedDesign` records whether
  // a saved design was found on load (set by main.tsx).
  started: boolean;
  hasSavedDesign: boolean;
  // The id of the open library record (Phase 5b). Autosave writes the open design
  // to this record. Null before a design is opened/created.
  openDesignId: string | null;

  // Transient hover hint: which wall side to spotlight in the plan (paint tool
  // hover and the properties-panel side chips). Not persisted, not in history.
  sideHighlight: { wallId: string; side: WallSide } | null;
  // The catalog item currently being placed by the Furniture tool (a ghost
  // follows the cursor). Transient UI state. `placingVariant` is the chosen
  // shape variant for variant-bearing items (null = the entry's default).
  placingCatalogId: string | null;
  placingVariant: string | null;
  // Fill Room tool: what to fill (floor / walls / both). Transient UI state.
  fillTarget: FillTarget;

  // 3D view preferences (persisted to localStorage, never in the Design).
  viewMode: ViewMode;
  cutawayStyle: CutawayStyle;
  layout: Layout;
  // Multi-level UI prefs (persisted, never in the Design).
  activeLevelOnly: boolean; // 3D: render only the active level
  showUnderlay: boolean; // 2D: ghost the level below the active one
  // 2D: show a length label on every wall segment (persisted UI pref).
  showDimensions: boolean;
  // Furniture collision prevention (persisted UI pref, never in the Design).
  collisionMode: CollisionMode;
  // Global hide-roofs toggle (persisted UI pref, never in the Design). Applies on
  // top of each roof's own `visible` flag.
  hideRoofs: boolean;
  // Furniture palette: the one accordion category group left open (null = all
  // collapsed). Persisted UI pref, never in the Design.
  openPaletteCategory: string | null;

  // The material the paint and floor tools apply (a UI preference, persisted).
  currentMaterial: MaterialRef;

  // Copy/paste clipboard (transient; not persisted, not in undo history).
  clipboard: Clipboard;

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
  setPlacingCatalogId: (
    catalogId: string | null,
    variant?: string | null,
  ) => void;
  setFillTarget: (target: FillTarget) => void;
  // Fill the enclosed room around `point` on the active level (floor + interior
  // wall paint) with the current material. One undo step. Returns false (no
  // change) if the click isn't inside a fully enclosed room.
  fillRoom: (point: Vec2, target: FillTarget) => boolean;
  setViewMode: (mode: ViewMode) => void;
  setCutawayStyle: (style: CutawayStyle) => void;
  setLayout: (layout: Layout) => void;
  setCurrentMaterial: (material: MaterialRef) => void;
  setActiveLevelOnly: (only: boolean) => void;
  setShowUnderlay: (show: boolean) => void;
  setShowDimensions: (show: boolean) => void;
  setCollisionMode: (mode: CollisionMode) => void;
  setHideRoofs: (hide: boolean) => void;
  setOpenPaletteCategory: (category: string | null) => void;

  // --- levels (active level is UI state; structural changes are undoable) ---
  setCurrentLevel: (id: string) => void;
  addLevelAbove: () => void;
  deleteLevel: (id: string) => void;
  renameLevel: (id: string, name: string) => void;

  // --- committed mutations (each = one undo step) ---
  addWall: (start: Vec2, end: Vec2) => void;
  addRoom: (a: Vec2, b: Vec2) => void;
  copyWallsToAbove: (wallIds?: string[]) => void;
  updateWall: (id: string, patch: Partial<Omit<Wall, "id">>) => void;
  deleteWall: (id: string) => void;
  paintWallSide: (id: string, side: WallSide, material: MaterialRef) => void;
  addWindow: (wallId: string, window: Omit<WindowOpening, "id">) => void;
  updateWindow: (
    wallId: string,
    id: string,
    patch: Partial<Omit<WindowOpening, "id">>,
  ) => void;
  setWindowMuntinMaterial: (
    wallId: string,
    id: string,
    material: MaterialRef,
  ) => void;
  deleteWindow: (wallId: string, id: string) => void;
  addDoor: (wallId: string, door: Omit<DoorOpening, "id">) => void;
  updateDoor: (
    wallId: string,
    id: string,
    patch: Partial<Omit<DoorOpening, "id">>,
  ) => void;
  setDoorMaterial: (wallId: string, id: string, material: MaterialRef) => void;
  deleteDoor: (wallId: string, id: string) => void;
  addWallMount: (wallId: string, mount: Omit<WallMount, "id">) => void;
  updateWallMount: (
    wallId: string,
    id: string,
    patch: Partial<Omit<WallMount, "id" | "catalogId">>,
  ) => void;
  setWallMountMaterial: (
    wallId: string,
    id: string,
    slot: string,
    material: MaterialRef,
  ) => void;
  setWallMountScale: (wallId: string, id: string, scale: Vec3) => void;
  deleteWallMount: (wallId: string, id: string) => void;
  addFloor: (polygon: Vec2[], material: MaterialRef) => void;
  updateFloor: (id: string, patch: Partial<Omit<FloorRegion, "id">>) => void;
  setFloorMaterial: (id: string, material: MaterialRef) => void;
  deleteFloor: (id: string) => void;
  placeFurniture: (
    catalogId: string,
    position: Vec2,
    rotation: number,
    variant?: string | null,
  ) => void;
  updateFurniture: (
    id: string,
    patch: Partial<Omit<FurnitureItem, "id" | "catalogId">>,
  ) => void;
  rotateFurniture: (id: string, deltaDeg: number) => void;
  setFurnitureMaterial: (
    id: string,
    slot: string,
    material: MaterialRef,
  ) => void;
  resetFurnitureMaterials: (id: string) => void;
  setFurnitureScale: (id: string, scale: Vec3) => void;
  resetFurnitureScale: (id: string) => void;
  deleteFurniture: (id: string) => void;
  // Staircases (on the active/lower level; auto-create the level above if absent).
  placeStaircase: (position: Vec2, rotation: number) => void;
  updateStaircase: (id: string, patch: Partial<Omit<Staircase, "id">>) => void;
  rotateStaircase: (id: string, deltaDeg: number) => void;
  deleteStaircase: (id: string) => void;
  // Ceiling lights (Phase 5f). Hang from the active level's ceiling.
  addCeilingLight: (
    catalogId: string,
    position: Vec2,
    drop?: number,
  ) => void;
  updateCeilingLight: (
    id: string,
    patch: Partial<Omit<CeilingLight, "id" | "catalogId">>,
  ) => void;
  setCeilingLightMaterial: (
    id: string,
    slot: string,
    material: MaterialRef,
  ) => void;
  setCeilingLightScale: (id: string, scale: Vec3) => void;
  deleteCeilingLight: (id: string) => void;
  setSite: (site: Site) => void;
  // Roofs (Phase 5.2): manually placed rectangles on the active level. `addRoof`
  // creates one from a dragged rectangle; `updateRoof` patches editable fields
  // (coalesced for slider drags); `rotateRoof` snaps to 15°; `deleteRoof` removes
  // one. All on the active level and undoable.
  addRoof: (position: Vec2, width: number, depth: number) => void;
  updateRoof: (id: string, patch: Partial<Omit<Roof, "id">>) => void;
  rotateRoof: (id: string, deltaDeg: number) => void;
  // Reassign a roof to a different level; switches the active level to the
  // target so the moved roof stays visible/selected.
  moveRoofToLevel: (id: string, targetLevelId: string) => void;
  deleteRoof: (id: string) => void;
  // Copy/paste of the current selection (top-level objects: wall, furniture,
  // roof, staircase, ceiling light). `copySelection` returns true if something
  // was copied; `pasteClipboard` drops a fresh-id duplicate (offset) on the
  // active level, selects it, and returns true if anything was pasted (one undo).
  copySelection: () => boolean;
  pasteClipboard: () => boolean;
  setDesign: (design: Design) => void;
  newDesign: () => void;
  // Welcome actions.
  continueDesign: () => void;
  startNewDesign: (site: Site) => void;
  // Library (Phase 5b): open an existing record, rename the open design, or fork
  // the open design into a new record (Save As).
  openRecord: (id: string, design: Design) => void;
  renameDesign: (name: string) => void;
  saveAs: (name: string) => void;

  // --- drag session (transient until endDrag) ---
  beginDrag: () => void;
  moveWallEndpoint: (id: string, which: "start" | "end", point: Vec2) => void;
  translateWall: (id: string, start: Vec2, end: Vec2) => void;
  moveWindow: (wallId: string, id: string, t: number) => void;
  moveDoor: (wallId: string, id: string, t: number) => void;
  moveFurniture: (id: string, position: Vec2, rotation?: number) => void;
  moveStaircase: (id: string, position: Vec2, rotation?: number) => void;
  moveCeilingLight: (id: string, position: Vec2) => void;
  moveRoof: (id: string, position: Vec2) => void;
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
    const {
      viewMode,
      cutawayStyle,
      layout,
      currentMaterial,
      activeLevelOnly,
      showUnderlay,
      showDimensions,
      collisionMode,
      hideRoofs,
      openPaletteCategory,
      currentLevelId,
    } = get();
    saveViewPrefs({
      viewMode,
      cutawayStyle,
      layout,
      currentMaterial,
      activeLevelOnly,
      showUnderlay,
      showDimensions,
      collisionMode,
      hideRoofs,
      openPaletteCategory,
      activeLevelId: currentLevelId,
    });
  };

  return {
    design: initialDesign,
    currentLevelId: initialDesign.levels[0]!.id,
    activeTool: "wall",
    selection: null,
    started: false,
    hasSavedDesign: false,
    openDesignId: null,
    sideHighlight: null,
    placingCatalogId: null,
    placingVariant: null,
    fillTarget: "both",
    viewMode: prefs.viewMode,
    cutawayStyle: prefs.cutawayStyle,
    layout: prefs.layout,
    currentMaterial: prefs.currentMaterial,
    activeLevelOnly: prefs.activeLevelOnly,
    showUnderlay: prefs.showUnderlay,
    showDimensions: prefs.showDimensions,
    collisionMode: prefs.collisionMode,
    hideRoofs: prefs.hideRoofs,
    openPaletteCategory: prefs.openPaletteCategory,
    clipboard: null,
    past: [],
    future: [],
    dragBaseline: null,
    coalesceKey: null,
    coalesceAt: 0,

    setActiveTool: (tool) => set({ activeTool: tool }),
    setSelection: (selection) => set({ selection }),
    setSideHighlight: (sideHighlight) => set({ sideHighlight }),
    setPlacingCatalogId: (placingCatalogId, placingVariant = null) =>
      set({ placingCatalogId, placingVariant }),
    setFillTarget: (fillTarget) => set({ fillTarget }),

    fillRoom: (point, target) => {
      const { design, currentLevelId, currentMaterial } = get();
      const level = levelOf(design, currentLevelId);
      // Grid extent: the site unioned with all walls, plus a leak margin.
      const wb = boundsOfPoints(level.walls.flatMap((w) => [w.start, w.end]));
      const base = unionBounds(siteBounds(design.site), wb)!;
      const bounds = {
        minX: base.minX - ROOM_FILL_MARGIN,
        minY: base.minY - ROOM_FILL_MARGIN,
        maxX: base.maxX + ROOM_FILL_MARGIN,
        maxY: base.maxY + ROOM_FILL_MARGIN,
      };
      const room = detectRoom(point, level.walls, bounds);
      if (!room.enclosed) return false;

      pushHistory();
      set((s) => {
        const next = clone(s.design);
        const lvl = levelOf(next, s.currentLevelId);
        if (target === "floor" || target === "both") {
          // Replace any existing floor covering this room (the clicked point).
          lvl.floors = lvl.floors.filter((f) => !pointInPolygon(point, f.polygon));
          lvl.floors.push(createFloor(room.polygon, currentMaterial));
        }
        if (target === "walls" || target === "both") {
          for (const { wallId, side } of room.wallSides) {
            const wall = lvl.walls.find((w) => w.id === wallId);
            if (!wall) continue;
            if (side === "A") wall.paintA = clone(currentMaterial);
            else wall.paintB = clone(currentMaterial);
          }
        }
        return { design: next };
      });
      return true;
    },
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
    setActiveLevelOnly: (activeLevelOnly) => {
      set({ activeLevelOnly });
      persistViewPrefs();
    },
    setShowUnderlay: (showUnderlay) => {
      set({ showUnderlay });
      persistViewPrefs();
    },
    setShowDimensions: (showDimensions) => {
      set({ showDimensions });
      persistViewPrefs();
    },
    setCollisionMode: (collisionMode) => {
      set({ collisionMode });
      persistViewPrefs();
    },
    setHideRoofs: (hideRoofs) => {
      set({ hideRoofs });
      persistViewPrefs();
    },
    setOpenPaletteCategory: (openPaletteCategory) => {
      set({ openPaletteCategory });
      persistViewPrefs();
    },

    setCurrentLevel: (id) => {
      if (!get().design.levels.some((l) => l.id === id)) return;
      set({ currentLevelId: id });
      persistViewPrefs();
    },

    addLevelAbove: () => {
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = createLevel(defaultLevelName(design.levels.length));
        design.levels.push(level);
        restackElevations(design.levels);
        return { design, currentLevelId: level.id, selection: null };
      });
      persistViewPrefs();
    },

    deleteLevel: (id) => {
      const { design } = get();
      if (design.levels.length <= 1) return; // keep at least one level
      pushHistory();
      set((s) => {
        const next = clone(s.design);
        next.levels = next.levels.filter((l) => l.id !== id);
        restackElevations(next.levels);
        const currentLevelId = next.levels.some((l) => l.id === s.currentLevelId)
          ? s.currentLevelId
          : next.levels[0]!.id;
        const selection = sanitizeSelection(next, currentLevelId, s.selection);
        return { design: next, currentLevelId, selection };
      });
      persistViewPrefs();
    },

    renameLevel: (id, name) => {
      const level = get().design.levels.find((l) => l.id === id);
      if (!level) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const target = design.levels.find((l) => l.id === id);
        if (target) target.name = name;
        return { design };
      });
    },

    addWall: (start, end) => {
      pushHistory();
      const wall = createWall(start, end);
      set((s) => {
        const design = clone(s.design);
        levelOf(design, s.currentLevelId).walls.push(wall);
        return {
          design,
          selection: { kind: "wall", id: wall.id },
        };
      });
    },

    // Four joined walls from two opposite (grid-snapped) corners. Corners snap to
    // existing walls (A3), shared rectangle corners stay coincident; one undo step.
    addRoom: (a, b) => {
      const segs = rectangleSegments(snapToGrid(a), snapToGrid(b));
      if (segs.length === 0) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        const existing = [...level.walls];
        // Snap each of the 4 unique corners to existing walls, then rebuild.
        const corners = segs.map((seg) => snapEndpoint(seg.start, existing).point);
        const built = corners.map((c, i) =>
          createWall({ ...c }, { ...corners[(i + 1) % 4]! }),
        );
        level.walls.push(...built);
        return { design };
      });
    },

    // Duplicate the active level's walls (or just `wallIds`) onto the level
    // above, creating that level if needed. Openings copy with fresh ids, exact
    // duplicates are skipped, copied endpoints snap to the target's existing
    // walls, and the active level switches to the target so the result is visible.
    copyWallsToAbove: (wallIds) => {
      const { design, currentLevelId } = get();
      const idx = design.levels.findIndex((l) => l.id === currentLevelId);
      const active = design.levels[idx];
      if (!active) return;
      const source = wallIds
        ? active.walls.filter((w) => wallIds.includes(w.id))
        : active.walls;
      if (source.length === 0) return;
      pushHistory();
      set((s) => {
        const next = clone(s.design);
        const ai = next.levels.findIndex((l) => l.id === s.currentLevelId);
        let target = next.levels[ai + 1];
        if (!target) {
          target = createLevel(defaultLevelName(next.levels.length));
          next.levels.push(target);
          restackElevations(next.levels);
        }
        const src = wallIds
          ? next.levels[ai]!.walls.filter((w) => wallIds.includes(w.id))
          : next.levels[ai]!.walls;
        const preExisting = [...target.walls];
        for (const w of src) {
          if (preExisting.some((t) => sameSegment(t, w))) continue; // skip dupes
          const copy = cloneWallWithNewIds(w);
          copy.start = snapEndpoint(copy.start, preExisting).point;
          copy.end = snapEndpoint(copy.end, preExisting).point;
          target.walls.push(copy);
        }
        // Roofs are manual now — copying walls up never adds or moves any roof.
        return {
          design: next,
          currentLevelId: target.id,
          selection: null,
        };
      });
      persistViewPrefs();
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
        return {
          design,
          selection: stillThere ? s.selection : null,
        };
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

    setWindowMuntinMaterial: (wallId, id, material) => {
      if (!findWindow(get().design, get().currentLevelId, wallId, id)) return;
      commitCoalesced(`win-muntin:${wallId}:${id}`, (design) => {
        const win = findWindow(design, get().currentLevelId, wallId, id);
        if (win) win.muntinMaterial = clone(material);
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

    addDoor: (wallId, door) => {
      const wall = findWall(get().design, get().currentLevelId, wallId);
      if (!wall) return;
      pushHistory();
      const made = createDoor(door);
      set((s) => {
        const design = clone(s.design);
        findWall(design, s.currentLevelId, wallId)?.doors.push(made);
        return { design, selection: { kind: "door", wallId, id: made.id } };
      });
    },

    updateDoor: (wallId, id, patch) => {
      if (!findDoor(get().design, get().currentLevelId, wallId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const door = findDoor(design, s.currentLevelId, wallId, id);
        if (door) Object.assign(door, patch);
        return { design };
      });
    },

    setDoorMaterial: (wallId, id, material) => {
      if (!findDoor(get().design, get().currentLevelId, wallId, id)) return;
      commitCoalesced(`door-mat:${wallId}:${id}`, (design) => {
        const door = findDoor(design, get().currentLevelId, wallId, id);
        if (door) door.material = clone(material);
      });
    },

    deleteDoor: (wallId, id) => {
      const wall = findWall(get().design, get().currentLevelId, wallId);
      if (!wall) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const w = findWall(design, s.currentLevelId, wallId);
        if (w) w.doors = w.doors.filter((d) => d.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    addWallMount: (wallId, mount) => {
      const wall = findWall(get().design, get().currentLevelId, wallId);
      if (!wall) return;
      pushHistory();
      const made = createWallMount(mount.catalogId, mount);
      set((s) => {
        const design = clone(s.design);
        findWall(design, s.currentLevelId, wallId)?.mounts.push(made);
        return {
          design,
          selection: { kind: "wallMount", wallId, id: made.id },
        };
      });
    },

    updateWallMount: (wallId, id, patch) => {
      if (!findWallMount(get().design, get().currentLevelId, wallId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const mount = findWallMount(design, s.currentLevelId, wallId, id);
        if (mount) Object.assign(mount, patch);
        return { design };
      });
    },

    setWallMountMaterial: (wallId, id, slot, material) => {
      if (!findWallMount(get().design, get().currentLevelId, wallId, id)) return;
      commitCoalesced(`mount-mat:${wallId}:${id}:${slot}`, (design) => {
        const mount = findWallMount(design, get().currentLevelId, wallId, id);
        if (mount)
          mount.materials = { ...mount.materials, [slot]: clone(material) };
      });
    },

    setWallMountScale: (wallId, id, scale) => {
      const existing = findWallMount(
        get().design,
        get().currentLevelId,
        wallId,
        id,
      );
      if (!existing) return;
      const entry = getCatalogEntry(existing.catalogId);
      const clamped = entry ? clampScale(entry.scaling, scale) : scale;
      commitCoalesced(`mount-scale:${wallId}:${id}`, (design) => {
        const mount = findWallMount(design, get().currentLevelId, wallId, id);
        if (mount) mount.scale = clamped;
      });
    },

    deleteWallMount: (wallId, id) => {
      const wall = findWall(get().design, get().currentLevelId, wallId);
      if (!wall) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const w = findWall(design, s.currentLevelId, wallId);
        if (w) w.mounts = w.mounts.filter((m) => m.id !== id);
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
        const level = levelOf(design, s.currentLevelId);
        // Remove only floors the new one FULLY covers (e.g. redrawing the same
        // region to recolor). Partially-overlapped floors are kept and layered
        // (the new floor renders on top of the covered area only). z-fighting is
        // handled by per-floor depth bias in Floors3D.
        level.floors = level.floors.filter(
          (f) => !polygonContains(polygon, f.polygon),
        );
        level.floors.push(floor);
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

    placeFurniture: (catalogId, position, rotation, variant) => {
      const item = createFurniture(catalogId, position, {
        rotation,
        ...(variant ? { variant } : {}),
      });
      // Hard mode: refuse to place a collidable item onto another (no-op so the
      // caller's warning ghost stays and the click simply doesn't place).
      if (get().collisionMode === "hard") {
        if (itemCollides(get().design, get().currentLevelId, item)) return;
      }
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        levelOf(design, s.currentLevelId).furniture.push(item);
        return { design, selection: { kind: "furniture", id: item.id } };
      });
    },

    updateFurniture: (id, patch) => {
      if (!findFurniture(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const item = findFurniture(design, s.currentLevelId, id);
        if (item) Object.assign(item, patch);
        return { design };
      });
    },

    rotateFurniture: (id, deltaDeg) => {
      const item = findFurniture(get().design, get().currentLevelId, id);
      if (!item) return;
      // Normalize to [0, 360) snapped to 15°.
      let deg = (item.rotation + deltaDeg) % 360;
      if (deg < 0) deg += 360;
      deg = (Math.round(deg / 15) * 15) % 360;
      // Hard mode: revert (keep current rotation) if rotating into an overlap.
      if (get().collisionMode === "hard") {
        if (
          itemCollides(get().design, get().currentLevelId, {
            ...item,
            rotation: deg,
          })
        )
          return;
      }
      get().updateFurniture(id, { rotation: deg });
    },

    setFurnitureMaterial: (id, slot, material) => {
      if (!findFurniture(get().design, get().currentLevelId, id)) return;
      commitCoalesced(`furn-mat:${id}:${slot}`, (design) => {
        const item = findFurniture(design, get().currentLevelId, id);
        if (item)
          item.materials = { ...item.materials, [slot]: clone(material) };
      });
    },

    resetFurnitureMaterials: (id) => {
      if (!findFurniture(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const item = findFurniture(design, s.currentLevelId, id);
        if (item) item.materials = {};
        return { design };
      });
    },

    setFurnitureScale: (id, scale) => {
      const existing = findFurniture(get().design, get().currentLevelId, id);
      if (!existing) return;
      const entry = getCatalogEntry(existing.catalogId);
      const clamped = entry ? clampScale(entry.scaling, scale) : scale;
      // Hard mode: revert (keep current scale) if scaling into an overlap.
      if (get().collisionMode === "hard") {
        if (
          itemCollides(get().design, get().currentLevelId, {
            ...existing,
            scale: clamped,
          })
        )
          return;
      }
      // Coalesce slider drags into one undo step (like paint/material edits).
      commitCoalesced(`furn-scale:${id}`, (design) => {
        const item = findFurniture(design, get().currentLevelId, id);
        if (item) item.scale = clamped;
      });
    },

    resetFurnitureScale: (id) => {
      const existing = findFurniture(get().design, get().currentLevelId, id);
      if (!existing) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const item = findFurniture(design, s.currentLevelId, id);
        if (item) item.scale = { x: 1, y: 1, z: 1 };
        return { design };
      });
    },

    deleteFurniture: (id) => {
      if (!findFurniture(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        level.furniture = level.furniture.filter((f) => f.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    // Place a staircase on the active (lower) level. A staircase needs a level to
    // ascend to, so if none exists above, one is auto-created (3c naming). The
    // active level stays the lower one (you keep editing where you placed it).
    placeStaircase: (position, rotation) => {
      const stair = createStaircase(snapToGrid(position), { rotation });
      const level = levelOf(get().design, get().currentLevelId);
      // Hard mode: refuse to place onto another collidable thing (no-op).
      if (get().collisionMode === "hard") {
        if (
          collidesOnLevel(
            get().design,
            get().currentLevelId,
            stairCollisionItem(stair, level),
          )
        )
          return;
      }
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const idx = design.levels.findIndex((l) => l.id === s.currentLevelId);
        if (!design.levels[idx + 1]) {
          const above = createLevel(defaultLevelName(design.levels.length));
          design.levels.push(above);
          restackElevations(design.levels);
        }
        design.levels[idx]!.staircases.push(stair);
        return { design, selection: { kind: "staircase", id: stair.id } };
      });
    },

    updateStaircase: (id, patch) => {
      if (!findStaircase(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const stair = findStaircase(design, s.currentLevelId, id);
        if (stair) Object.assign(stair, patch);
        return { design };
      });
    },

    rotateStaircase: (id, deltaDeg) => {
      const stair = findStaircase(get().design, get().currentLevelId, id);
      if (!stair) return;
      let deg = (stair.rotation + deltaDeg) % 360;
      if (deg < 0) deg += 360;
      deg = (Math.round(deg / 15) * 15) % 360;
      if (get().collisionMode === "hard") {
        const level = levelOf(get().design, get().currentLevelId);
        const hypo = { ...stair, rotation: deg };
        if (
          collidesOnLevel(
            get().design,
            get().currentLevelId,
            stairCollisionItem(hypo, level),
          )
        )
          return;
      }
      get().updateStaircase(id, { rotation: deg });
    },

    deleteStaircase: (id) => {
      if (!findStaircase(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        level.staircases = level.staircases.filter((x) => x.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    addCeilingLight: (catalogId, position, drop) => {
      const entry = getCatalogEntry(catalogId);
      if (!entry || entry.mount !== "ceiling") return;
      const light = createCeilingLight(catalogId, snapToGrid(position), {
        drop: drop ?? entry.defaultDrop,
      });
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        levelOf(design, s.currentLevelId).ceilingLights.push(light);
        return {
          design,
          selection: { kind: "ceilingLight", id: light.id },
        };
      });
    },

    updateCeilingLight: (id, patch) => {
      if (!findCeilingLight(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const light = findCeilingLight(design, s.currentLevelId, id);
        if (light) Object.assign(light, patch);
        return { design };
      });
    },

    setCeilingLightMaterial: (id, slot, material) => {
      if (!findCeilingLight(get().design, get().currentLevelId, id)) return;
      commitCoalesced(`light-mat:${id}:${slot}`, (design) => {
        const light = findCeilingLight(design, get().currentLevelId, id);
        if (light)
          light.materials = { ...light.materials, [slot]: clone(material) };
      });
    },

    setCeilingLightScale: (id, scale) => {
      const existing = findCeilingLight(get().design, get().currentLevelId, id);
      if (!existing) return;
      const entry = getCatalogEntry(existing.catalogId);
      const clamped = entry ? clampScale(entry.scaling, scale) : scale;
      commitCoalesced(`light-scale:${id}`, (design) => {
        const light = findCeilingLight(design, get().currentLevelId, id);
        if (light) light.scale = clamped;
      });
    },

    deleteCeilingLight: (id) => {
      if (!findCeilingLight(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        level.ceilingLights = level.ceilingLights.filter((l) => l.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    setSite: (site) => {
      // Soft boundary: resizing only changes the numbers — nothing is clamped,
      // moved, or deleted. Undoable.
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        design.site = { width: site.width, depth: site.depth };
        return { design };
      });
    },

    // Place a manual roof rectangle (centered on `position`) on the active level.
    addRoof: (position, width, depth) => {
      const roof = createRoof(snapToGrid(position), width, depth);
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        levelOf(design, s.currentLevelId).roofs.push(roof);
        return { design, selection: { kind: "roof", id: roof.id } };
      });
    },

    updateRoof: (id, patch) => {
      if (!findRoof(get().design, get().currentLevelId, id)) return;
      // Coalesce slider drags (pitch/overhang) into one undo step, like scaling.
      const key = Object.keys(patch).sort().join(",");
      commitCoalesced(`roof:${id}:${key}`, (design) => {
        const roof = findRoof(design, get().currentLevelId, id);
        if (roof) Object.assign(roof, patch);
      });
    },

    rotateRoof: (id, deltaDeg) => {
      const roof = findRoof(get().design, get().currentLevelId, id);
      if (!roof) return;
      let deg = (roof.rotation + deltaDeg) % 360;
      if (deg < 0) deg += 360;
      deg = (Math.round(deg / 15) * 15) % 360;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const r = findRoof(design, s.currentLevelId, id);
        if (r) r.rotation = deg;
        return { design };
      });
    },

    // Move a roof from the active level to another level (keeps it selected and
    // switches the active level to the target so it stays in view). One undo step.
    moveRoofToLevel: (id, targetLevelId) => {
      const cur = get().currentLevelId;
      if (targetLevelId === cur) return;
      if (!findRoof(get().design, cur, id)) return;
      if (!get().design.levels.some((l) => l.id === targetLevelId)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const from = levelOf(design, s.currentLevelId);
        const moved = from.roofs.find((r) => r.id === id);
        const target = design.levels.find((l) => l.id === targetLevelId);
        if (!moved || !target) return {};
        from.roofs = from.roofs.filter((r) => r.id !== id);
        target.roofs.push(moved);
        return {
          design,
          currentLevelId: targetLevelId,
          selection: { kind: "roof", id },
        };
      });
      persistViewPrefs();
    },

    deleteRoof: (id) => {
      if (!findRoof(get().design, get().currentLevelId, id)) return;
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        level.roofs = level.roofs.filter((r) => r.id !== id);
        const stillThere = selectionExists(
          design,
          s.currentLevelId,
          s.selection,
        );
        return { design, selection: stillThere ? s.selection : null };
      });
    },

    // Copy the current selection into the clipboard (deep clone). Only top-level
    // objects are copyable; openings/mounts ride along with their wall.
    copySelection: () => {
      const { design, currentLevelId, selection } = get();
      if (!selection) return false;
      let clip: Clipboard = null;
      if (selection.kind === "wall") {
        const w = findWall(design, currentLevelId, selection.id);
        if (w) clip = { kind: "wall", data: clone(w) };
      } else if (selection.kind === "furniture") {
        const f = findFurniture(design, currentLevelId, selection.id);
        if (f) clip = { kind: "furniture", data: clone(f) };
      } else if (selection.kind === "roof") {
        const r = findRoof(design, currentLevelId, selection.id);
        if (r) clip = { kind: "roof", data: clone(r) };
      } else if (selection.kind === "staircase") {
        const st = findStaircase(design, currentLevelId, selection.id);
        if (st) clip = { kind: "staircase", data: clone(st) };
      } else if (selection.kind === "ceilingLight") {
        const l = findCeilingLight(design, currentLevelId, selection.id);
        if (l) clip = { kind: "ceilingLight", data: clone(l) };
      }
      if (!clip) return false;
      set({ clipboard: clip });
      return true;
    },

    // Paste a fresh-id duplicate of the clipboard onto the active level, offset a
    // touch from the original so it's visibly separate, and select it.
    pasteClipboard: () => {
      const clip = get().clipboard;
      if (!clip) return false;
      const off = (p: Vec2): Vec2 => ({
        x: p.x + PASTE_OFFSET.x,
        y: p.y + PASTE_OFFSET.y,
      });
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        const level = levelOf(design, s.currentLevelId);
        let selection: Selection = null;
        if (clip.kind === "wall") {
          const w = cloneWallWithNewIds(clip.data);
          w.start = off(w.start);
          w.end = off(w.end);
          level.walls.push(w);
          selection = { kind: "wall", id: w.id };
        } else if (clip.kind === "furniture") {
          const f = clone(clip.data);
          f.id = makeId("furn");
          f.position = off(f.position);
          level.furniture.push(f);
          selection = { kind: "furniture", id: f.id };
        } else if (clip.kind === "roof") {
          const r = clone(clip.data);
          r.id = makeId("roof");
          r.position = off(r.position);
          level.roofs.push(r);
          selection = { kind: "roof", id: r.id };
        } else if (clip.kind === "staircase") {
          // A staircase needs a level above to ascend to (auto-create like place).
          const idx = design.levels.findIndex((l) => l.id === s.currentLevelId);
          if (!design.levels[idx + 1]) {
            design.levels.push(createLevel(defaultLevelName(design.levels.length)));
            restackElevations(design.levels);
          }
          const st = clone(clip.data);
          st.id = makeId("stair");
          st.position = off(st.position);
          level.staircases.push(st);
          selection = { kind: "staircase", id: st.id };
        } else if (clip.kind === "ceilingLight") {
          const l = clone(clip.data);
          l.id = makeId("light");
          l.position = off(l.position);
          level.ceilingLights.push(l);
          selection = { kind: "ceilingLight", id: l.id };
        }
        return { design, selection };
      });
      return true;
    },

    setDesign: (design) => {
      const next = clone(design);
      set({
        design: next,
        currentLevelId: next.levels[0]!.id,
        selection: null,
        past: [],
        future: [],
        openDesignId: makeId("design"),
      });
    },

    newDesign: () => {
      const design = createDesign();
      set({
        design,
        currentLevelId: design.levels[0]!.id,
        selection: null,
        past: [],
        future: [],
        openDesignId: makeId("design"),
      });
    },

    continueDesign: () => set({ started: true }),

    startNewDesign: (site) => {
      // Fresh design with the chosen site, a clean history, and a new record id.
      const design = createDesign(undefined, site);
      set({
        design,
        currentLevelId: design.levels[0]!.id,
        selection: null,
        past: [],
        future: [],
        started: true,
        openDesignId: makeId("design"),
      });
    },

    // Open an existing library record into the editor.
    openRecord: (id, design) => {
      const next = clone(design);
      set({
        design: next,
        currentLevelId: next.levels[0]!.id,
        selection: null,
        past: [],
        future: [],
        started: true,
        openDesignId: id,
      });
    },

    // Rename the open design (undoable, persisted by autosave).
    renameDesign: (name) => {
      pushHistory();
      set((s) => {
        const design = clone(s.design);
        design.name = name;
        return { design };
      });
    },

    // Save As: fork the open design into a new record under a new name.
    saveAs: (name) => {
      set((s) => {
        const design = clone(s.design);
        design.name = name;
        return { design, openDesignId: makeId("design") };
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

    moveDoor: (wallId, id, t) =>
      set((s) => {
        const design = clone(s.design);
        const door = findDoor(design, s.currentLevelId, wallId, id);
        if (!door) return {};
        door.t = t;
        return { design };
      }),

    moveFurniture: (id, position, rotation) =>
      set((s) => {
        const design = clone(s.design);
        const item = findFurniture(design, s.currentLevelId, id);
        if (!item) return {};
        item.position = position;
        if (rotation !== undefined) item.rotation = rotation;
        return { design };
      }),

    moveStaircase: (id, position, rotation) =>
      set((s) => {
        const design = clone(s.design);
        const stair = findStaircase(design, s.currentLevelId, id);
        if (!stair) return {};
        stair.position = position;
        if (rotation !== undefined) stair.rotation = rotation;
        return { design };
      }),

    moveCeilingLight: (id, position) =>
      set((s) => {
        const design = clone(s.design);
        const light = findCeilingLight(design, s.currentLevelId, id);
        if (!light) return {};
        light.position = position;
        return { design };
      }),

    moveRoof: (id, position) =>
      set((s) => {
        const design = clone(s.design);
        const roof = findRoof(design, s.currentLevelId, id);
        if (!roof) return {};
        roof.position = position;
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
        return {
          past: next,
          future: [],
          dragBaseline: null,
        };
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
