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
} from "./types";
import { DEFAULT_SITE } from "./site";

// Defaults from CLAUDE.md "Coordinate system & units".
export const DEFAULT_WALL_HEIGHT = 2.4;
export const DEFAULT_WALL_THICKNESS = 0.15;
export const DEFAULT_WINDOW_WIDTH = 1.2;
export const DEFAULT_WINDOW_HEIGHT = 1.2;
export const DEFAULT_WINDOW_SILL_HEIGHT = 0.9;
export const DEFAULT_DOOR_WIDTH = 0.9;
export const DEFAULT_DOOR_HEIGHT = 2.0;

// Thickness of a level's floor slab (meters). A level's walking surface is at its
// elevation; the slab occupies [elevation - thickness, elevation] and doubles as
// the ceiling of the level below.
export const FLOOR_SLAB_THICKNESS = 0.2;

// Staircase defaults + comfortable step geometry (meters).
export const DEFAULT_STAIR_WIDTH = 1.0;
export const STAIR_RISER_TARGET = 0.18; // target step rise; actual fits the storey
export const STAIR_TREAD_DEPTH = 0.25; // going per step
export const DEFAULT_STAIR_MATERIAL: MaterialRef = {
  kind: "solid",
  color: "#8a6d4b",
};

// Default door leaf material (a warm wood tone).
export const DEFAULT_DOOR_MATERIAL: MaterialRef = {
  kind: "solid",
  color: "#9a6b4f",
};

export const GRID_SNAP = 0.1; // meters
export const ENDPOINT_SNAP_RADIUS = 0.15; // meters; endpoint snap takes priority

// New walls get this paint on both sides.
export const DEFAULT_PAINT: MaterialRef = { kind: "solid", color: "#e8e4dc" };

// Starting "current material" for the paint and floor tools (a warm wood tone).
export const DEFAULT_MATERIAL: MaterialRef = {
  kind: "solid",
  color: "#b9966b",
};

// Reasonably unique id without extra deps.
export function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createWall(
  start: Wall["start"],
  end: Wall["end"],
  opts?: Partial<Pick<Wall, "height" | "thickness">>,
): Wall {
  return {
    id: makeId("wall"),
    start,
    end,
    height: opts?.height ?? DEFAULT_WALL_HEIGHT,
    thickness: opts?.thickness ?? DEFAULT_WALL_THICKNESS,
    paintA: { ...DEFAULT_PAINT },
    paintB: { ...DEFAULT_PAINT },
    windows: [],
    doors: [],
    mounts: [],
  };
}

// Default vertical center (meters) for a wall mount whose catalog entry omits
// `defaultMountHeight`. Roughly eye level.
export const DEFAULT_MOUNT_HEIGHT = 1.5;

export function createWallMount(
  catalogId: string,
  opts?: Partial<Omit<WallMount, "id" | "catalogId">>,
): WallMount {
  return {
    id: makeId("mount"),
    catalogId,
    t: opts?.t ?? 0.5,
    heightUpWall: opts?.heightUpWall ?? DEFAULT_MOUNT_HEIGHT,
    face: opts?.face ?? "A",
    scale: opts?.scale ? { ...opts.scale } : { x: 1, y: 1, z: 1 },
    materials: { ...(opts?.materials ?? {}) },
  };
}

export function createDoor(
  opts?: Partial<Omit<DoorOpening, "id">>,
): DoorOpening {
  return {
    id: makeId("door"),
    t: opts?.t ?? 0.5,
    width: opts?.width ?? DEFAULT_DOOR_WIDTH,
    height: opts?.height ?? DEFAULT_DOOR_HEIGHT,
    style: opts?.style ?? "single",
    hinge: opts?.hinge ?? "start",
    swing: opts?.swing ?? "A",
    material: opts?.material
      ? { ...opts.material }
      : { ...DEFAULT_DOOR_MATERIAL },
  };
}

