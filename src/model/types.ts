// Schema v1 — the persisted design document. Field names are load-bearing: later
// phases (windows, floors, paint, multi-level) depend on them. See CLAUDE.md.

export interface Vec2 {
  x: number;
  y: number;
}

export type PatternId = "checker" | "planks" | "tile" | "stripes";

// Materials are data, never baked into meshes. Reused by future furniture/floor work.
export type MaterialRef =
  | { kind: "solid"; color: string } // hex
  | {
      kind: "pattern";
      pattern: PatternId;
      colorA: string;
      colorB: string;
    };

export interface WindowOpening {
  id: string;
  t: number; // center along wall, 0..1 (exclusive of ends)
  width: number; // meters
  height: number; // meters
  sillHeight: number; // meters from floor to bottom of window
}

export interface DoorOpening {
  id: string;
  t: number; // center along wall, 0..1
  width: number; // meters
  height: number; // meters
  hinge: "start" | "end"; // hinge side relative to wall start->end direction
  swing: "A" | "B"; // which wall side the door opens toward
  material: MaterialRef;
}

export interface Wall {
  id: string;
  start: Vec2; // plan coords, grid-snapped
  end: Vec2;
  height: number; // meters
  thickness: number; // meters
  paintA: MaterialRef; // side A = left of start->end direction
  paintB: MaterialRef; // side B = right of start->end direction
  windows: WindowOpening[];
  doors: DoorOpening[];
}

export interface FloorRegion {
  id: string;
  polygon: Vec2[]; // grid-snapped, >= 3 points, plan coords
  material: MaterialRef;
}

// A placed furniture instance. References a catalog id — never geometry. Slot
// material overrides are keyed by the catalog entry's part-slot names.
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FurnitureItem {
  id: string;
  catalogId: string;
  position: Vec2; // plan coords of footprint CENTER
  rotation: number; // degrees; UI rotates in 15° steps
  scale: Vec3; // per-axis multipliers (x=width, y=height, z=depth), default 1
  materials: Record<string, MaterialRef>; // overrides keyed by part slot
}

export interface Level {
  id: string;
  name: string; // "Ground floor"
  elevation: number; // world Y of this level's floor, meters. 0 for level 0.
  wallHeight: number; // default height for new walls on this level (2.4)
  walls: Wall[];
  floors: FloorRegion[];
  furniture: FurnitureItem[];
}

// The work area ("site"): a soft, buildable rectangle. Never enforced — it frames
// the work, sizes the grid emphasis, and drives camera framing. Occupies plan
// coords [0, width] x [0, depth] with the origin at the TOP-LEFT corner.
export interface Site {
  width: number; // meters
  depth: number; // meters
}

export interface Design {
  schemaVersion: 5;
  name: string;
  site: Site;
  // Phase 1 uses exactly one level; structure is multi-level NOW so storeys can
  // be added without migration. Never hardcode levels[0] outside the current-level
  // selector.
  levels: Level[];
}
