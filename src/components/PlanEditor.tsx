import { useEffect, useMemo, useRef, useState } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import type { WallSide } from "../store/store";
import type {
  Level,
  MaterialRef,
  Roof,
  Site,
  Staircase,
  Vec2,
  Wall,
} from "../model/types";
import {
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_DOOR_MATERIAL,
  DEFAULT_DOOR_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_MUNTIN_MATERIAL,
  DEFAULT_STAIR_WIDTH,
  DEFAULT_MOUNT_HEIGHT,
  FLOOR_SLAB_THICKNESS,
  createStaircase,
} from "../model/defaults";
import { computeStair } from "../geometry/stair";
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
import { overlappingOpeningIds } from "../geometry/openings";
import { isValidFloorPolygon, pointInPolygon } from "../geometry/polygon";
import { floorHoles } from "../geometry/floorOpenings";
import {
  pointInFootprint,
  wallHuggerSnap,
  footprintCorners,
  footprintsOverlap,
  collidableItemsCollide,
  collidingMovableIds,
  wallFootprint,
  type Footprint,
  type CollisionItem,
  type OrientedFootprint,
} from "../geometry/furniture";
import { wallMountPlanFootprint } from "../geometry/wallMount";
import {
  roofContainsPoint,
  roofFramePoints,
} from "../geometry/roofPlacement";
import { decomposeRectilinear, isRectilinear } from "../geometry/roof";
import {
  boundsOfPoints,
  unionBounds,
  siteBounds,
  fitView,
  type Bounds,
} from "../geometry/planview";
import { LevelsPanel } from "./LevelsPanel";
import {
  getCatalogEntry,
  primarySlot,
  effectiveDimensions,
  collisionExtent,
  UNIT_SCALE,
  type CatalogEntry,
} from "../catalog";
import type { Vec3 } from "../model/types";
import { FurnitureSymbolShape } from "./FurnitureSymbol";
import { materialKey, materialDomId } from "../materials/key";
import { patternDataUrl, representativeColor } from "../materials/textures";
import { PATTERN_TILE_METERS } from "../materials/patterns";
import { useElementSize } from "../lib/useElementSize";
import { formatMeters } from "../lib/format";
import { capturePlan, setPlanCapturer, type PlanCapturer } from "../lib/capture";

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
  | {
      kind: "staircase";
      pointerId: number;
      itemId: string;
      startScreen: Vec2;
      startWorld: Vec2;
      basePos: Vec2;
      started: boolean;
    }
  | {
      kind: "ceilingLight";
      pointerId: number;
      itemId: string;
      startScreen: Vec2;
      startWorld: Vec2;
      basePos: Vec2;
      started: boolean;
    }
  | {
      kind: "roof";
      pointerId: number;
      itemId: string;
      startScreen: Vec2;
      startWorld: Vec2;
      basePos: Vec2;
      started: boolean;
    }
  | { kind: "roofDraw"; pointerId: number; startScreen: Vec2 }
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

// Half of a wall SPAN on the given side (centerline → outer face), so each side
// can be filled with its own paint in the plan.
function spanHalfCorners(
  wall: Wall,
  a: number,
  b: number,
  side: WallSide,
): Vec2[] {
  const dir = wallDirection(wall);
  const n = wallNormal(wall); // points to side A
  const o = vscale(n, side === "A" ? wall.thickness / 2 : -wall.thickness / 2);
  const A = add(wall.start, vscale(dir, a));
  const B = add(wall.start, vscale(dir, b));
  return [A, B, add(B, o), add(A, o)];
}

// Half of the wall rectangle on the given side (for the paint hover highlight).
function sideHalfCorners(wall: Wall, side: WallSide): Vec2[] {
  const n = wallNormal(wall); // points to side A
  const o = vscale(n, side === "A" ? wall.thickness / 2 : -wall.thickness / 2);
  return [wall.start, wall.end, add(wall.end, o), add(wall.start, o)];
}

