// Schema v1 — the persisted design document. Field names are load-bearing: later
// phases (windows, floors, paint, multi-level) depend on them. See CLAUDE.md.

export interface Vec2 {
  x: number;
  y: number;
}

// Interior patterns + landscape surfaces (grass/water/gravel) for outdoor floor
// regions. All are procedural and OPAQUE — water fakes its look with texture, not
// transparency (real transparency would reawaken the cutaway-hiding bug).
export type PatternId =
  | "checker"
  | "planks"
  | "tile"
  | "stripes"
  | "grass"
  | "water"
  | "gravel";

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
  // Phase 6: muntin/frame pattern inside the same opening (cosmetic — the hole
  // size is unchanged). "divided" = one centered vertical glazing bar;
  // "grid"/colonial = a 2x3 grid of bars; "picture" = a large single pane, no
  // divisions. Default "picture" (the single-pane look; pre-v15 "plain" windows
  // migrate to it). The muntin bars (divided/grid) are colored by muntinMaterial.
  style: "grid" | "divided" | "picture";
  muntinMaterial: MaterialRef; // color of the glazing bars (default near-white)
}

export interface DoorOpening {
  id: string;
  t: number; // center along wall, 0..1
  width: number; // meters
  height: number; // meters
  // Phase 6: leaf + plan-symbol style. "single" = one swinging leaf (today's
  // behavior); "double"/French = two leaves meeting at the center; "sliding" =
  // one leaf that slides along the wall (no swing). hinge/swing are only
  // meaningful for single & double; they are ignored for sliding. Default
  // "single" (pre-v13 doors migrate to it).
  style: "single" | "double" | "sliding";
  hinge: "start" | "end"; // hinge side relative to wall start->end direction
  swing: "A" | "B"; // which wall side the door opens toward
  material: MaterialRef;
}

// A wall-mounted item (Phase 4d). Like a window/door it is a CHILD of a wall,
// positioned by `t` along the wall and a height up the wall — so it moves with
// the wall and is deleted with it. References a catalog entry with mount:"wall";
// never geometry. `face` picks which wall side it hangs on.
export interface WallMount {
  id: string;
  catalogId: string;
  t: number; // center along wall, 0..1 (exclusive of ends)
  heightUpWall: number; // meters from floor to the item's vertical CENTER
  face: "A" | "B"; // which wall side it mounts on
  scale: Vec3; // per-axis multipliers, per the entry's scaling policy
  materials: Record<string, MaterialRef>; // overrides keyed by part slot
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
  mounts: WallMount[]; // Phase 4d wall-mounted items
}

export interface FloorRegion {
  id: string;
  polygon: Vec2[]; // grid-snapped, >= 3 points, plan coords
  material: MaterialRef;
}

// A straight staircase, stored on the LOWER level it ascends FROM. It rises to
// the level above and opens a stairwell hole in that level's floor slab.
export interface Staircase {
  id: string;
  position: Vec2; // plan coords of footprint CENTER (on the lower level)
  rotation: number; // degrees; ascent direction; rotates in 15° steps
  width: number; // meters (default 1.0)
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
  // Phase 4c: shape variant id for entries that declare `variants` (e.g. trees,
  // shrubs). Optional/undefined resolves to the entry's default variant — so
  // pre-4c saved items load unchanged. Ignored by entries without variants.
  variant?: string;
  materials: Record<string, MaterialRef>; // overrides keyed by part slot
}

// A ceiling-attached light fixture (Phase 5f). Hangs from THIS level's ceiling
// (its slab/roof above). References a catalog entry with mount:"ceiling"; never
// geometry. Excluded from collision (like wall mounts).
export interface CeilingLight {
  id: string;
  catalogId: string;
  position: Vec2; // plan X/Z
  drop: number; // meters hanging below the ceiling
  scale: Vec3; // per-axis multipliers, per the entry's scaling policy
  materials: Record<string, MaterialRef>; // overrides keyed by part slot
}

// A roof, stored per level — a manual, fully editable object. Roofs never
// auto-update or re-top on wall edits, and never multiply across floors.
//
// Two shapes share this one interface so old saved rectangles are untouched:
//   - "rect" (Phase 5.2, the default; `shape` omitted = rect): the user drags a
//     rectangle, centered on `position`, sized width × depth, oriented by
//     `rotation` (which orients the ridge). An L-shape is two rectangles.
//   - "polygon" (Phase 6.2): an auto-generated roof fitted to a room's TRUE
//     footprint (incl. L/T/U). The footprint polygon is captured at generation
//     (grid-snapped, static) in `footprint`; `width`/`depth`/`rotation` are
//     unused (kept 0) and `position` holds the polygon centroid (the move
//     anchor). Generated once by clicking a room with the Roof tool's Auto mode;
//     editing walls afterward never changes it.
// Both seat at their level's wall-top height when rendered.
export interface Roof {
  id: string;
  shape?: "rect" | "polygon"; // default/omitted = "rect" (back-compat)
  position: Vec2; // rect: rectangle center; polygon: centroid (move anchor)
  width: number; // rect: meters (local X). polygon: unused (0)
  depth: number; // rect: meters (local Z). polygon: unused (0)
  rotation: number; // rect: degrees, 15° steps (orients the ridge). polygon: 0
  footprint?: Vec2[]; // shape === "polygon": the plan-space outline (static)
  type: "flat" | "gabled" | "hipped" | "pitched"; // pitched = single-slope/shed
  pitch: number; // slope in degrees (ignored for flat)
  overhang: number; // meters beyond the footprint (eaves)
  visible: boolean; // per-roof hide toggle (default true)
  material: MaterialRef; // default a roof-tile solid
}

export interface Level {
  id: string;
  name: string; // "Ground floor"
  elevation: number; // world Y of this level's floor, meters. 0 for level 0.
  wallHeight: number; // default height for new walls on this level (2.4)
  walls: Wall[];
  floors: FloorRegion[];
  furniture: FurnitureItem[];
  staircases: Staircase[];
  ceilingLights: CeilingLight[]; // Phase 5f
  roofs: Roof[]; // Phase 5.2: manually placed roof rectangles on this level
}

// The work area ("site"): a soft, buildable rectangle. Never enforced — it frames
// the work, sizes the grid emphasis, and drives camera framing. Occupies plan
// coords [0, width] x [0, depth] with the origin at the TOP-LEFT corner.
export interface Site {
  width: number; // meters
  depth: number; // meters
}

export interface Design {
  schemaVersion: 16;
  name: string;
  site: Site;
  // Phase 1 uses exactly one level; structure is multi-level NOW so storeys can
  // be added without migration. Never hardcode levels[0] outside the current-level
  // selector. Roofs live per-level on each Level.roofs (Phase 5.2 — manual).
  levels: Level[];
}
