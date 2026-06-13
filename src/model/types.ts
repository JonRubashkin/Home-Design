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

export interface Level {
  id: string;
  name: string; // "Ground floor"
  elevation: number; // world Y of this level's floor, meters. 0 for level 0.
  wallHeight: number; // default height for new walls on this level (2.4)
  walls: Wall[];
  floors: FloorRegion[];
}

export interface Design {
  schemaVersion: 2;
  name: string;
  // Phase 1 uses exactly one level; structure is multi-level NOW so storeys can
  // be added without migration. Never hardcode levels[0] outside the current-level
  // selector.
  levels: Level[];
}