export function createWindow(
  opts?: Partial<Omit<WindowOpening, "id">>,
): WindowOpening {
  return {
    id: makeId("win"),
    t: opts?.t ?? 0.5,
    width: opts?.width ?? DEFAULT_WINDOW_WIDTH,
    height: opts?.height ?? DEFAULT_WINDOW_HEIGHT,
    sillHeight: opts?.sillHeight ?? DEFAULT_WINDOW_SILL_HEIGHT,
    style: opts?.style ?? "plain",
  };
}

export function createFloor(
  polygon: Vec2[],
  material: MaterialRef,
): FloorRegion {
  return {
    id: makeId("floor"),
    polygon,
    material: { ...material },
  };
}

export function createFurniture(
  catalogId: string,
  position: Vec2,
  opts?: {
    rotation?: number;
    scale?: Vec3;
    variant?: string;
    materials?: Record<string, MaterialRef>;
  },
): FurnitureItem {
  return {
    id: makeId("furn"),
    catalogId,
    position: { ...position },
    rotation: opts?.rotation ?? 0,
    scale: opts?.scale ? { ...opts.scale } : { x: 1, y: 1, z: 1 },
    ...(opts?.variant ? { variant: opts.variant } : {}),
    materials: { ...(opts?.materials ?? {}) },
  };
}

// Default drop (meters) for a ceiling light whose catalog entry omits `defaultDrop`.
export const DEFAULT_CEILING_DROP = 0.5;

export function createCeilingLight(
  catalogId: string,
  position: Vec2,
  opts?: Partial<Omit<CeilingLight, "id" | "catalogId" | "position">>,
): CeilingLight {
  return {
    id: makeId("light"),
    catalogId,
    position: { ...position },
    drop: opts?.drop ?? DEFAULT_CEILING_DROP,
    scale: opts?.scale ? { ...opts.scale } : { x: 1, y: 1, z: 1 },
    materials: { ...(opts?.materials ?? {}) },
  };
}

export function createStaircase(
  position: Vec2,
  opts?: { rotation?: number; width?: number; material?: MaterialRef },
): Staircase {
  return {
    id: makeId("stair"),
    position: { ...position },
    rotation: opts?.rotation ?? 0,
    width: opts?.width ?? DEFAULT_STAIR_WIDTH,
    material: opts?.material
      ? { ...opts.material }
      : { ...DEFAULT_STAIR_MATERIAL },
  };
}

export function createLevel(name = "First floor"): Level {
  return {
    id: makeId("level"),
    name,
    elevation: 0,
    wallHeight: DEFAULT_WALL_HEIGHT,
    walls: [],
    floors: [],
    furniture: [],
    staircases: [],
    ceilingLights: [],
    roofs: [],
  };
}

// Default roof settings (Phase 5.2): a gentle gable in a muted roof-tile tone.
// A newly dragged roof rectangle gets these defaults.
export const DEFAULT_ROOF: Omit<Roof, "id" | "position" | "width" | "depth"> = {
  rotation: 0,
  type: "gabled",
  pitch: 30,
  overhang: 0.4,
  visible: true,
  material: { kind: "solid", color: "#8a5a44" },
};

export function createRoof(
  position: Vec2,
  width: number,
  depth: number,
  opts?: Partial<Omit<Roof, "id" | "position" | "width" | "depth">>,
): Roof {
  return {
    id: makeId("roof"),
    position: { ...position },
    width,
    depth,
    rotation: opts?.rotation ?? DEFAULT_ROOF.rotation,
    type: opts?.type ?? DEFAULT_ROOF.type,
    pitch: opts?.pitch ?? DEFAULT_ROOF.pitch,
    overhang: opts?.overhang ?? DEFAULT_ROOF.overhang,
    visible: opts?.visible ?? DEFAULT_ROOF.visible,
    material: opts?.material ? { ...opts.material } : { ...DEFAULT_ROOF.material },
  };
}

export function createDesign(
  name = "Untitled design",
  site: Site = DEFAULT_SITE,
): Design {
  return {
    schemaVersion: 14,
    name,
    site: { width: site.width, depth: site.depth },
    levels: [createLevel()],
  };
}
