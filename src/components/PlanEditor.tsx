import { useEffect, useMemo, useRef, useState } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import type { WallSide } from "../store/store";
import type { Level, MaterialRef, Site, Vec2, Wall } from "../model/types";
import {
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_DOOR_MATERIAL,
  DEFAULT_DOOR_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
} from "../model/defaults";
import { add, sub, dot, scale as vscale, distance } from "../geometry/vec";
import { snapToGrid, constrainAngle } from "../geometry/snap";
import {
  wallNormal,
  wallDirection,
  wallLength,
  hitTestWall,
} from "../geometry/wall";
import { snapEndpoint, WALL_SNAP_TOLERANCE } from "../geometry/wallSnap";
import {
  windowSpan,
  projectPointToWallT,
  validateWindow,
  clampWindowT,
  wallPlanSegments,
} from "../geometry/windows";
import { validateDoor, doorSymbol } from "../geometry/doors";
import { isValidFloorPolygon, pointInPolygon } from "../geometry/polygon";
import {
  pointInFootprint,
  wallHuggerSnap,
  footprintCorners,
  footprintsOverlap,
  collidingIds,
  type Footprint,
  type CollisionItem,
} from "../geometry/furniture";
import {
  boundsOfPoints,
  unionBounds,
  siteBounds,
  fitView,
  type Bounds,
} from "../geometry/planview";
import { ResizeAreaDialog } from "./ResizeAreaDialog";
import {
  getCatalogEntry,
  primarySlot,
  effectiveDimensions,
  UNIT_SCALE,
  type CatalogEntry,
} from "../catalog";
import type { Vec3 } from "../model/types";
import { FurnitureSymbolShape } from "./FurnitureSymbol";
import { materialKey, materialDomId } from "../materials/key";
import { patternDataUrl } from "../materials/textures";
import { PATTERN_TILE_METERS } from "../materials/patterns";
import { useElementSize } from "../lib/useElementSize";
import { formatMeters } from "../lib/format";

interface View {
  pan: Vec2;
  scale: number;
}

const MIN_SCALE = 4;
const MAX_SCALE = 600;
const HANDLE_RADIUS_PX = 6;
const HANDLE_HIT_PX = 10;
const WALL_HIT_TOL_PX = 5;
const DRAG_THRESHOLD_PX = 4;
const CLOSE_FLOOR_PX = 12;

type DragState =
  | { kind: "none" }
  | { kind: "pan"; pointerId: number; startScreen: Vec2; startPan: Vec2 }
  | {
      kind: "body";
      pointerId: number;
      wallId: string;
      startScreen: Vec2;
      startWorld: Vec2;
      baseStart: Vec2;
      baseEnd: Vec2;
      started: boolean;
    }
  | {
      kind: "endpoint";
      pointerId: number;
      wallId: string;
      which: "start" | "end";
      startScreen: Vec2;
      started: boolean;
    }
  | {
      kind: "window";
      pointerId: number;
      wallId: string;
      windowId: string;
      startScreen: Vec2;
      started: boolean;
    }
  | {
      kind: "door";
      pointerId: number;
      wallId: string;
      doorId: string;
      startScreen: Vec2;
      started: boolean;
    }
  | {
      kind: "furniture";
      pointerId: number;
      itemId: string;
      startScreen: Vec2;
      startWorld: Vec2;
      basePos: Vec2;
      started: boolean;
    }
  | { kind: "room"; pointerId: number; startScreen: Vec2 };

const GRID_TIERS: { spacing: number; className: string }[] = [
  { spacing: 0.1, className: "grid-minor" },
  { spacing: 1, className: "grid-major" },
  { spacing: 10, className: "grid-coarse" },
];

// Corners of the wall (or a sub-span of it) as a thick rectangle in plan space.
function spanCorners(wall: Wall, a: number, b: number): Vec2[] {
  const dir = wallDirection(wall);
  const n = wallNormal(wall);
  const o = vscale(n, wall.thickness / 2);
  const A = add(wall.start, vscale(dir, a));
  const B = add(wall.start, vscale(dir, b));
  return [add(A, o), add(B, o), sub(B, o), sub(A, o)];
}

// Half of the wall rectangle on the given side (for the paint hover highlight).
function sideHalfCorners(wall: Wall, side: WallSide): Vec2[] {
  const n = wallNormal(wall); // points to side A
  const o = vscale(n, side === "A" ? wall.thickness / 2 : -wall.thickness / 2);
  return [wall.start, wall.end, add(wall.end, o), add(wall.start, o)];
}

