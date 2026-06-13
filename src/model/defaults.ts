import type {
  Design,
  DoorOpening,
  FloorRegion,
  FurnitureItem,
  Level,
  MaterialRef,
  Vec2,
  Vec3,
  Wall,
  WindowOpening,
} from "./types";

// Defaults from CLAUDE.md "Coordinate system & units".
export const DEFAULT_WALL_HEIGHT = 2.4;
export const DEFAULT_WALL_THICKNESS = 0.15;
export const DEFAULT_WINDOW_WIDTH = 1.2;
export const DEFAULT_WINDOW_HEIGHT = 1.2;
export const DEFAULT_WINDOW_SILL_HEIGHT = 0.9;
export const DEFAULT_DOOR_WIDTH = 0.9;
export const DEFAULT_DOOR_HEIGHT = 2.0;

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
    materials?: Record<string, MaterialRef>;
  },
): FurnitureItem {
  return {
    id: makeId("furn"),
    catalogId,
    position: { ...position },
    rotation: opts?.rotation ?? 0,
    scale: opts?.scale ? { ...opts.scale } : { x: 1, y: 1, z: 1 },
    materials: { ...(opts?.materials ?? {}) },
  };
}

export function createLevel(name = "Ground floor"): Level {
  return {
    id: makeId("level"),
    name,
    elevation: 0,
    wallHeight: DEFAULT_WALL_HEIGHT,
    walls: [],
    floors: [],
    furniture: [],
  };
}

export function createDesign(name = "Untitled design"): Design {
  return {
    schemaVersion: 4,
    name,
    levels: [createLevel()],
  };
}