const toPoints = (pts: Vec2[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

const ringD = (pts: Vec2[]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

// SVG path for a floor polygon with stairwell openings cut out as holes
// (even-odd fill) — mirrors the 3D floor-slab mask so the plan shows the hole.
const floorPathD = (polygon: Vec2[], holes: Vec2[][]) =>
  [ringD(polygon), ...holes.map(ringD)].join(" ");

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
  const showDimensions = useStore((s) => s.showDimensions);
  const setShowDimensions = useStore((s) => s.setShowDimensions);
  const activeTool = useStore((s) => s.activeTool);
  const selection = useStore((s) => s.selection);
  const sideHighlight = useStore((s) => s.sideHighlight);
  const currentMaterial = useStore((s) => s.currentMaterial);
  const fillTarget = useStore((s) => s.fillTarget);
  const roofMode = useStore((s) => s.roofMode);
  const mergeNotice = useStore((s) => s.mergeNotice);
  const mergeNoticeNonce = useStore((s) => s.mergeNoticeNonce);
  const dismissMergeNotice = useStore((s) => s.dismissMergeNotice);
  const [floorsOpen, setFloorsOpen] = useState(false);
  const [fillMessage, setFillMessage] = useState<string | null>(null);

  // Auto-dismiss the transient "merged overlapping walls" notice. Keyed off the
  // nonce so a repeat merge restarts the timer even when the text is unchanged.
  useEffect(() => {
    if (!mergeNotice) return;
    const id = window.setTimeout(() => dismissMergeNotice(), 2200);
    return () => window.clearTimeout(id);
  }, [mergeNotice, mergeNoticeNonce, dismissMergeNotice]);

  // The level directly below the active one — drawn as a faint, non-interactive
  // underlay so the user can align to it (only when not on the ground floor).
  const activeIndex = levels.findIndex((l) => l.id === currentLevelId);
  const belowLevel = activeIndex > 0 ? levels[activeIndex - 1] : undefined;
  // Stairwell opening rectangles from the level below (cut as holes in floors).
  const belowOpenings = belowLevel
    ? belowLevel.staircases.map(
        (s) =>
          computeStair(s, belowLevel.wallHeight + FLOOR_SLAB_THICKNESS).opening,
      )
    : [];
  // The same openings as oriented footprints — collision barriers so furniture
  // can't sit over the stairwell hole on this level.
  const belowOpeningFootprints: OrientedFootprint[] = belowLevel
    ? belowLevel.staircases.map((s) => ({
        center: s.position,
        rotation: s.rotation,
        footprint: {
          width: s.width,
          depth: computeStair(s, belowLevel.wallHeight + FLOOR_SLAB_THICKNESS)
            .runLength,
        },
      }))
    : [];

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
  // Roof tool drag rectangle (grid-snapped corners; mirrors the Room sub-tool).
  const [roofRect, setRoofRect] = useState<{ start: Vec2; end: Vec2 } | null>(
    null,
  );
  const [snapHint, setSnapHint] = useState<Vec2 | null>(null);
  // Furniture placement ghost.
  const placingCatalogId = useStore((s) => s.placingCatalogId);
  const placingVariant = useStore((s) => s.placingVariant);
  const [ghostRotation, setGhostRotation] = useState(0);
  const [furnGhost, setFurnGhost] = useState<{
    pos: Vec2;
    rotation: number;
  } | null>(null);
  // Staircase placement ghost (shares ghostRotation with furniture).
  const [stairGhost, setStairGhost] = useState<{
    pos: Vec2;
    rotation: number;
  } | null>(null);
  // Wall-mount placement ghost (the active placing item is a mount:"wall" entry).
  const [mountGhost, setMountGhost] = useState<{
    wall: Wall;
    t: number;
    face: WallSide;
  } | null>(null);
  // Ceiling-light placement ghost (the active placing item is a mount:"ceiling").
  const [ceilingGhost, setCeilingGhost] = useState<Vec2 | null>(null);
  const lastWorldRef = useRef<Vec2>({ x: 0, y: 0 });
  // The catalog entry being placed, and whether it attaches to a wall/ceiling.
  const placingEntry = placingCatalogId
    ? getCatalogEntry(placingCatalogId)
    : undefined;
  const placingWallMount = placingEntry?.mount === "wall";
  const placingCeiling = placingEntry?.mount === "ceiling";

  const dragRef = useRef<DragState>({ kind: "none" });
  const shiftRef = useRef(false);
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const walls = level.walls;
  const floors = level.floors;
  const furniture = level.furniture;
  const staircases = level.staircases;
  const ceilingLights = level.ceilingLights;
  const roofs = level.roofs;
  const storeyHeight = level.wallHeight + FLOOR_SLAB_THICKNESS;

  // A roof under the cursor, for select: a rect roof uses its rotated rectangle,
  // a polygon (auto) roof uses its footprint outline.
  const roofUnderCursor = (world: Vec2): Roof | undefined => {
    for (let i = roofs.length - 1; i >= 0; i--) {
      const r = roofs[i]!;
      if (roofContainsPoint(r, world)) return r;
    }
    return undefined;
  };

  // A staircase's footprint (width × run), and a hit-test for the select tool.
  const stairFootprint = (stair: Staircase): Footprint => ({
    width: stair.width,
    depth: computeStair(stair, storeyHeight).runLength,
  });
  // A staircase as a bulky, full-height collision candidate (no tuck-under).
  const stairCandidate = (
    id: string,
    pos: Vec2,
    rotation: number,
    footprint: Footprint,
  ): CollisionItem => ({
    id,
    collidable: true,
    footprint: { center: pos, rotation, footprint },
    vertical: { base: 0, height: storeyHeight },
  });
  const stairUnderCursor = (world: Vec2): Staircase | undefined => {
    for (let i = staircases.length - 1; i >= 0; i--) {
      const s = staircases[i]!;
      if (pointInFootprint(world, s.position, s.rotation, stairFootprint(s)))
        return s;
    }
    return undefined;
  };

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
  // Manual "Snap to wall" toggle (Part C). When on, ANY furniture/staircase
  // snaps flush to a nearby wall (overrides the per-item `wallHugger` flag);
  // when off, nothing auto-snaps. Authoritative over the flag.
  const snapToWall = useStore((s) => s.snapToWall);
  // True once the user manually rotates the placement ghost (R/Shift+R): manual
  // rotation then wins — snap keeps the flush position but honors that rotation.
  const manualRotateRef = useRef(false);

  // Every collidable footprint on the active level (collidable furniture + all
  // staircases) — shared by the warning set and the overlap check.
  const collidablesOf = (lvl: Level): CollisionItem[] => {
    const items: CollisionItem[] = [];
    for (const item of lvl.furniture) {
      const entry = getCatalogEntry(item.catalogId);
      if (!entry) continue;
      const ext = collisionExtent(entry, item.scale);
      items.push({
        id: item.id,
        collidable: entry.collidable,
        footprint: {
          center: item.position,
          rotation: item.rotation,
          footprint: scaledFootprint(entry, item.scale),
        },
        vertical: { base: 0, height: ext.height },
        tuck: { legClearance: ext.legClearance, tuckHeight: ext.tuckHeight },
      });
    }
    for (const s of lvl.staircases) {
      items.push({
        id: s.id,
        collidable: true,
        footprint: {
          center: s.position,
          rotation: s.rotation,
          footprint: stairFootprint(s),
        },
        vertical: { base: 0, height: storeyHeight },
      });
    }
    return items;
  };

  // Ids of collidable things currently overlapping another item OR a wall (for
  // the warning tint).
  const collisionSet = useMemo(() => {
    if (collisionMode === "off") return new Set<string>();
    return collidingMovableIds(collidablesOf(level), [
      ...walls.map(wallFootprint),
      ...belowOpeningFootprints,
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [furniture, staircases, walls, belowLevel, collisionMode]);

  // Ids of openings (windows/doors) whose visible spans overlap another opening
  // on the SAME wall — always warned (a modelling error), independent of the
  // furniture collisionMode. Accounts for a sliding door's offset panel.
  const openingOverlapSet = useMemo(() => {
    const hits = new Set<string>();
    for (const w of walls)
      for (const id of overlappingOpeningIds(w)) hits.add(id);
    return hits;
  }, [walls]);

  // Does a candidate collide with any OTHER collidable thing on the active level
  // (height-aware, with tuck-under), or a wall / stairwell opening (footprint
  // barriers)? Reads fresh state so it's valid mid-drag.
  const overlapsCollidable = (
    candidate: CollisionItem,
    excludeId: string,
  ): boolean => {
    const st = useStore.getState();
    const lvl = selectCurrentLevel(st);
    for (const o of collidablesOf(lvl)) {
      if (o.id === excludeId || !o.collidable) continue;
      if (collidableItemsCollide(candidate, o)) return true;
    }
    for (const w of lvl.walls) {
      if (footprintsOverlap(candidate.footprint, wallFootprint(w))) return true;
    }
    // Stairwell openings from the level below (the floor hole on this level).
    const idx = st.design.levels.findIndex((l) => l.id === st.currentLevelId);
    const below = idx > 0 ? st.design.levels[idx - 1] : undefined;
    if (below) {
      for (const s of below.staircases) {
        const fp: OrientedFootprint = {
          center: s.position,
          rotation: s.rotation,
          footprint: {
            width: s.width,
            depth: computeStair(s, below.wallHeight + FLOOR_SLAB_THICKNESS)
              .runLength,
          },
        };
        if (footprintsOverlap(candidate.footprint, fp)) return true;
      }
    }
    return false;
  };
  const furnitureOverlaps = (
    catalogId: string,
    pos: Vec2,
    rotation: number,
    scale: Vec3,
    excludeId = "",
  ): boolean => {
    const entry = getCatalogEntry(catalogId);
    if (!entry?.collidable) return false;
    const ext = collisionExtent(entry, scale);
    return overlapsCollidable(
      {
        id: excludeId || "candidate",
        collidable: true,
        footprint: { center: pos, rotation, footprint: scaledFootprint(entry, scale) },
        vertical: { base: 0, height: ext.height },
        tuck: { legClearance: ext.legClearance, tuckHeight: ext.tuckHeight },
      },
      excludeId,
    );
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
    for (const r of roofs) pts.push(...roofFramePoints(r));
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

  // Rasterize the plan to a 2× PNG framed to the design content (Phase 5 Part A).
  // Registered with the capture bridge so the unified Export menu in the top bar
  // can drive it; kept in a ref so the stable registered wrapper always reads the
  // current SVG + bounds.
  const capturePlanImpl = useRef<PlanCapturer>(async () => null);
  capturePlanImpl.current = async (opts) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const bounds = unionBounds(siteBounds(site), geometryBounds());
    if (!bounds) return null;
    return capturePlan(svg, bounds, {
      scale: opts?.scale ?? 2,
      transparent: opts?.transparent,
    });
  };
  useEffect(() => {
    setPlanCapturer((opts) => capturePlanImpl.current(opts));
    return () => setPlanCapturer(null);
  }, []);

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

  // A ceiling light whose plan marker is under the cursor (footprint hit-test).
  const ceilingLightUnderCursor = (world: Vec2) => {
    for (let i = ceilingLights.length - 1; i >= 0; i--) {
      const light = ceilingLights[i]!;
      const entry = getCatalogEntry(light.catalogId);
      if (!entry) continue;
      if (
        pointInFootprint(
          world,
          light.position,
          0,
          scaledFootprint(entry, light.scale),
        )
      )
        return light;
    }
    return undefined;
  };

  // A wall mount whose plan marker (the rectangle on the wall face) is under the
  // cursor, for select-tool picking. Mounts sit just off the wall face.
  const mountUnderCursor = (
    world: Vec2,
  ): { wall: Wall; mountId: string } | undefined => {
    for (let i = walls.length - 1; i >= 0; i--) {
      const wall = walls[i]!;
      for (let j = wall.mounts.length - 1; j >= 0; j--) {
        const m = wall.mounts[j]!;
        const entry = getCatalogEntry(m.catalogId);
        if (!entry) continue;
        const d = effectiveDimensions(entry, m.scale);
        const fp = wallMountPlanFootprint(wall, m.t, m.face, d.width, d.depth);
        if (pointInFootprint(world, fp.center, fp.rotation, fp.footprint))
          return { wall, mountId: m.id };
      }
    }
    return undefined;
  };

  // Snap a footprint flush to a nearby wall when the Snap-to-wall toggle is on.
  // Generalized to ANY item (overrides the per-item `wallHugger` flag). `align`
  // controls rotation: true aligns the item's front into the room (the default),
  // false keeps the given rotation (manual rotation wins). The snap uses the
  // item's scaled footprint so the back edge lands flush at any size.
  const snapFootprintToWall = (
    pos: Vec2,
    rotation: number,
    fp: Footprint,
    align: boolean,
  ): { pos: Vec2; rotation: number } => {
    if (!snapToWall) return { pos, rotation };
    const snap = wallHuggerSnap(pos, rotation, fp, walls, undefined, align);
    return snap.snapped
      ? { pos: snap.position, rotation: snap.rotation }
      : { pos, rotation };
  };

  // Resolve where the placing ghost / a dragged furniture item should sit:
  // grid-snapped, then wall-snap (flush) when the toggle is on. `align` defaults
  // to true (face into the room); pass false to keep the caller's rotation.
  const resolveFurniturePlacement = (
    catalogId: string,
    raw: Vec2,
    rotation: number,
    scale: Vec3 = UNIT_SCALE,
    align = true,
  ): { pos: Vec2; rotation: number } => {
    const entry = getCatalogEntry(catalogId);
    const pos = snapToGrid(raw);
    if (!entry) return { pos, rotation };
    return snapFootprintToWall(pos, rotation, scaledFootprint(entry, scale), align);
  };

  // Resolve a staircase placement/drag: grid-snapped, then wall-snap (flush) when
  // the toggle is on, using the stair's footprint (width × run length). Stairs
  // honor the Snap-to-wall toggle too. `width`/`depth` default to a new stair.
  const resolveStairPlacement = (
    raw: Vec2,
    rotation: number,
    align: boolean,
    width = DEFAULT_STAIR_WIDTH,
    depth?: number,
  ): { pos: Vec2; rotation: number } => {
    const pos = snapToGrid(raw);
    const run =
      depth ??
      computeStair(
        createStaircase(pos, { rotation, width }),
        storeyHeight,
      ).runLength;
    return snapFootprintToWall(pos, rotation, { width, depth: run }, align);
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
    setMountGhost(null);
    setCeilingGhost(null);
    setRoofRect(null);
    setGhostRotation(0);
    manualRotateRef.current = false;
    useStore.getState().setSideHighlight(null);
    if (activeTool !== "furniture")
      useStore.getState().setPlacingCatalogId(null);
  }, [activeTool]);

  // Picking a different catalog item resets the manual-rotation intent so the new
  // item aligns to walls by default again.
  useEffect(() => {
    manualRotateRef.current = false;
    setGhostRotation(0);
  }, [placingCatalogId, placingVariant]);

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
        setStairGhost(null);
        setCeilingGhost(null);
        setRoomRect(null);
        setRoofRect(null);
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
          // Manual rotation wins from here on (snap keeps position, not rotation).
          manualRotateRef.current = true;
          setGhostRotation((r) => {
            const next = (((r + delta) % 360) + 360) % 360;
            const placed = resolveFurniturePlacement(
              placingCatalogId,
              lastWorldRef.current,
              next,
              UNIT_SCALE,
              false,
            );
            setFurnGhost(placed);
            return next;
          });
        } else if (activeTool === "stair") {
          manualRotateRef.current = true;
          setGhostRotation((r) => {
            const next = (((r + delta) % 360) + 360) % 360;
            setStairGhost(
              resolveStairPlacement(lastWorldRef.current, next, false),
            );
            return next;
          });
        } else if (sel?.kind === "furniture") {
          useStore.getState().rotateFurniture(sel.id, delta);
        } else if (sel?.kind === "staircase") {
          useStore.getState().rotateStaircase(sel.id, delta);
        } else if (sel?.kind === "roof") {
          // Polygon (auto) roofs have no rotation; only rect roofs rotate.
          const r = selectCurrentLevel(useStore.getState()).roofs.find(
            (x) => x.id === sel.id,
          );
          if (r && r.shape !== "polygon")
            useStore.getState().rotateRoof(sel.id, delta);
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
          store.addWindow(wall.id, {
            ...candidate,
            style: store.lastWindowStyle,
            muntinMaterial: { ...DEFAULT_MUNTIN_MATERIAL },
          });
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
            style: store.lastDoorStyle,
            // Hinge defaults to the nearer wall end; swing to side A.
            hinge: t < 0.5 ? "start" : "end",
            swing: "A",
            material: { ...DEFAULT_DOOR_MATERIAL },
          });
      }
      return;
    }

    if (activeTool === "furniture") {
      if (placingCatalogId && placingWallMount) {
        // Wall-attach placement (like the window/door tools).
        const wall = wallUnderCursor(world);
        if (wall) {
          const t = projectPointToWallT(wall, world);
          store.addWallMount(wall.id, {
            catalogId: placingCatalogId,
            t,
            heightUpWall: placingEntry?.defaultMountHeight ?? DEFAULT_MOUNT_HEIGHT,
            face: sideOf(wall, world),
            scale: { ...UNIT_SCALE },
            materials: {},
          });
        }
        // tool stays active for repeat placement
      } else if (placingCatalogId && placingCeiling) {
        // Ceiling-light placement (plan X/Z, grid-snapped, default drop).
        store.addCeilingLight(placingCatalogId, snapToGrid(world));
        // tool stays active for repeat placement
      } else if (placingCatalogId) {
        const placed = resolveFurniturePlacement(
          placingCatalogId,
          world,
          ghostRotation,
          UNIT_SCALE,
          !manualRotateRef.current,
        );
        store.placeFurniture(
          placingCatalogId,
          placed.pos,
          placed.rotation,
          placingVariant,
        );
        // tool stays active for repeat placement
      }
      return;
    }

    if (activeTool === "stair") {
      const placed = resolveStairPlacement(
        world,
        ghostRotation,
        !manualRotateRef.current,
      );
      store.placeStaircase(placed.pos, placed.rotation);
      // tool stays active for repeat placement
      return;
    }

    if (activeTool === "roof") {
      if (roofMode === "auto") {
        // Click inside an enclosed room → generate ONE polygon roof fitted to
        // its true footprint (incl. L/T/U). Non-rectilinear (angled) rooms still
        // generate via a bounding-rect fallback for gabled/hipped, with a clear
        // best-fit message steering the user to Flat/Pitched.
        const res = store.addRoofAuto(world);
        const msg = !res.generated
          ? "Area isn't fully enclosed — roof not generated"
          : !res.rectilinear
            ? "Angled walls can't get a gabled/hipped roof yet — using a best-fit; try Flat or Pitched for exact coverage."
            : null;
        setFillMessage(msg);
        if (msg) window.setTimeout(() => setFillMessage(null), 3500);
        return;
      }
      // Draw mode: drag a rectangle (grid-snapped corners) to define the roof.
      const pt = snapToGrid(world);
      dragRef.current = {
        kind: "roofDraw",
        pointerId: e.pointerId,
        startScreen: screen,
      };
      setRoofRect({ start: pt, end: pt });
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "fill") {
      const ok = store.fillRoom(world, fillTarget);
      setFillMessage(ok ? null : "Room isn't fully enclosed");
      if (!ok) window.setTimeout(() => setFillMessage(null), 2200);
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

    const mountHit = mountUnderCursor(world);
    if (mountHit) {
      store.setSelection({
        kind: "wallMount",
        wallId: mountHit.wall.id,
        id: mountHit.mountId,
      });
      dragRef.current = { kind: "none" };
      return;
    }

    const lightHit = ceilingLightUnderCursor(world);
    if (lightHit) {
      store.setSelection({ kind: "ceilingLight", id: lightHit.id });
      dragRef.current = {
        kind: "ceilingLight",
        pointerId: e.pointerId,
        itemId: lightHit.id,
        startScreen: screen,
        startWorld: world,
        basePos: { ...lightHit.position },
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

    const stairHit = stairUnderCursor(world);
    if (stairHit) {
      store.setSelection({ kind: "staircase", id: stairHit.id });
      lastValidFurnRef.current = {
        pos: { ...stairHit.position },
        rotation: stairHit.rotation,
      };
      dragRef.current = {
        kind: "staircase",
        pointerId: e.pointerId,
        itemId: stairHit.id,
        startScreen: screen,
        startWorld: world,
        basePos: { ...stairHit.position },
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

    const roofHit = roofUnderCursor(world);
    if (roofHit) {
      store.setSelection({ kind: "roof", id: roofHit.id });
      dragRef.current = {
        kind: "roof",
        pointerId: e.pointerId,
        itemId: roofHit.id,
        startScreen: screen,
        startWorld: world,
        basePos: { ...roofHit.position },
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
      if (activeTool === "furniture" && placingCatalogId && placingWallMount) {
        const wall = wallUnderCursor(world);
        setMountGhost(
          wall
            ? { wall, t: projectPointToWallT(wall, world), face: sideOf(wall, world) }
            : null,
        );
      } else if (activeTool === "furniture" && placingCatalogId && placingCeiling) {
        setCeilingGhost(snapToGrid(world));
      } else if (activeTool === "furniture" && placingCatalogId) {
        setFurnGhost(
          resolveFurniturePlacement(
            placingCatalogId,
            world,
            ghostRotation,
            UNIT_SCALE,
            !manualRotateRef.current,
          ),
        );
      } else if (activeTool === "stair") {
        setStairGhost(
          resolveStairPlacement(world, ghostRotation, !manualRotateRef.current),
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

    if (d.kind === "roofDraw") {
      const world = clientToWorld(e.clientX, e.clientY);
      const pt = snapToGrid(world);
      setRoofRect((rect) => (rect ? { ...rect, end: pt } : rect));
      return;
    }

    if (
      d.kind === "body" ||
      d.kind === "endpoint" ||
      d.kind === "window" ||
      d.kind === "door" ||
      d.kind === "furniture" ||
      d.kind === "staircase" ||
      d.kind === "ceilingLight" ||
      d.kind === "roof"
    ) {
      const screen = clientToScreen(e.clientX, e.clientY);
      if (!d.started && distance(screen, d.startScreen) < DRAG_THRESHOLD_PX)
        return;
      if (!d.started) {
        store.beginDrag();
        d.started = true;
      }
      const world = clientToWorld(e.clientX, e.clientY);
      if (d.kind === "roof") {
        const pos = snapToGrid(add(d.basePos, sub(world, d.startWorld)));
        store.moveRoof(d.itemId, pos);
      } else if (d.kind === "ceilingLight") {
        const pos = snapToGrid(add(d.basePos, sub(world, d.startWorld)));
        store.moveCeilingLight(d.itemId, pos);
      } else if (d.kind === "staircase") {
        const stair = staircases.find((x) => x.id === d.itemId);
        if (stair) {
          // Dragging keeps the stair's rotation (manual rotation wins) and only
          // snaps position flush to a wall when the toggle is on.
          const raw = add(d.basePos, sub(world, d.startWorld));
          const placed = resolveStairPlacement(
            raw,
            stair.rotation,
            false,
            stair.width,
            stairFootprint(stair).depth,
          );
          store.moveStaircase(d.itemId, placed.pos, placed.rotation);
          if (
            collisionMode === "hard" &&
            !overlapsCollidable(
              stairCandidate(
                d.itemId,
                placed.pos,
                placed.rotation,
                stairFootprint(stair),
              ),
              d.itemId,
            )
          ) {
            lastValidFurnRef.current = { pos: placed.pos, rotation: placed.rotation };
          }
        }
      } else if (d.kind === "furniture") {
        const item = furniture.find((f) => f.id === d.itemId);
        if (item) {
          // Dragging keeps the item's rotation (manual rotation wins) and only
          // snaps position flush to a wall when the toggle is on.
          const raw = add(d.basePos, sub(world, d.startWorld));
          const placed = resolveFurniturePlacement(
            item.catalogId,
            raw,
            item.rotation,
            item.scale,
            false,
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
    if (d.kind === "staircase" && d.started && collisionMode === "hard") {
      const stair = selectCurrentLevel(useStore.getState()).staircases.find(
        (x) => x.id === d.itemId,
      );
      if (
        stair &&
        overlapsCollidable(
          stairCandidate(
            d.itemId,
            stair.position,
            stair.rotation,
            stairFootprint(stair),
          ),
          d.itemId,
        )
      ) {
        const target = lastValidFurnRef.current ?? {
          pos: d.basePos,
          rotation: stair.rotation,
        };
        useStore.getState().moveStaircase(d.itemId, target.pos, target.rotation);
      }
    }
    if (
      (d.kind === "body" ||
        d.kind === "endpoint" ||
        d.kind === "window" ||
        d.kind === "door" ||
        d.kind === "furniture" ||
        d.kind === "staircase" ||
        d.kind === "ceilingLight" ||
        d.kind === "roof") &&
      d.started
    ) {
      useStore.getState().endDrag();
    }
    if (d.kind === "room") {
      if (roomRect) useStore.getState().addRoom(roomRect.start, roomRect.end);
      setRoomRect(null);
    }
    if (d.kind === "roofDraw") {
      // Create a roof centered on the dragged rect (zero-area drags ignored).
      if (roofRect) {
        const w = Math.abs(roofRect.end.x - roofRect.start.x);
        const h = Math.abs(roofRect.end.y - roofRect.start.y);
        if (w > 1e-6 && h > 1e-6) {
          const center = {
            x: (roofRect.start.x + roofRect.end.x) / 2,
            y: (roofRect.start.y + roofRect.end.y) / 2,
          };
          useStore.getState().addRoof(center, w, h);
        }
      }
      setRoofRect(null);
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
          data-plan-content
          transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.scale})`}
        >
          {/* Work-area (site): de-emphasize outside, shade the buildable rect. */}
          <SiteLayer site={site} view={view} size={size} />

          {/* Ghost underlay of the level below (non-interactive reference). */}
          {showUnderlay && belowLevel && <UnderlayLayer level={belowLevel} />}

          {/* "Open below" stairwell voids from the level below's staircases. */}
          {belowLevel?.staircases.map((s) => (
            <polygon
              key={s.id}
              className="stair-void"
              points={toPoints(
                computeStair(
                  s,
                  belowLevel.wallHeight + FLOOR_SLAB_THICKNESS,
                ).opening,
              )}
            />
          ))}

          {/* Floors beneath everything, with stairwell openings cut as holes. */}
          {floors.map((f) => {
            const holes = floorHoles(belowOpenings, f.polygon);
            return (
              <path
                key={f.id}
                className={`floor${selection?.kind === "floor" && selection.id === f.id ? " selected" : ""}`}
                d={floorPathD(f.polygon, holes)}
                fillRule="evenodd"
                fill={fillFor(f.material)}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

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
                variant={item.variant}
                materials={item.materials}
                className={`furn${
                  selection?.kind === "furniture" && selection.id === item.id
                    ? " selected"
                    : ""
                }${collisionSet.has(item.id) ? " warn" : ""}`}
              />
            ))}

          {/* Staircases on the active (lower) level. */}
          {staircases.map((s) => {
            const g = computeStair(s, storeyHeight);
            return (
              <StairSymbol
                key={s.id}
                stair={s}
                run={g.runLength}
                steps={g.steps}
                className={`stair${
                  selection?.kind === "staircase" && selection.id === s.id
                    ? " selected"
                    : ""
                }${collisionSet.has(s.id) ? " warn" : ""}`}
              />
            );
          })}

          {/* Ceiling lights (markers; hang from this level's ceiling). */}
          {ceilingLights.map((light) => {
            const entry = getCatalogEntry(light.catalogId);
            if (!entry) return null;
            return (
              <CeilingLightSymbol
                key={light.id}
                position={light.position}
                entry={entry}
                scale={light.scale}
                selected={
                  selection?.kind === "ceilingLight" &&
                  selection.id === light.id
                }
              />
            );
          })}

          {/* Walls, broken at window openings. */}
          {walls.map((w) => {
            const isSel = selection?.kind === "wall" && selection.id === w.id;
            return (
              <g key={w.id}>
                {wallPlanSegments(w).map((seg, i) => (
                  <g key={i}>
                    {/* Each side filled with its own paint (A and B halves). */}
                    <polygon
                      className="wall-paint"
                      points={toPoints(spanHalfCorners(w, seg.a, seg.b, "A"))}
                      fill={fillFor(w.paintA)}
                    />
                    <polygon
                      className="wall-paint"
                      points={toPoints(spanHalfCorners(w, seg.a, seg.b, "B"))}
                      fill={fillFor(w.paintB)}
                    />
                    <polygon
                      className={`wall-edge${isSel ? " selected" : ""}`}
                      points={toPoints(spanCorners(w, seg.a, seg.b))}
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
                {w.windows.map((win) => (
                  <WindowSymbol
                    key={win.id}
                    wall={w}
                    t={win.t}
                    width={win.width}
                    style={win.style}
                    muntinColor={representativeColor(win.muntinMaterial)}
                    selected={
                      selection?.kind === "window" && selection.id === win.id
                    }
                    warn={openingOverlapSet.has(win.id)}
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
                    warn={openingOverlapSet.has(door.id)}
                  />
                ))}
                {w.mounts.map((m) => {
                  const entry = getCatalogEntry(m.catalogId);
                  if (!entry) return null;
                  return (
                    <WallMountSymbol
                      key={m.id}
                      wall={w}
                      t={m.t}
                      face={m.face}
                      entry={entry}
                      scale={m.scale}
                      materials={m.materials}
                      selected={
                        selection?.kind === "wallMount" && selection.id === m.id
                      }
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Roof footprints (outline + ridge line), selectable. */}
          {roofs.map((r) => (
            <RoofSymbol
              key={r.id}
              roof={r}
              selected={selection?.kind === "roof" && selection.id === r.id}
            />
          ))}

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
                  variant={placingVariant ?? undefined}
                  materials={{}}
                  className={`furn furn-ghost${warn ? " warn" : ""}`}
                />
              ) : null;
            })()}

          {/* Wall-mount placement ghost. */}
          {activeTool === "furniture" &&
            placingWallMount &&
            mountGhost &&
            placingEntry && (
              <WallMountSymbol
                wall={mountGhost.wall}
                t={mountGhost.t}
                face={mountGhost.face}
                entry={placingEntry}
                scale={UNIT_SCALE}
                materials={{}}
                ghost
              />
            )}

          {/* Ceiling-light placement ghost. */}
          {activeTool === "furniture" &&
            placingCeiling &&
            ceilingGhost &&
            placingEntry && (
              <CeilingLightSymbol
                position={ceilingGhost}
                entry={placingEntry}
                scale={UNIT_SCALE}
                ghost
              />
            )}

          {/* Staircase placement ghost. */}
          {activeTool === "stair" &&
            stairGhost &&
            (() => {
              const ghost: Staircase = {
                id: "ghost",
                position: stairGhost.pos,
                rotation: stairGhost.rotation,
                width: DEFAULT_STAIR_WIDTH,
                material: { kind: "solid", color: "#8a6d4b" },
              };
              const g = computeStair(ghost, storeyHeight);
              const warn =
                collisionMode === "hard" &&
                overlapsCollidable(
                  stairCandidate("ghost", ghost.position, ghost.rotation, {
                    width: ghost.width,
                    depth: g.runLength,
                  }),
                  "ghost",
                );
              return (
                <StairSymbol
                  stair={ghost}
                  run={g.runLength}
                  steps={g.steps}
                  className={`stair stair-ghost${warn ? " warn" : ""}`}
                />
              );
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

          {/* Roof tool drag preview. */}
          {roofRect && (
            <rect
              className="roof-preview"
              x={Math.min(roofRect.start.x, roofRect.end.x)}
              y={Math.min(roofRect.start.y, roofRect.end.y)}
              width={Math.abs(roofRect.end.x - roofRect.start.x)}
              height={Math.abs(roofRect.end.y - roofRect.start.y)}
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

        {/* Auto wall-length dimensions (screen space, always legible). */}
        {showDimensions && (
          <DimensionLabels walls={walls} worldToScreen={worldToScreen} />
        )}

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

        {/* Roof tool width × depth labels (screen space). */}
        {roofRect &&
          (() => {
            const w = Math.abs(roofRect.end.x - roofRect.start.x);
            const d = Math.abs(roofRect.end.y - roofRect.start.y);
            const cx = (roofRect.start.x + roofRect.end.x) / 2;
            const top = worldToScreen({
              x: cx,
              y: Math.min(roofRect.start.y, roofRect.end.y),
            });
            const cy = (roofRect.start.y + roofRect.end.y) / 2;
            const leftEdge = worldToScreen({
              x: Math.min(roofRect.start.x, roofRect.end.x),
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

      {/* Empty-state nudge: shown whenever the active level has no walls (the
          primary "nothing to see" case). Non-interactive, centered, and it
          reappears if the user deletes everything. */}
      {walls.length === 0 && (
        <div className="plan-empty-hint" aria-hidden="true">
          Draw a wall to begin
        </div>
      )}

      <div className="plan-controls">
        <div className="floors-menu">
          <button
            type="button"
            className={`plan-control-button${floorsOpen ? " active" : ""}`}
            aria-expanded={floorsOpen}
            title="Manage floors / levels"
            onClick={() => setFloorsOpen((v) => !v)}
          >
            Floors ▾
          </button>
          {floorsOpen && (
            <div className="floors-dropdown">
              <LevelsPanel onSelectLevel={() => setFloorsOpen(false)} />
            </div>
          )}
        </div>
        <button
          type="button"
          className={`plan-control-button${showDimensions ? " active" : ""}`}
          aria-pressed={showDimensions}
          title="Show a length label on every wall"
          onClick={() => setShowDimensions(!showDimensions)}
        >
          Dimensions
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

      {fillMessage && <div className="fill-message">{fillMessage}</div>}
      {mergeNotice && <div className="fill-message">{mergeNotice}</div>}
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
    case "stair":
      return "Click to place a staircase · R / Shift+R rotates · ascends to the floor above";
    case "roof":
      return "Drag a rectangle to place a roof · select it to edit type, pitch & size · Esc cancels";
    case "fill":
      return "Click inside an enclosed room to fill its floor / walls with the current material";
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
  style = "picture",
  muntinColor,
  selected,
  ghost,
  warn,
}: {
  wall: Wall;
  t: number;
  width: number;
  style?: "grid" | "divided" | "picture";
  muntinColor?: string;
  selected?: boolean;
  ghost?: "valid" | "invalid";
  warn?: boolean;
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
    : `window-symbol${selected ? " selected" : ""}${warn ? " warn" : ""}`;
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
  // Plan hint for the vertical glazing bar(s): divided/grid both carry a central
  // mullion (the horizontal bars of a grid aren't visible top-down). Draw it as a
  // tick across the opening thickness at the window center.
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const hasMullion = style === "divided" || style === "grid";
  return (
    <g className={cls}>
      {seg(add(A, o), add(B, o), "fa")}
      {seg(sub(A, o), sub(B, o), "fb")}
      {seg(A, B, "c")}
      {seg(add(A, o), sub(A, o), "ja")}
      {seg(add(B, o), sub(B, o), "jb")}
      {hasMullion && (
        <line
          className="window-mullion"
          x1={add(mid, o).x}
          y1={add(mid, o).y}
          x2={sub(mid, o).x}
          y2={sub(mid, o).y}
          stroke={muntinColor}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

// Plan marker for a wall-mounted item: the item's oriented footprint rectangle
// (width along the wall × protrusion) sitting just off the chosen wall face,
// filled with its primary slot color, plus a tick joining it to the face. The
// height up the wall isn't visible top-down, so only position/side are shown.
function WallMountSymbol({
  wall,
  t,
  face,
  entry,
  scale,
  materials,
  selected,
  ghost,
}: {
  wall: Wall;
  t: number;
  face: WallSide;
  entry: CatalogEntry;
  scale: Vec3;
  materials: Record<string, MaterialRef>;
  selected?: boolean;
  ghost?: boolean;
}) {
  if (wallLength(wall) === 0) return null;
  const dims = effectiveDimensions(entry, scale);
  const fp = wallMountPlanFootprint(wall, t, face, dims.width, dims.depth);
  const corners = footprintCorners(fp.center, fp.rotation, fp.footprint);
  const primary = entry.slots[0]!;
  const fill = representativeColor(materials[primary.name] ?? primary.default);
  const cls = ghost
    ? "wall-mount-symbol ghost"
    : `wall-mount-symbol${selected ? " selected" : ""}`;
  return (
    <g className={cls}>
      <polygon
        className="wall-mount-rect"
        points={toPoints(corners)}
        fill={fill}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        className="wall-mount-dot"
        cx={fp.center.x}
        cy={fp.center.y}
        r={0.05}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

// Plan marker for a ceiling light: a small circle with a cross at its position
// (its drop/height aren't visible top-down). Selectable; also used as the ghost.
function CeilingLightSymbol({
  position,
  entry,
  scale,
  selected,
  ghost,
}: {
  position: Vec2;
  entry: CatalogEntry;
  scale: Vec3;
  selected?: boolean;
  ghost?: boolean;
}) {
  const d = effectiveDimensions(entry, scale);
  const r = Math.max(0.1, Math.min(d.width, d.depth) / 2);
  const cls = ghost
    ? "ceiling-light-symbol ghost"
    : `ceiling-light-symbol${selected ? " selected" : ""}`;
  const ns = { vectorEffect: "non-scaling-stroke" as const };
  return (
    <g
      className={cls}
      transform={`translate(${position.x} ${position.y})`}
    >
      <circle cx={0} cy={0} r={r} fill="none" {...ns} />
      <line x1={-r} y1={0} x2={r} y2={0} {...ns} />
      <line x1={0} y1={-r} x2={0} y2={r} {...ns} />
    </g>
  );
}

// One swinging leaf + quarter-circle arc (the standard architectural symbol),
// used directly for single doors and twice (mirrored) for double doors.
function SwingLeaf({
  wall,
  door,
}: {
  wall: Wall;
  door: { t: number; width: number; hinge: "start" | "end"; swing: "A" | "B" };
}) {
  const { hinge, jamb, leafEnd, sweepFlag, radius } = doorSymbol(wall, door);
  return (
    <>
      <line
        className="door-leaf"
        x1={hinge.x}
        y1={hinge.y}
        x2={leafEnd.x}
        y2={leafEnd.y}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="door-arc"
        d={`M ${jamb.x} ${jamb.y} A ${radius} ${radius} 0 0 ${sweepFlag} ${leafEnd.x} ${leafEnd.y}`}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

// Door plan symbol, by style. single = jamb ticks + open leaf + swing arc;
// double = two mirrored half-leaves hinged at opposite jambs; sliding = a track
// line across the opening with the panel parked to one side (no arc). hinge/swing
// are ignored for sliding.
function DoorSymbolShape({
  wall,
  door,
  selected,
  ghost,
  warn,
}: {
  wall: Wall;
  door: {
    t: number;
    width: number;
    hinge: "start" | "end";
    swing: "A" | "B";
    style?: "single" | "double" | "sliding";
  };
  selected?: boolean;
  ghost?: "valid" | "invalid";
  warn?: boolean;
}) {
  const L = wallLength(wall);
  if (L === 0) return null;
  const style = door.style ?? "single";
  const dir = wallDirection(wall);
  const n = vscale(wallNormal(wall), wall.thickness / 2);
  const { a, b } = windowSpan(L, door.t, door.width);
  const cls = ghost
    ? `door-symbol ghost-${ghost}`
    : `door-symbol${selected ? " selected" : ""}${warn ? " warn" : ""}`;

  // Jamb tick across the wall thickness at along-wall distance `s`.
  const jambTick = (s: number, key: string) => {
    const p = add(wall.start, vscale(dir, s));
    return (
      <line
        key={key}
        x1={add(p, n).x}
        y1={add(p, n).y}
        x2={sub(p, n).x}
        y2={sub(p, n).y}
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  if (style === "sliding") {
    // Track line across the opening (extended toward the parked panel) and the
    // panel rectangle parked on side A, slid toward the wall start.
    const panelStart = Math.max(0, a - door.width);
    const trackEnd = Math.min(L, a + door.width);
    const tA = add(wall.start, vscale(dir, panelStart));
    const tB = add(wall.start, vscale(dir, trackEnd));
    const off1 = wall.thickness / 2;
    const off2 = off1 + 0.06;
    const corner = (s: number, off: number) =>
      add(add(wall.start, vscale(dir, s)), vscale(wallNormal(wall), off));
    const panelPts = [
      corner(panelStart, off1),
      corner(a, off1),
      corner(a, off2),
      corner(panelStart, off2),
    ];
    return (
      <g className={cls}>
        {jambTick(a, "ja")}
        {jambTick(b, "jb")}
        <line
          className="door-track"
          x1={tA.x}
          y1={tA.y}
          x2={tB.x}
          y2={tB.y}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          className="door-panel"
          points={toPoints(panelPts)}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    );
  }

  if (style === "double") {
    const mid = (a + b) / 2;
    const half = door.width / 2;
    // Start leaf occupies [a, mid] hinged at a; end leaf [mid, b] hinged at b.
    const startLeaf = {
      t: (a + mid) / 2 / L,
      width: half,
      hinge: "start" as const,
      swing: door.swing,
    };
    const endLeaf = {
      t: (mid + b) / 2 / L,
      width: half,
      hinge: "end" as const,
      swing: door.swing,
    };
    return (
      <g className={cls}>
        {jambTick(a, "ja")}
        {jambTick(b, "jb")}
        <SwingLeaf wall={wall} door={startLeaf} />
        <SwingLeaf wall={wall} door={endLeaf} />
      </g>
    );
  }

  // single
  return (
    <g className={cls}>
      {jambTick(a, "ja")}
      {jambTick(b, "jb")}
      <SwingLeaf wall={wall} door={door} />
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

// Plan symbol for a staircase: footprint outline, parallel tread lines across the
// width, and an arrow pointing in the ascent (up) direction (local +y).
function StairSymbol({
  stair,
  run,
  steps,
  className,
}: {
  stair: Staircase;
  run: number;
  steps: number;
  className: string;
}) {
  const w = stair.width;
  const half = run / 2;
  const ns = { vectorEffect: "non-scaling-stroke" as const };
  const treads = [];
  for (let k = 1; k < steps; k++) {
    const y = -half + (k * run) / steps;
    treads.push(
      <line key={k} x1={-w / 2} y1={y} x2={w / 2} y2={y} {...ns} />,
    );
  }
  return (
    <g
      className={className}
      transform={`translate(${stair.position.x} ${stair.position.y}) rotate(${stair.rotation})`}
    >
      <rect
        className="stair-outline"
        x={-w / 2}
        y={-half}
        width={w}
        height={run}
        {...ns}
      />
      <g className="stair-treads">{treads}</g>
      <line
        className="stair-arrow"
        x1={0}
        y1={-half * 0.6}
        x2={0}
        y2={half * 0.6}
        {...ns}
      />
      <polyline
        className="stair-arrow"
        points={`${-w * 0.14},${half * 0.4} 0,${half * 0.6} ${w * 0.14},${half * 0.4}`}
        fill="none"
        {...ns}
      />
    </g>
  );
}

// Plan symbol for a manually placed roof: its rotated footprint rectangle plus a
// faint ridge line indicating orientation (along the longer axis, like the 3D
// ridge; omitted for flat roofs which have no ridge). Selectable.
function RoofSymbol({ roof, selected }: { roof: Roof; selected: boolean }) {
  const ns = { vectorEffect: "non-scaling-stroke" as const };
  // Polygon (auto) roof: draw the static footprint outline + a faint ridge hint
  // per decomposed rectangle (gabled/hipped only). Footprint is in plan coords.
  if (roof.shape === "polygon" && roof.footprint && roof.footprint.length >= 3) {
    const fp = roof.footprint;
    const pts = fp.map((p) => `${p.x},${p.y}`).join(" ");
    const sloped = roof.type === "gabled" || roof.type === "hipped";
    const ridges =
      sloped && isRectilinear(fp)
        ? decomposeRectilinear(fp).map((b) => {
            const w = b.maxX - b.minX;
            const d = b.maxY - b.minY;
            return w >= d
              ? { x1: b.minX, y1: (b.minY + b.maxY) / 2, x2: b.maxX, y2: (b.minY + b.maxY) / 2 }
              : { x1: (b.minX + b.maxX) / 2, y1: b.minY, x2: (b.minX + b.maxX) / 2, y2: b.maxY };
          })
        : [];
    return (
      <g className={`roof-symbol${selected ? " selected" : ""}`}>
        <polygon className="roof-outline" points={pts} fill="none" {...ns} />
        {ridges.map((r, i) => (
          <line key={i} className="roof-ridge" {...r} {...ns} />
        ))}
      </g>
    );
  }

  const hw = roof.width / 2;
  const hd = roof.depth / 2;
  // Ridge runs along the longer axis (matches computeRoof). Local +x is width.
  const alongX = roof.width >= roof.depth;
  const ridge =
    roof.type === "flat" ? null : alongX
      ? { x1: -hw, y1: 0, x2: hw, y2: 0 }
      : { x1: 0, y1: -hd, x2: 0, y2: hd };
  return (
    <g
      className={`roof-symbol${selected ? " selected" : ""}`}
      transform={`translate(${roof.position.x} ${roof.position.y}) rotate(${roof.rotation})`}
    >
      <rect
        className="roof-outline"
        x={-hw}
        y={-hd}
        width={roof.width}
        height={roof.depth}
        fill="none"
        {...ns}
      />
      {ridge && <line className="roof-ridge" {...ridge} {...ns} />}
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

// Persistent length labels on every wall (Phase 5c). Rendered in screen space so
// the font stays a constant size at any zoom; each label is rotated to run along
// its wall and flipped when it would read upside-down, and offset slightly off
// the wall. Walls too short on screen to fit the text are skipped (de-clutter).
function DimensionLabels({
  walls,
  worldToScreen,
}: {
  walls: Wall[];
  worldToScreen: (p: Vec2) => Vec2;
}) {
  const OFFSET_PX = 12;
  const MIN_SCREEN_LEN = 30;
  return (
    <g className="dim-labels">
      {walls.map((w) => {
        const a = worldToScreen(w.start);
        const b = worldToScreen(w.end);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < MIN_SCREEN_LEN) return null;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        else if (angle < -90) angle += 180;
        // Offset perpendicular to the (un-flipped) wall direction, one side.
        const nx = -dy / len;
        const ny = dx / len;
        const mx = (a.x + b.x) / 2 + nx * OFFSET_PX;
        const my = (a.y + b.y) / 2 + ny * OFFSET_PX;
        const text = formatMeters(wallLength(w));
        return (
          <g
            key={w.id}
            className="dim-label"
            transform={`translate(${mx} ${my}) rotate(${angle})`}
          >
            <rect
              x={-text.length * 3.4 - 4}
              y={-8}
              width={text.length * 6.8 + 8}
              height={15}
              rx={3}
            />
            <text x={0} y={3} textAnchor="middle">
              {text}
            </text>
          </g>
        );
      })}
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