const toPoints = (pts: Vec2[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

// Which side of the wall centerline a point is on (A = left of start->end).
function sideOf(wall: Wall, p: Vec2): WallSide {
  return dot(sub(p, wall.start), wallNormal(wall)) >= 0 ? "A" : "B";
}

function fillFor(material: MaterialRef): string {
  return material.kind === "solid"
    ? material.color
    : `url(#${materialDomId(material)})`;
}

export function PlanEditor() {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);

  const level = useStore(selectCurrentLevel);
  const site = useStore((s) => s.design.site);
  const levels = useStore((s) => s.design.levels);
  const currentLevelId = useStore((s) => s.currentLevelId);
  const showUnderlay = useStore((s) => s.showUnderlay);
  const setShowUnderlay = useStore((s) => s.setShowUnderlay);
  const activeTool = useStore((s) => s.activeTool);
  const selection = useStore((s) => s.selection);
  const sideHighlight = useStore((s) => s.sideHighlight);
  const currentMaterial = useStore((s) => s.currentMaterial);
  const [resizeOpen, setResizeOpen] = useState(false);

  // The level directly below the active one — drawn as a faint, non-interactive
  // underlay so the user can align to it (only when not on the ground floor).
  const activeIndex = levels.findIndex((l) => l.id === currentLevelId);
  const belowLevel = activeIndex > 0 ? levels[activeIndex - 1] : undefined;

  const [view, setView] = useState<View>({
    pan: { x: 160, y: 160 },
    scale: 60,
  });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Wall drawing.
  const [chainStart, setChainStart] = useState<Vec2 | null>(null);
  const [preview, setPreview] = useState<{ pt: Vec2; snapped: boolean } | null>(
    null,
  );
  // Window tool ghost.
  const [winGhost, setWinGhost] = useState<{
    wall: Wall;
    t: number;
    valid: boolean;
  } | null>(null);
  // Door tool ghost.
  const [doorGhost, setDoorGhost] = useState<{
    wall: Wall;
    t: number;
    valid: boolean;
  } | null>(null);
  // Floor drawing.
  const [floorPts, setFloorPts] = useState<Vec2[]>([]);
  const [floorCursor, setFloorCursor] = useState<Vec2 | null>(null);
  // Rectangle (room) tool drag + the active wall-snap indicator point.
  const [roomRect, setRoomRect] = useState<{ start: Vec2; end: Vec2 } | null>(
    null,
  );
  const [snapHint, setSnapHint] = useState<Vec2 | null>(null);
  // Furniture placement ghost.
  const placingCatalogId = useStore((s) => s.placingCatalogId);
  const [ghostRotation, setGhostRotation] = useState(0);
  const [furnGhost, setFurnGhost] = useState<{
    pos: Vec2;
    rotation: number;
  } | null>(null);
  const lastWorldRef = useRef<Vec2>({ x: 0, y: 0 });

  const dragRef = useRef<DragState>({ kind: "none" });
  const shiftRef = useRef(false);
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const walls = level.walls;
  const floors = level.floors;
  const furniture = level.furniture;

  // An item's real-world footprint after its per-instance scale is applied.
  // Every plan consumer (hit-test, ghost, wall-hugger snap) reads through this
  // so the plan, 3D, and properties panel all agree on size.
  const scaledFootprint = (entry: CatalogEntry, scale: Vec3): Footprint => {
    const d = effectiveDimensions(entry, scale);
    return { width: d.width, depth: d.depth };
  };

  // --- furniture collision (Soft = warn, Hard = revert) ---
  const collisionMode = useStore((s) => s.collisionMode);
  const lastValidFurnRef = useRef<{ pos: Vec2; rotation: number } | null>(null);

  // Ids of collidable items currently overlapping another (for the warning tint).
  const collisionSet = useMemo(() => {
    if (collisionMode === "off") return new Set<string>();
    const items: CollisionItem[] = furniture.flatMap((item) => {
      const entry = getCatalogEntry(item.catalogId);
      if (!entry) return [];
      return [
        {
          id: item.id,
          collidable: entry.collidable,
          footprint: {
            center: item.position,
            rotation: item.rotation,
            footprint: scaledFootprint(entry, item.scale),
          },
        },
      ];
    });
    return collidingIds(items);
  }, [furniture, collisionMode]);

  // Does a collidable item at (pos, rotation, scale) overlap any OTHER collidable
  // item on the active level? Reads fresh state so it's valid mid-drag.
  const furnitureOverlaps = (
    catalogId: string,
    pos: Vec2,
    rotation: number,
    scale: Vec3,
    excludeId?: string,
  ): boolean => {
    const entry = getCatalogEntry(catalogId);
    if (!entry?.collidable) return false;
    const a = {
      center: pos,
      rotation,
      footprint: scaledFootprint(entry, scale),
    };
    for (const o of selectCurrentLevel(useStore.getState()).furniture) {
      if (o.id === excludeId) continue;
      const oe = getCatalogEntry(o.catalogId);
      if (!oe?.collidable) continue;
      if (
        footprintsOverlap(a, {
          center: o.position,
          rotation: o.rotation,
          footprint: scaledFootprint(oe, o.scale),
        })
      )
        return true;
    }
    return false;
  };

  // Bounds of all drawn geometry (walls, floors, furniture footprints), or null
  // if the level is empty. Furniture is measured by its scaled, rotated corners.
  const geometryBounds = (): Bounds | null => {
    const pts: Vec2[] = [];
    for (const w of walls) pts.push(w.start, w.end);
    for (const f of floors) pts.push(...f.polygon);
    for (const item of furniture) {
      const entry = getCatalogEntry(item.catalogId);
      if (!entry) continue;
      pts.push(
        ...footprintCorners(
          item.position,
          item.rotation,
          scaledFootprint(entry, item.scale),
        ),
      );
    }
    return boundsOfPoints(pts);
  };

  // Fit view: frame the union of the site and all content (or just the site when
  // empty), mirroring the 3D preview's Fit view.
  const fitToContent = () => {
    if (size.width === 0) return;
    const bounds = unionBounds(siteBounds(site), geometryBounds());
    if (!bounds) return;
    setView(
      fitView(bounds, size, { minScale: MIN_SCALE, maxScale: MAX_SCALE }),
    );
  };

  // Frame the site + content once, when the plan first gets a size (mirrors the
  // 3D preview, which fits on mount). Only on first measure, never on edits.
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current || size.width === 0) return;
    didInitialFit.current = true;
    fitToContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  const furnitureUnderCursor = (world: Vec2) => {
    for (let i = furniture.length - 1; i >= 0; i--) {
      const item = furniture[i]!;
      const entry = getCatalogEntry(item.catalogId);
      if (!entry) continue;
      if (
        pointInFootprint(
          world,
          item.position,
          item.rotation,
          scaledFootprint(entry, item.scale),
        )
      )
        return item;
    }
    return undefined;
  };

  // Resolve where the placing ghost / a dragged item should sit: grid-snapped,
  // then wall-hugger soft-snap (flush + aligned) when applicable. The snap uses
  // the item's scaled footprint so the back edge lands flush at any size.
  const resolveFurniturePlacement = (
    catalogId: string,
    raw: Vec2,
    rotation: number,
    scale: Vec3 = UNIT_SCALE,
  ): { pos: Vec2; rotation: number } => {
    const entry = getCatalogEntry(catalogId);
    const pos = snapToGrid(raw);
    if (entry?.wallHugger) {
      const snap = wallHuggerSnap(
        pos,
        rotation,
        scaledFootprint(entry, scale),
        walls,
      );
      if (snap.snapped) return { pos: snap.position, rotation: snap.rotation };
    }
    return { pos, rotation };
  };
  const selectedWall =
    selection?.kind === "wall"
      ? walls.find((w) => w.id === selection.id)
      : undefined;

  // Distinct pattern materials used by floors and wall side-A fills -> SVG
  // <pattern> defs.
  const patternDefs = new Map<string, MaterialRef>();
  for (const f of floors) {
    if (f.material.kind === "pattern")
      patternDefs.set(materialKey(f.material), f.material);
  }
  for (const w of walls) {
    if (w.paintA.kind === "pattern")
      patternDefs.set(materialKey(w.paintA), w.paintA);
  }
  if (activeTool === "floor" && currentMaterial.kind === "pattern")
    patternDefs.set(materialKey(currentMaterial), currentMaterial);

  // --- coordinate transforms ---
  const worldToScreen = (p: Vec2): Vec2 => ({
    x: p.x * view.scale + view.pan.x,
    y: p.y * view.scale + view.pan.y,
  });
  const clientToWorld = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.pan.x) / view.scale,
      y: (clientY - rect.top - view.pan.y) / view.scale,
    };
  };
  const clientToScreen = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Snap helper: optional angle constraint, then endpoint snap, else grid.
  const resolveDrawPoint = (
    raw: Vec2,
    fromChain: Vec2 | null,
    excludeId?: string,
    extraSnaps: Vec2[] = [],
  ): { pt: Vec2; snapped: boolean } => {
    let p = raw;
    if (shiftRef.current && fromChain) p = constrainAngle(fromChain, p);
    for (const s of extraSnaps) {
      if (distance(p, s) <= WALL_SNAP_TOLERANCE)
        return { pt: s, snapped: true };
    }
    const candidates = excludeId
      ? walls.filter((w) => w.id !== excludeId)
      : walls;
    // Endpoint→endpoint, then endpoint→segment (T-junction), else grid.
    const snap = snapEndpoint(p, candidates, WALL_SNAP_TOLERANCE);
    if (snap.kind !== "none") return { pt: snap.point, snapped: true };
    return { pt: snapToGrid(p), snapped: false };
  };

  const wallUnderCursor = (world: Vec2): Wall | undefined => {
    const tol = WALL_HIT_TOL_PX / view.scale;
    for (let i = walls.length - 1; i >= 0; i--) {
      if (hitTestWall(world, walls[i]!, tol)) return walls[i]!;
    }
    return undefined;
  };

  const windowUnderCursor = (
    world: Vec2,
  ): { wall: Wall; windowId: string } | undefined => {
    const tol = WALL_HIT_TOL_PX / view.scale;
    for (let i = walls.length - 1; i >= 0; i--) {
      const wall = walls[i]!;
      const L = wallLength(wall);
      if (L === 0) continue;
      const rel = sub(world, wall.start);
      const along = dot(rel, wallDirection(wall));
      const perp = dot(rel, wallNormal(wall));
      if (Math.abs(perp) > wall.thickness / 2 + tol) continue;
      for (const win of wall.windows) {
        const { a, b } = windowSpan(L, win.t, win.width);
        if (along >= a - tol && along <= b + tol)
          return { wall, windowId: win.id };
      }
    }
    return undefined;
  };

  const doorUnderCursor = (
    world: Vec2,
  ): { wall: Wall; doorId: string } | undefined => {
    const tol = WALL_HIT_TOL_PX / view.scale;
    for (let i = walls.length - 1; i >= 0; i--) {
      const wall = walls[i]!;
      const L = wallLength(wall);
      if (L === 0) continue;
      const rel = sub(world, wall.start);
      const along = dot(rel, wallDirection(wall));
      const perp = dot(rel, wallNormal(wall));
      if (Math.abs(perp) > wall.thickness / 2 + tol) continue;
      for (const door of wall.doors) {
        const { a, b } = windowSpan(L, door.t, door.width);
        if (along >= a - tol && along <= b + tol)
          return { wall, doorId: door.id };
      }
    }
    return undefined;
  };

  // --- wheel zoom centered on cursor ---
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldX = (sx - v.pan.x) / v.scale;
      const worldY = (sy - v.pan.y) / v.scale;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, v.scale * factor),
      );
      setView({
        pan: { x: sx - worldX * newScale, y: sy - worldY * newScale },
        scale: newScale,
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Reset transient drawing state when the tool changes.
  useEffect(() => {
    setChainStart(null);
    setPreview(null);
    setWinGhost(null);
    setDoorGhost(null);
    setFloorPts([]);
    setFloorCursor(null);
    setFurnGhost(null);
    setGhostRotation(0);
    useStore.getState().setSideHighlight(null);
    if (activeTool !== "furniture")
      useStore.getState().setPlacingCatalogId(null);
  }, [activeTool]);

  const closeFloor = () => {
    if (floorPts.length >= 3 && isValidFloorPolygon(floorPts)) {
      useStore.getState().addFloor(floorPts, currentMaterial);
      setFloorPts([]);
      setFloorCursor(null);
    }
  };

  // --- keyboard ---
  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
      if (isTyping(e.target)) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!spaceRef.current) {
          spaceRef.current = true;
          setSpaceHeld(true);
        }
      } else if (e.key === "Escape") {
        setChainStart(null);
        setPreview(null);
        setFloorPts([]);
        setFloorCursor(null);
        setFurnGhost(null);
        setRoomRect(null);
        setSnapHint(null);
        dragRef.current = { kind: "none" };
        useStore.getState().setPlacingCatalogId(null);
      } else if (e.key === "Enter") {
        setChainStart(null);
        if (activeTool === "floor") closeFloor();
      } else if (
        e.key === "Backspace" &&
        activeTool === "floor" &&
        floorPts.length
      ) {
        e.preventDefault();
        setFloorPts((pts) => pts.slice(0, -1));
      } else if (e.key === "r" || e.key === "R") {
        const delta = e.shiftKey ? -15 : 15;
        const sel = useStore.getState().selection;
        if (activeTool === "furniture" && placingCatalogId) {
          setGhostRotation((r) => {
            const next = (((r + delta) % 360) + 360) % 360;
            const placed = resolveFurniturePlacement(
              placingCatalogId,
              lastWorldRef.current,
              next,
            );
            setFurnGhost(placed);
            return next;
          });
        } else if (sel?.kind === "furniture") {
          useStore.getState().rotateFurniture(sel.id, delta);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = false;
      if (e.key === " ") {
        spaceRef.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  // --- pointer handlers ---
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    const store = useStore.getState();
    const screen = clientToScreen(e.clientX, e.clientY);

    if (spaceRef.current || e.button === 1) {
      dragRef.current = {
        kind: "pan",
        pointerId: e.pointerId,
        startScreen: screen,
        startPan: { ...view.pan },
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const world = clientToWorld(e.clientX, e.clientY);

    if (activeTool === "wall") {
      const { pt } = resolveDrawPoint(world, chainStart);
      if (chainStart === null) setChainStart(pt);
      else {
        if (distance(chainStart, pt) > 1e-6) store.addWall(chainStart, pt);
        setChainStart(pt);
      }
      setPreview({ pt, snapped: false });
      return;
    }

    if (activeTool === "room") {
      const { pt } = resolveDrawPoint(world, null);
      dragRef.current = {
        kind: "room",
        pointerId: e.pointerId,
        startScreen: screen,
      };
      setRoomRect({ start: pt, end: pt });
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "window") {
      const wall = wallUnderCursor(world);
      if (wall) {
        const candidate = {
          t: projectPointToWallT(wall, world),
          width: DEFAULT_WINDOW_WIDTH,
          height: DEFAULT_WINDOW_HEIGHT,
          sillHeight: DEFAULT_WINDOW_SILL_HEIGHT,
        };
        if (validateWindow(wall, candidate).ok)
          store.addWindow(wall.id, candidate);
      }
      return;
    }

    if (activeTool === "door") {
      const wall = wallUnderCursor(world);
      if (wall) {
        const t = projectPointToWallT(wall, world);
        const candidate = {
          t,
          width: DEFAULT_DOOR_WIDTH,
          height: DEFAULT_DOOR_HEIGHT,
        };
        if (validateDoor(wall, candidate).ok)
          store.addDoor(wall.id, {
            ...candidate,
            // Hinge defaults to the nearer wall end; swing to side A.
            hinge: t < 0.5 ? "start" : "end",
            swing: "A",
            material: { ...DEFAULT_DOOR_MATERIAL },
          });
      }
      return;
    }

    if (activeTool === "furniture") {
      if (placingCatalogId) {
        const placed = resolveFurniturePlacement(
          placingCatalogId,
          world,
          ghostRotation,
        );
        store.placeFurniture(placingCatalogId, placed.pos, placed.rotation);
        // tool stays active for repeat placement
      }
      return;
    }

    if (activeTool === "paint") {
      const item = furnitureUnderCursor(world);
      if (item) {
        const entry = getCatalogEntry(item.catalogId);
        if (entry)
          store.setFurnitureMaterial(
            item.id,
            primarySlot(entry),
            currentMaterial,
          );
        return;
      }
      const wall = wallUnderCursor(world);
      if (wall)
        store.paintWallSide(wall.id, sideOf(wall, world), currentMaterial);
      return;
    }

    if (activeTool === "floor") {
      const first = floorPts[0];
      const snap = resolveDrawPoint(world, null, undefined, floorPts);
      if (
        first &&
        floorPts.length >= 3 &&
        distance(worldToScreen(snap.pt), worldToScreen(first)) <= CLOSE_FLOOR_PX
      ) {
        closeFloor();
      } else {
        setFloorPts((pts) => [...pts, snap.pt]);
      }
      return;
    }

    // --- select tool ---
    const tolHandle = HANDLE_HIT_PX / view.scale;
    if (selectedWall) {
      if (distance(world, selectedWall.start) <= tolHandle) {
        dragRef.current = {
          kind: "endpoint",
          pointerId: e.pointerId,
          wallId: selectedWall.id,
          which: "start",
          startScreen: screen,
          started: false,
        };
        svgRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      if (distance(world, selectedWall.end) <= tolHandle) {
        dragRef.current = {
          kind: "endpoint",
          pointerId: e.pointerId,
          wallId: selectedWall.id,
          which: "end",
          startScreen: screen,
          started: false,
        };
        svgRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }

    const winHit = windowUnderCursor(world);
    if (winHit) {
      store.setSelection({
        kind: "window",
        wallId: winHit.wall.id,
        id: winHit.windowId,
      });
      dragRef.current = {
        kind: "window",
        pointerId: e.pointerId,
        wallId: winHit.wall.id,
        windowId: winHit.windowId,
        startScreen: screen,
        started: false,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    const doorHit = doorUnderCursor(world);
    if (doorHit) {
      store.setSelection({
        kind: "door",
        wallId: doorHit.wall.id,
        id: doorHit.doorId,
      });
      dragRef.current = {
        kind: "door",
        pointerId: e.pointerId,
        wallId: doorHit.wall.id,
        doorId: doorHit.doorId,
        startScreen: screen,
        started: false,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    const furnHit = furnitureUnderCursor(world);
    if (furnHit) {
      store.setSelection({ kind: "furniture", id: furnHit.id });
      // Seed the last-valid position for Hard-mode revert with the pre-drag spot.
      lastValidFurnRef.current = {
        pos: { ...furnHit.position },
        rotation: furnHit.rotation,
      };
      dragRef.current = {
        kind: "furniture",
        pointerId: e.pointerId,
        itemId: furnHit.id,
        startScreen: screen,
        startWorld: world,
        basePos: { ...furnHit.position },
        started: false,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    const hitWall = wallUnderCursor(world);
    if (hitWall) {
      store.setSelection({ kind: "wall", id: hitWall.id });
      dragRef.current = {
        kind: "body",
        pointerId: e.pointerId,
        wallId: hitWall.id,
        startScreen: screen,
        startWorld: world,
        baseStart: { ...hitWall.start },
        baseEnd: { ...hitWall.end },
        started: false,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    for (let i = floors.length - 1; i >= 0; i--) {
      if (pointInPolygon(world, floors[i]!.polygon)) {
        store.setSelection({ kind: "floor", id: floors[i]!.id });
        dragRef.current = { kind: "none" };
        return;
      }
    }

    store.setSelection(null);
    dragRef.current = { kind: "none" };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const store = useStore.getState();

    if (d.kind === "pan") {
      const screen = clientToScreen(e.clientX, e.clientY);
      setView((v) => ({
        ...v,
        pan: {
          x: d.startPan.x + (screen.x - d.startScreen.x),
          y: d.startPan.y + (screen.y - d.startScreen.y),
        },
      }));
      return;
    }

    if (d.kind === "none") {
      const world = clientToWorld(e.clientX, e.clientY);
      lastWorldRef.current = world;
      if (activeTool === "furniture" && placingCatalogId) {
        setFurnGhost(
          resolveFurniturePlacement(placingCatalogId, world, ghostRotation),
        );
      } else if (activeTool === "wall") {
        setPreview(resolveDrawPoint(world, chainStart));
      } else if (activeTool === "floor") {
        setFloorCursor(resolveDrawPoint(world, null, undefined, floorPts).pt);
      } else if (activeTool === "window") {
        const wall = wallUnderCursor(world);
        if (wall) {
          const t = projectPointToWallT(wall, world);
          const valid = validateWindow(wall, {
            t,
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
            sillHeight: DEFAULT_WINDOW_SILL_HEIGHT,
          }).ok;
          setWinGhost({ wall, t, valid });
        } else setWinGhost(null);
      } else if (activeTool === "door") {
        const wall = wallUnderCursor(world);
        if (wall) {
          const t = projectPointToWallT(wall, world);
          const valid = validateDoor(wall, {
            t,
            width: DEFAULT_DOOR_WIDTH,
            height: DEFAULT_DOOR_HEIGHT,
          }).ok;
          setDoorGhost({ wall, t, valid });
        } else setDoorGhost(null);
      } else if (activeTool === "paint") {
        const wall = wallUnderCursor(world);
        store.setSideHighlight(
          wall ? { wallId: wall.id, side: sideOf(wall, world) } : null,
        );
      }
      return;
    }

    if (d.kind === "room") {
      const world = clientToWorld(e.clientX, e.clientY);
      const r = resolveDrawPoint(world, null);
      setRoomRect((rect) => (rect ? { ...rect, end: r.pt } : rect));
      setSnapHint(r.snapped ? r.pt : null);
      return;
    }

    if (
      d.kind === "body" ||
      d.kind === "endpoint" ||
      d.kind === "window" ||
      d.kind === "door" ||
      d.kind === "furniture"
    ) {
      const screen = clientToScreen(e.clientX, e.clientY);
      if (!d.started && distance(screen, d.startScreen) < DRAG_THRESHOLD_PX)
        return;
      if (!d.started) {
        store.beginDrag();
        d.started = true;
      }
      const world = clientToWorld(e.clientX, e.clientY);
      if (d.kind === "furniture") {
        const item = furniture.find((f) => f.id === d.itemId);
        if (item) {
          const raw = add(d.basePos, sub(world, d.startWorld));
          const placed = resolveFurniturePlacement(
            item.catalogId,
            raw,
            item.rotation,
            item.scale,
          );
          store.moveFurniture(d.itemId, placed.pos, placed.rotation);
          // Remember the last non-overlapping spot for a Hard-mode revert.
          if (
            collisionMode === "hard" &&
            !furnitureOverlaps(
              item.catalogId,
              placed.pos,
              placed.rotation,
              item.scale,
              d.itemId,
            )
          ) {
            lastValidFurnRef.current = {
              pos: placed.pos,
              rotation: placed.rotation,
            };
          }
        }
      } else if (d.kind === "body") {
        const delta = snapToGrid({
          x: world.x - d.startWorld.x,
          y: world.y - d.startWorld.y,
        });
        store.translateWall(
          d.wallId,
          add(d.baseStart, delta),
          add(d.baseEnd, delta),
        );
      } else if (d.kind === "endpoint") {
        const r = resolveDrawPoint(world, null, d.wallId);
        store.moveWallEndpoint(d.wallId, d.which, r.pt);
        setSnapHint(r.snapped ? r.pt : null);
      } else if (d.kind === "window") {
        const wall = walls.find((w) => w.id === d.wallId);
        const win = wall?.windows.find((x) => x.id === d.windowId);
        if (wall && win) {
          const t = clampWindowT(
            wall,
            win.width,
            projectPointToWallT(wall, world),
          );
          if (validateWindow(wall, { ...win, t }, win.id).ok)
            store.moveWindow(d.wallId, d.windowId, t);
        }
      } else {
        const wall = walls.find((w) => w.id === d.wallId);
        const door = wall?.doors.find((x) => x.id === d.doorId);
        if (wall && door) {
          const t = clampWindowT(
            wall,
            door.width,
            projectPointToWallT(wall, world),
          );
          if (validateDoor(wall, { ...door, t }, door.id).ok)
            store.moveDoor(d.wallId, d.doorId, t);
        }
      }
    }
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    // Hard mode: if a furniture drag ends on an overlap, revert to the last
    // non-overlapping spot (falling back to the pre-drag position) before commit.
    if (d.kind === "furniture" && d.started && collisionMode === "hard") {
      const item = selectCurrentLevel(useStore.getState()).furniture.find(
        (f) => f.id === d.itemId,
      );
      if (
        item &&
        furnitureOverlaps(
          item.catalogId,
          item.position,
          item.rotation,
          item.scale,
          d.itemId,
        )
      ) {
        const target = lastValidFurnRef.current ?? {
          pos: d.basePos,
          rotation: item.rotation,
        };
        useStore.getState().moveFurniture(d.itemId, target.pos, target.rotation);
      }
    }
    if (
      (d.kind === "body" ||
        d.kind === "endpoint" ||
        d.kind === "window" ||
        d.kind === "door" ||
        d.kind === "furniture") &&
      d.started
    ) {
      useStore.getState().endDrag();
    }
    if (d.kind === "room") {
      if (roomRect) useStore.getState().addRoom(roomRect.start, roomRect.end);
      setRoomRect(null);
    }
    setSnapHint(null);
    if (d.kind !== "none") {
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // capture already gone
      }
    }
    dragRef.current = { kind: "none" };
  };

  const onDoubleClick = () => {
    if (activeTool === "wall") setChainStart(null);
    else if (activeTool === "floor") closeFloor();
  };

  const cursorClass = spaceHeld
    ? "cursor-grab"
    : activeTool === "select"
      ? "cursor-default"
      : "cursor-crosshair";

  const highlightWall = sideHighlight
    ? walls.find((w) => w.id === sideHighlight.wallId)
    : undefined;

  return (
    <div className="plan" ref={containerRef}>
      <svg
        ref={svgRef}
        className={`plan-svg ${cursorClass}`}
        width="100%"
        height="100%"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          {[...patternDefs.entries()].map(([key, mat]) => (
            <pattern
              key={key}
              id={materialDomId(mat)}
              patternUnits="userSpaceOnUse"
              width={PATTERN_TILE_METERS}
              height={PATTERN_TILE_METERS}
            >
              <image
                href={mat.kind === "pattern" ? patternDataUrl(mat) : undefined}
                x={0}
                y={0}
                width={PATTERN_TILE_METERS}
                height={PATTERN_TILE_METERS}
                preserveAspectRatio="none"
              />
            </pattern>
          ))}
        </defs>

        <rect
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          className="plan-bg"
        />
        <Grid size={size} view={view} />

        <g
          transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.scale})`}
        >
          {/* Work-area (site): de-emphasize outside, shade the buildable rect. */}
          <SiteLayer site={site} view={view} size={size} />

          {/* Ghost underlay of the level below (non-interactive reference). */}
          {showUnderlay && belowLevel && <UnderlayLayer level={belowLevel} />}

          {/* Floors beneath everything. */}
          {floors.map((f) => (
            <polygon
              key={f.id}
              className={`floor${selection?.kind === "floor" && selection.id === f.id ? " selected" : ""}`}
              points={toPoints(f.polygon)}
              fill={fillFor(f.material)}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Furniture: rugs (flat) first, then everything else, above floors. */}
          {[...furniture]
            .map((item) => ({ item, entry: getCatalogEntry(item.catalogId) }))
            .filter((x) => x.entry)
            .sort(
              (a, b) =>
                Number(b.entry!.flat ?? false) - Number(a.entry!.flat ?? false),
            )
            .map(({ item, entry }) => (
              <FurnitureSymbolShape
                key={item.id}
                entry={entry!}
                position={item.position}
                rotation={item.rotation}
                scale={item.scale}
                materials={item.materials}
                className={`furn${
                  selection?.kind === "furniture" && selection.id === item.id
                    ? " selected"
                    : ""
                }${collisionSet.has(item.id) ? " warn" : ""}`}
              />
            ))}

          {/* Walls, broken at window openings. */}
          {walls.map((w) => {
            const isSel = selection?.kind === "wall" && selection.id === w.id;
            return (
              <g key={w.id}>
                {wallPlanSegments(w).map((seg, i) => (
                  <polygon
                    key={i}
                    className={`wall${isSel ? " selected" : ""}`}
                    points={toPoints(spanCorners(w, seg.a, seg.b))}
                    fill={fillFor(w.paintA)}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {w.windows.map((win) => (
                  <WindowSymbol
                    key={win.id}
                    wall={w}
                    t={win.t}
                    width={win.width}
                    selected={
                      selection?.kind === "window" && selection.id === win.id
                    }
                  />
                ))}
                {w.doors.map((door) => (
                  <DoorSymbolShape
                    key={door.id}
                    wall={w}
                    door={door}
                    selected={
                      selection?.kind === "door" && selection.id === door.id
                    }
                  />
                ))}
              </g>
            );
          })}

          {/* Paint / chip side-highlight. */}
          {highlightWall && sideHighlight && (
            <polygon
              className="side-highlight"
              points={toPoints(
                sideHalfCorners(highlightWall, sideHighlight.side),
              )}
            />
          )}

          {/* Window ghost (placement preview). */}
          {activeTool === "window" && winGhost && (
            <WindowSymbol
              wall={winGhost.wall}
              t={winGhost.t}
              width={DEFAULT_WINDOW_WIDTH}
              ghost={winGhost.valid ? "valid" : "invalid"}
            />
          )}

          {/* Door ghost (placement preview). */}
          {activeTool === "door" && doorGhost && (
            <DoorSymbolShape
              wall={doorGhost.wall}
              door={{
                t: doorGhost.t,
                width: DEFAULT_DOOR_WIDTH,
                hinge: doorGhost.t < 0.5 ? "start" : "end",
                swing: "A",
              }}
              ghost={doorGhost.valid ? "valid" : "invalid"}
            />
          )}

          {/* Furniture placement ghost. */}
          {activeTool === "furniture" &&
            placingCatalogId &&
            furnGhost &&
            (() => {
              const entry = getCatalogEntry(placingCatalogId);
              const warn =
                collisionMode !== "off" &&
                furnitureOverlaps(
                  placingCatalogId,
                  furnGhost.pos,
                  furnGhost.rotation,
                  UNIT_SCALE,
                );
              return entry ? (
                <FurnitureSymbolShape
                  entry={entry}
                  position={furnGhost.pos}
                  rotation={furnGhost.rotation}
                  materials={{}}
                  className={`furn furn-ghost${warn ? " warn" : ""}`}
                />
              ) : null;
            })()}

          {/* Wall drawing preview. */}
          {activeTool === "wall" && chainStart && preview && (
            <line
              className="preview-line"
              x1={chainStart.x}
              y1={chainStart.y}
              x2={preview.pt.x}
              y2={preview.pt.y}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Floor drawing preview. */}
          {activeTool === "floor" && floorPts.length > 0 && (
            <FloorPreview points={floorPts} cursor={floorCursor} />
          )}

          {/* Rectangle (room) tool preview. */}
          {roomRect && (
            <rect
              className="room-preview"
              x={Math.min(roomRect.start.x, roomRect.end.x)}
              y={Math.min(roomRect.start.y, roomRect.end.y)}
              width={Math.abs(roomRect.end.x - roomRect.start.x)}
              height={Math.abs(roomRect.end.y - roomRect.start.y)}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>

        <Overlay
          selectedWall={selectedWall}
          activeTool={activeTool}
          chainStart={chainStart}
          preview={preview}
          floorPts={floorPts}
          worldToScreen={worldToScreen}
        />

        {/* Site dimension label on the top border (screen space). */}
        {(() => {
          const p = worldToScreen({ x: site.width / 2, y: 0 });
          return (
            <text
              className="site-label"
              x={p.x}
              y={p.y - 6}
              textAnchor="middle"
            >
              {`${site.width.toFixed(1)} × ${site.depth.toFixed(1)} m`}
            </text>
          );
        })()}

        {/* Rectangle (room) tool width × depth labels (screen space). */}
        {roomRect &&
          (() => {
            const w = Math.abs(roomRect.end.x - roomRect.start.x);
            const d = Math.abs(roomRect.end.y - roomRect.start.y);
            const cx = (roomRect.start.x + roomRect.end.x) / 2;
            const top = worldToScreen({
              x: cx,
              y: Math.min(roomRect.start.y, roomRect.end.y),
            });
            const cy = (roomRect.start.y + roomRect.end.y) / 2;
            const leftEdge = worldToScreen({
              x: Math.min(roomRect.start.x, roomRect.end.x),
              y: cy,
            });
            return (
              <g className="length-label">
                <RoomDimLabel x={top.x} y={top.y - 12} text={formatMeters(w)} />
                <RoomDimLabel
                  x={leftEdge.x - 30}
                  y={leftEdge.y}
                  text={formatMeters(d)}
                />
              </g>
            );
          })()}

        {/* Active wall-snap indicator (endpoint / segment fuse). */}
        {(snapHint ||
          (preview?.snapped && activeTool === "wall" ? preview.pt : null)) &&
          (() => {
            const node = snapHint ?? preview!.pt;
            const s = worldToScreen(node);
            return (
              <circle className="snap-ring" cx={s.x} cy={s.y} r={7} />
            );
          })()}
      </svg>

      <div className="plan-controls">
        {belowLevel && (
          <button
            type="button"
            className={`plan-control-button${showUnderlay ? " active" : ""}`}
            aria-pressed={showUnderlay}
            title="Show the level below as a faint reference"
            onClick={() => setShowUnderlay(!showUnderlay)}
          >
            Underlay
          </button>
        )}
        <button
          type="button"
          className="plan-control-button"
          title="Resize the work area"
          onClick={() => setResizeOpen(true)}
        >
          Resize area
        </button>
        <button
          type="button"
          className="plan-control-button"
          title="Frame the work area and everything drawn"
          onClick={fitToContent}
        >
          Fit view
        </button>
      </div>

      <div className="plan-hint">
        {hintFor(activeTool, chainStart, floorPts.length)}
      </div>

      {resizeOpen && <ResizeAreaDialog onClose={() => setResizeOpen(false)} />}
    </div>
  );
}

function hintFor(tool: string, chainStart: Vec2 | null, floorCount: number) {
  switch (tool) {
    case "wall":
      return chainStart
        ? "Click to add a point · Enter / double-click to finish · Esc to cancel"
        : "Click to start a wall · hold Shift for 0/45/90°";
    case "room":
      return "Drag a rectangle to make four joined walls · Esc cancels";
    case "window":
      return "Hover a wall and click to place a window · invalid spots show red";
    case "door":
      return "Hover a wall and click to place a door · edit hinge & swing in the panel";
    case "furniture":
      return "Pick an item from the palette · click to place · R / Shift+R rotates · Esc cancels";
    case "paint":
      return "Hover a wall or furniture to paint · click to apply the material";
    case "floor":
      return floorCount
        ? "Click to add points · click the first point or Enter to close · Backspace removes the last · Esc cancels"
        : "Click to start a floor outline";
    default:
      return "Click a wall, window, door, or floor to select · Space-drag to pan · scroll to zoom";
  }
}

function WindowSymbol({
  wall,
  t,
  width,
  selected,
  ghost,
}: {
  wall: Wall;
  t: number;
  width: number;
  selected?: boolean;
  ghost?: "valid" | "invalid";
}) {
  const L = wallLength(wall);
  if (L === 0) return null;
  const { a, b } = windowSpan(L, t, width);
  const dir = wallDirection(wall);
  const n = wallNormal(wall);
  const o = vscale(n, wall.thickness / 2);
  const A = add(wall.start, vscale(dir, Math.max(0, a)));
  const B = add(wall.start, vscale(dir, Math.min(L, b)));
  const cls = ghost
    ? `window-symbol ghost-${ghost}`
    : `window-symbol${selected ? " selected" : ""}`;
  const seg = (p: Vec2, q: Vec2, key: string) => (
    <line
      key={key}
      x1={p.x}
      y1={p.y}
      x2={q.x}
      y2={q.y}
      vectorEffect="non-scaling-stroke"
    />
  );
  return (
    <g className={cls}>
      {seg(add(A, o), add(B, o), "fa")}
      {seg(sub(A, o), sub(B, o), "fb")}
      {seg(A, B, "c")}
      {seg(add(A, o), sub(A, o), "ja")}
      {seg(add(B, o), sub(B, o), "jb")}
    </g>
  );
}

// Standard architectural door symbol: jamb ticks across the opening, the leaf
// drawn open (perpendicular from the hinge), and a quarter-circle swing arc.
function DoorSymbolShape({
  wall,
  door,
  selected,
  ghost,
}: {
  wall: Wall;
  door: { t: number; width: number; hinge: "start" | "end"; swing: "A" | "B" };
  selected?: boolean;
  ghost?: "valid" | "invalid";
}) {
  const L = wallLength(wall);
  if (L === 0) return null;
  const { hinge, jamb, leafEnd, sweepFlag, radius } = doorSymbol(wall, door);
  const n = vscale(wallNormal(wall), wall.thickness / 2);
  const cls = ghost
    ? `door-symbol ghost-${ghost}`
    : `door-symbol${selected ? " selected" : ""}`;
  return (
    <g className={cls}>
      {/* jamb ticks across the wall thickness at both opening edges */}
      <line
        x1={add(hinge, n).x}
        y1={add(hinge, n).y}
        x2={sub(hinge, n).x}
        y2={sub(hinge, n).y}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={add(jamb, n).x}
        y1={add(jamb, n).y}
        x2={sub(jamb, n).x}
        y2={sub(jamb, n).y}
        vectorEffect="non-scaling-stroke"
      />
      {/* door leaf (open) */}
      <line
        className="door-leaf"
        x1={hinge.x}
        y1={hinge.y}
        x2={leafEnd.x}
        y2={leafEnd.y}
        vectorEffect="non-scaling-stroke"
      />
      {/* swing arc from the closed position to the open leaf */}
      <path
        className="door-arc"
        d={`M ${jamb.x} ${jamb.y} A ${radius} ${radius} 0 0 ${sweepFlag} ${leafEnd.x} ${leafEnd.y}`}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function FloorPreview({
  points,
  cursor,
}: {
  points: Vec2[];
  cursor: Vec2 | null;
}) {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const linePts = cursor ? [...points, cursor] : points;
  return (
    <g className="floor-preview">
      <polyline points={toPoints(linePts)} vectorEffect="non-scaling-stroke" />
      {cursor && points.length >= 2 && (
        <line
          className="floor-close"
          x1={cursor.x}
          y1={cursor.y}
          x2={first.x}
          y2={first.y}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={0.06}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {cursor && (
        <line
          className="floor-edge"
          x1={last.x}
          y1={last.y}
          x2={cursor.x}
          y2={cursor.y}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

// The work-area rectangle (plan coords [0,width] x [0,depth]) rendered inside the
// transformed group: a subtle fill, a dim mask over everything OUTSIDE it (so the
// grid reads as de-emphasized there), and a crisp border. The boundary is soft —
// drawing outside is still allowed.
function SiteLayer({
  site,
  view,
  size,
}: {
  site: Site;
  view: View;
  size: { width: number; height: number };
}) {
  if (size.width === 0) return null;
  const left = (0 - view.pan.x) / view.scale;
  const right = (size.width - view.pan.x) / view.scale;
  const top = (0 - view.pan.y) / view.scale;
  const bottom = (size.height - view.pan.y) / view.scale;
  const { width: W, depth: D } = site;
  // Outer (visible) rect minus the site rect, even-odd → fills only the outside.
  const dim = `M${left},${top} H${right} V${bottom} H${left} Z M0,0 H${W} V${D} H0 Z`;
  return (
    <g className="site-layer">
      <rect className="site-fill" x={0} y={0} width={W} height={D} />
      <path className="site-dim" d={dim} fillRule="evenodd" />
      <rect
        className="site-border"
        x={0}
        y={0}
        width={W}
        height={D}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

// Faint, non-interactive reference of the level directly below the active one:
// floor fills and wall footprints (stroke width = real thickness). Pointer events
// are disabled so clicks always reach the active level.
function UnderlayLayer({ level }: { level: Level }) {
  return (
    <g className="underlay">
      {level.floors.map((f) => (
        <polygon
          key={f.id}
          className="underlay-floor"
          points={toPoints(f.polygon)}
        />
      ))}
      {level.walls.map((w) => (
        <line
          key={w.id}
          className="underlay-wall"
          x1={w.start.x}
          y1={w.start.y}
          x2={w.end.x}
          y2={w.end.y}
          strokeWidth={w.thickness}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// A small screen-space dimension chip (reuses the length-label styling).
function RoomDimLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 7 + 10;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-10} width={w} height={18} rx={3} />
      <text x={0} y={3} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function Grid({
  size,
  view,
}: {
  size: { width: number; height: number };
  view: View;
}) {
  if (size.width === 0) return null;
  const left = (0 - view.pan.x) / view.scale;
  const right = (size.width - view.pan.x) / view.scale;
  const top = (0 - view.pan.y) / view.scale;
  const bottom = (size.height - view.pan.y) / view.scale;

  const lines: React.ReactNode[] = [];
  for (const { spacing, className } of GRID_TIERS) {
    if (spacing * view.scale < 7) continue;
    const startX = Math.floor(left / spacing) * spacing;
    const endX = Math.ceil(right / spacing) * spacing;
    const startY = Math.floor(top / spacing) * spacing;
    const endY = Math.ceil(bottom / spacing) * spacing;
    if ((endX - startX) / spacing > 2000 || (endY - startY) / spacing > 2000)
      continue;

    const tier: React.ReactNode[] = [];
    for (let x = startX; x <= endX + 1e-9; x += spacing) {
      const sx = x * view.scale + view.pan.x;
      tier.push(
        <line key={`vx${x}`} x1={sx} y1={0} x2={sx} y2={size.height} />,
      );
    }
    for (let y = startY; y <= endY + 1e-9; y += spacing) {
      const sy = y * view.scale + view.pan.y;
      tier.push(<line key={`hy${y}`} x1={0} y1={sy} x2={size.width} y2={sy} />);
    }
    lines.push(
      <g key={className} className={className}>
        {tier}
      </g>,
    );
  }
  return <g className="grid">{lines}</g>;
}

function Overlay({
  selectedWall,
  activeTool,
  chainStart,
  preview,
  floorPts,
  worldToScreen,
}: {
  selectedWall: Wall | undefined;
  activeTool: string;
  chainStart: Vec2 | null;
  preview: { pt: Vec2; snapped: boolean } | null;
  floorPts: Vec2[];
  worldToScreen: (p: Vec2) => Vec2;
}) {
  return (
    <g className="overlay">
      {selectedWall &&
        activeTool === "select" &&
        [selectedWall.start, selectedWall.end].map((p, i) => {
          const s = worldToScreen(p);
          return (
            <circle
              key={i}
              className="handle"
              cx={s.x}
              cy={s.y}
              r={HANDLE_RADIUS_PX}
            />
          );
        })}

      {activeTool === "wall" && preview?.snapped && (
        <circle
          className="snap-ring"
          cx={worldToScreen(preview.pt).x}
          cy={worldToScreen(preview.pt).y}
          r={HANDLE_RADIUS_PX + 2}
        />
      )}

      {activeTool === "wall" && chainStart && preview && (
        <LengthLabel
          a={worldToScreen(chainStart)}
          b={worldToScreen(preview.pt)}
          meters={wallLength({ start: chainStart, end: preview.pt })}
        />
      )}

      {activeTool === "floor" &&
        floorPts.length > 0 &&
        (() => {
          const s = worldToScreen(floorPts[0]!);
          return (
            <circle
              className="floor-start"
              cx={s.x}
              cy={s.y}
              r={HANDLE_RADIUS_PX}
            />
          );
        })()}
    </g>
  );
}

function LengthLabel({ a, b, meters }: { a: Vec2; b: Vec2; meters: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const text = formatMeters(meters);
  return (
    <g className="length-label" transform={`translate(${mx} ${my - 12})`}>
      <rect
        x={-text.length * 4 - 6}
        y={-11}
        width={text.length * 8 + 12}
        height={20}
        rx={4}
      />
      <text x={0} y={4} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}
