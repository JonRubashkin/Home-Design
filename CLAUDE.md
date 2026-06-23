# CLAUDE.md — Home Design Visualizer

Read this file fully before writing any code. It is the single source of truth for
conventions, the data model, and scope. If a task seems to require violating
something here, stop and ask the user instead of improvising.

## What this project is

A browser-based home design tool. Users draw walls in a **2D plan editor** and see a
live **3D isometric-style preview** (orthographic camera, rotatable). They will add
windows, paint walls, assign floor materials, and later place furniture. Everything
runs client-side. No backend. Deploys to GitHub Pages.

The product is built in phases (see "Phase plan" at the bottom). Never build ahead
of the current phase, but never design the data model in a way that blocks a later
phase.

## Tech stack (fixed — do not substitute)

- **Vite + React + TypeScript** (strict mode)
- **Zustand** for all application state (one store, single source of truth shared by
  the 2D editor and the 3D preview)
- **three + @react-three/fiber + @react-three/drei** for the 3D preview
- **Plain React-rendered SVG** for the 2D plan editor — no canvas, no Konva, no
  pixi. Hit-testing is done with event handlers on SVG elements.
- **Vitest** for unit tests
- No other runtime dependencies without asking the user first. Specifically
  forbidden: CSG / boolean-geometry libraries (see "Geometry rules").

## Coordinate system & units (memorize this)

- All lengths are **meters**, stored as numbers. UI displays meters with cm
  precision (e.g. "3.40 m").
- **Plan space** is 2D: `(x, y)`. +x is right, +y is *down* on screen (SVG
  convention).
- **World space** (Three.js) is Y-up. Mapping: plan `(x, y)` → world `(x, 0, y)`.
  Wall height extrudes along world +Y. Elevation of a level offsets world Y.
- **Grid snap: 0.1 m.** All wall endpoints and floor vertices snap to the grid.
- Defaults: wall height **2.4 m**, wall thickness **0.15 m**, window width
  **1.2 m**, window height **1.2 m**, window sill height **0.9 m**.

All pure math (snapping, distances, wall sub-box computation, plan→world mapping)
lives in `src/geometry/` as pure functions with unit tests. React components and
the store must not contain raw geometry math — they call these functions.

## Data model (schema v1)

This is the persisted design document and the core of the Zustand store. Keep field
names exactly as written; later phases depend on them.

```ts
interface Design {
  schemaVersion: 16;        // v1 = Phase 1; v2 = doors; v3 = furniture;
                            // v4 = furniture scale; v5 = work-area (site);
                            // v6 = staircases; v7 = furniture shape variants;
                            // v8 = wall-mounted items (Phase 4d); v9 = roof
                            // (Phase 5e); v10 = ceiling lights (Phase 5f);
                            // v11 = per-level multi-section auto roofs (Phase
                            // 5.1, removed); v12 = manual roof tool (Phase 5.2 —
                            // the v11 auto roofs are cleared on upgrade); v13 =
                            // door styles (Phase 6 — every door gains
                            // style:"single"); v14 = window styles (Phase 6 —
                            // every window gains style:"plain"); v15 = drop the
                            // "plain" window style (→"picture") + per-window
                            // muntinMaterial (Phase 6 — bar color); v16 =
                            // polygon-footprint roofs (Phase 6.2 — every existing
                            // roof gains shape:"rect"; auto roofs are "polygon").
                            // Migrations in src/model/migrations.ts upgrade
                            // older saved designs.
  name: string;
  site: Site;               // the work-area rectangle (see below)
  levels: Level[];          // Phase 1 uses exactly one level; the structure is
                            // multi-level NOW so storeys can be added without
                            // migration. Never hardcode levels[0] outside of a
                            // single "current level" selector. Roofs live on each
                            // Level.roofs (Phase 5.2 — manual; no top-level
                            // Design.roof).
}

interface Roof {            // Phase 5.2 (rect) + Phase 6.2 (polygon). One union so
  id: string;               // old saved rectangles are untouched.
  shape?: "rect" | "polygon"; // default/omitted = "rect" (back-compat)
  position: Vec2;           // rect: rectangle center. polygon: centroid (the move
                            // anchor). plan coords (grid-snapped)
  width: number;            // rect: meters (local X). polygon: unused (0)
  depth: number;            // rect: meters (local Z). polygon: unused (0)
  rotation: number;         // rect: degrees, 15° steps (orients ridge). polygon: 0
  footprint?: Vec2[];       // shape==="polygon": the plan-space outline, captured
                            // AT GENERATION (grid-snapped, STATIC). No width/depth/
                            // rotation — geometry comes from this.
  type: "flat" | "gabled" | "hipped" | "pitched"; // pitched = shed/single-slope
  pitch: number;            // slope in degrees (ignored for flat)
  overhang: number;         // meters beyond the footprint (eaves)
  visible: boolean;         // per-roof hide toggle (default true)
  material: MaterialRef;    // default a roof-tile solid
}

interface Site {            // SOFT work-area boundary — never enforced.
  width: number;            // meters
  depth: number;            // meters
}
// The site occupies plan coords [0,width] x [0,depth] with the origin at the
// TOP-LEFT corner. It frames the work, de-emphasizes the grid outside itself,
// and drives camera framing — but drawing/placing outside it is always allowed.
// Resizing only changes these numbers; nothing is clamped, moved, or deleted.
// Presets are squares by area (Small 100 m², Medium 300, Large 1000) via the
// pure `areaToSquare(m2)` in src/model/site.ts; custom is width × depth meters.

interface Level {
  id: string;
  name: string;             // "First floor" (American naming; bottom = First floor)
  elevation: number;        // world Y of this level's floor, meters. 0 for level 0.
  wallHeight: number;       // default height for new walls on this level (2.4)
  walls: Wall[];
  floors: FloorRegion[];
  furniture: FurnitureItem[]; // Phase 2b
  staircases: Staircase[];    // Phase 3d
  ceilingLights: CeilingLight[]; // Phase 5f
  roofs: Roof[];              // Phase 5.2: manually placed roof rectangles
}

interface CeilingLight {    // Phase 5f. Hangs from THIS level's ceiling.
  id: string;
  catalogId: string;        // a catalog entry with mount: "ceiling"
  position: Vec2;           // plan X/Z
  drop: number;             // meters hanging below the ceiling
  scale: Vec3;              // per the entry's scaling policy
  materials: Record<string, MaterialRef>;
}

interface FurnitureItem {   // Phase 2b. References a catalog id — never geometry.
  id: string;
  catalogId: string;        // e.g. "sofa-3seat"
  position: Vec2;           // plan coords of footprint CENTER
  rotation: number;         // degrees; UI rotates in 15° steps
  scale: Vec3;              // Phase 2c. per-axis multiplier, default {1,1,1};
                            // clamped to the catalog entry's `scaling` policy.
  variant?: string;         // Phase 4c. shape-variant id for entries that declare
                            // `variants` (trees, shrubs); undefined → the entry's
                            // default variant, so pre-v7 items load unchanged.
  materials: Record<string, MaterialRef>; // overrides keyed by part slot
}

interface Wall {
  id: string;
  start: Vec2;              // plan coords, grid-snapped
  end: Vec2;
  height: number;           // meters
  thickness: number;        // meters
  paintA: MaterialRef;      // side A = left of start→end direction
  paintB: MaterialRef;      // side B = right of start→end direction
  windows: WindowOpening[];
  doors: DoorOpening[];     // Phase 2a
  mounts: WallMount[];      // Phase 4d wall-mounted items
}

interface WallMount {       // Phase 4d. Child of a wall, like a window/door.
  id: string;
  catalogId: string;        // a catalog entry with mount: "wall"
  t: number;                // center along wall, 0..1 (exclusive of ends)
  heightUpWall: number;     // meters from floor to the item's vertical CENTER
  face: "A" | "B";          // which wall side it mounts on
  scale: Vec3;              // per the entry's scaling policy
  materials: Record<string, MaterialRef>;
}
// Moves/deletes with its host wall (parametric, like windows/doors). Excluded
// from furniture collision; never wall-hugs or floor-stacks.

interface WindowOpening {
  id: string;
  t: number;                // center position along wall, 0..1 (exclusive of ends)
  width: number;            // meters
  height: number;           // meters
  sillHeight: number;       // meters from floor to bottom of window
  style: "grid" | "divided" | "picture"; // Phase 6. muntin pattern inside the
                            // SAME opening (cosmetic — hole size unchanged).
                            // default "picture" (single pane, no divisions — the
                            // old "plain" was dropped at v15 and maps here).
                            // divided = one centered VERTICAL bar; grid/colonial
                            // = a 2x3 grid of bars. Muntin boxes: windowMuntinBoxes
                            // (geometry/boxes.ts). Phase 6.1: a NEW window inherits
                            // the last-chosen style (persisted UI pref
                            // `lastWindowStyle`, NOT in the Design; default
                            // "picture"), updated whenever the user sets a window's
                            // style; existing windows aren't retro-changed.
  muntinMaterial: MaterialRef; // color of the glazing bars (divided/grid). Default
                            // near-white #eef0f2. Edited via a "Muntin color" chip
                            // (coalesced setWindowMuntinMaterial); the panel hides
                            // it for picture (no bars). Bars render through the
                            // shared material helper, so patterns work too.
}

interface DoorOpening {     // Phase 2a. Like a window but sits on the floor.
  id: string;
  t: number;                // center along wall, 0..1
  width: number;            // meters (default 0.9)
  height: number;           // meters (default 2.0)
  style: "single" | "double" | "sliding"; // Phase 6. leaf + plan symbol. default
                            // "single". single = one swinging leaf; double/French
                            // = two leaves meeting at center, hinged at opposite
                            // jambs, same swing side; sliding = one leaf sliding
                            // along the wall (no swing). hinge/swing apply only to
                            // single & double; ignored for sliding. The opening
                            // hole is unchanged for all styles (still wallToBoxes).
                            // Phase 6.1: a NEW door inherits the last-chosen style
                            // (persisted UI pref `lastDoorStyle`, NOT in the Design;
                            // default "single"), updated whenever the user sets a
                            // door's style; existing doors aren't retro-changed.
  hinge: "start" | "end";   // hinge side relative to wall start→end direction
  swing: "A" | "B";         // which wall side the door opens toward
  material: MaterialRef;    // leaf material (default solid #9a6b4f)
}

interface FloorRegion {
  id: string;
  polygon: Vec2[];          // user-drawn, grid-snapped, >= 3 points, plan coords
  material: MaterialRef;
}

interface Staircase {       // Phase 3d. Straight stairs; stored on the LOWER level.
  id: string;
  position: Vec2;           // plan coords of footprint CENTER
  rotation: number;         // degrees; ascent direction; 15° steps
  width: number;            // meters (default 1.0)
  material: MaterialRef;
}
// Level gains `staircases: Staircase[]`. A staircase ascends to the level above
// (auto-created if none) and opens a stairwell HOLE in that level's floor slab.

interface Vec2 { x: number; y: number; }
interface Vec3 { x: number; y: number; z: number; }

// Materials are data, never baked into meshes. Furniture and future features
// reuse this exact system.
type MaterialRef =
  | { kind: "solid"; color: string }                              // hex
  | { kind: "pattern"; pattern: PatternId; colorA: string; colorB: string };

type PatternId =
  | "checker" | "planks" | "tile" | "stripes"   // interior, two-tone
  | "grass" | "water" | "gravel";               // outdoor landscape (Phase 4b)
```

Pattern textures are generated procedurally at runtime onto small offscreen
canvases and used as repeating Three.js textures. No image assets. The interior
patterns are two-tone (each pixel is exactly colorA or colorB); the landscape
patterns **blend** between the two colors for a noisy/rippled look (grass =
blades + speckle, water = sine ripples, gravel = speckled stones) and are drawn
as ordinary floor regions (a lawn/pond/path is just a floor polygon). All are
periodic with the tile size so they tile seamlessly, and **water is OPAQUE** —
its watery look is faked with the texture + a slight sheen, never real
transparency (real transparency would reawaken the cutaway material-hiding bug).
Adding `PatternId` values is additive (no schema bump); the importer's pattern
allowlist derives from `PATTERN_IDS` so new ids are never rejected.

## Furniture catalog (Phase 2b)

Furniture instances reference a **catalog id**, never geometry. The catalog lives
in code under `src/catalog/`:

- Each `CatalogEntry` declares `id`, `name`, `category`
  (`living | bedroom | kitchen | bathroom | office | utility | outdoor`),
  `footprint` (width × depth, meters),
  `height`, `wallHugger`, an optional `flat` flag (rugs: above floors, below other
  furniture), optional `surfaceTop` (local meters — marks a support surface) and
  `stackable` (small item that auto-climbs onto a surface), an optional `mount`
  (`"floor"` default | `"wall"` | `"ceiling"`) with `defaultMountHeight` for wall
  items (Phase 4d) / `defaultDrop` for ceiling lights (Phase 5f — see "Wall-mounted
  items" and "Ceiling lights"), optional `legClearance` / `tuckHeight` for
  height-aware collision (Phase 4d Part C — see "Furniture collision"), a `scaling`
  policy (see below), ordered named material `slots`
  (slot[0] is the primary slot the Paint tool recolors), a pure `build(variant?)`
  that returns `Part[]` (composed from shared `box` / `roundedBox` / `cylinder`
  primitives in local space, y up from the floor, +z = front), and a
  `glyph(w,d,variant?)` that returns the distinguishing 2D plan marks.
- **Shape variants (Phase 4c).** An entry may declare `variants: CatalogVariant[]`
  (`{ id, name }`); `build`/`glyph` switch on the resolved variant id and the
  footprint/height/slots/scaling are shared across an entry's variants.
  `variants[0]` is the default. A `FurnitureItem.variant` (optional; undefined →
  default, so pre-v7 items load unchanged) picks one; `resolveVariantId(entry,
  requested)` (in `src/catalog/index.ts`) is the single source of truth every
  `build()`/`glyph()` call site uses to coerce a missing/invalid id to a valid
  one. Variants are exposed as **one palette button per variant** (placement sets
  `placingVariant`) AND a **Variant selector in the properties panel** (switches a
  placed item in place via `updateFurniture`, undoable). Trees (Broadleaf /
  Conifer / Ornamental) and shrubs (Spreading / Rounded / Columnar) use this;
  collision is unaffected (footprint is variant-independent). Adding a variant is
  additive (no schema bump); adding the field was the v6→v7 migration (pre-4c
  `tree`→Broadleaf, `hedge`→Spreading shrub, widened to keep its old footprint).
- **Scaling (Phase 2c).** `scaling: CatalogScaling` is `{ mode: "none" }`
  (fixed size), `{ mode: "uniform"; uniform: [min,max] }` (one multiplier on every
  axis), or `{ mode: "axes"; axes: { x?,y?,z?: [min,max] } }` (per-axis ranges;
  an omitted axis is locked to 1). A `FurnitureItem.scale: Vec3` holds the chosen
  multipliers. `clampScale(scaling, requested)` enforces the policy,
  `effectiveDimensions(entry, scale)` is the single source of truth for an item's
  real-world size — **every** footprint consumer (3D group `scale`, plan symbol
  `scale()`, hit-test, wall-hugger snap) reads through it — and
  `dimensionToMultiplier(meters, base)` is its inverse for one axis. New items
  default to `{1,1,1}`; the properties panel exposes mode-appropriate Size
  controls, each a **slider + editable number field in meters** (typed values go
  through `dimensionToMultiplier` then `clampScale`, so out-of-range input snaps
  to the boundary), plus a Reset-size button. Keep ranges generous so users have
  real freedom, but never allow zero/negative sizes. Pick a policy per item:
  stretch what realistically stretches, scale proportionally what should stay in
  proportion, lock what would look broken. All three helpers live in
  `src/catalog/scale.ts` (tested).
- Builders are pure data (no hooks). The 3D renderer maps each `Part` to a mesh
  whose material comes from `item.materials[slot] ?? entry.slots[..].default`,
  **always through the shared `materialRefToThreeMaterial` helper** — so patterns
  work on furniture for free. Plan symbols reuse the same footprint + glyph.
- Local→world: a `FurnitureItem` renders as a group at `planToWorld(position)`,
  rotated about world Y by `-rotation` (plan rotation is SVG-clockwise) and scaled
  by `[scale.x, scale.y, scale.z]`. Footprint hit-testing and wall-hugger snapping
  are pure functions in `src/geometry/furniture.ts` (tested) and operate on the
  scaled footprint.
- Furniture renders in **all** wall view modes (Full/Cutaway/Stubs never hide it).
  `#catalog` in the URL opens a dev-only 3D QA line-up of every item (it iterates
  `CATALOG_ITEMS`, so new items appear there automatically).
- **Palette UI.** The Furniture tool's right-panel palette (`FurniturePalette` in
  `PropertiesPanel.tsx`) groups items into **collapsible category headers** behaving
  as an **accordion — exactly one group open at a time** (clicking a header opens it
  and collapses the rest; clicking the open header closes it, so all can be closed).
  Groups derive from each entry's `category` (empty categories are skipped, so new
  items land in the right group automatically). The open category is the persisted
  UI pref `openPaletteCategory` (string | null in `ViewPrefs`/the store, NOT in the
  Design; `setOpenPaletteCategory`), restored when the tool reopens; **default is
  all-collapsed** (null). Picking an item to place is unchanged.
- **Catalog inventory (Phase 4a/4b/4d/5f).** 74 items across seven categories:
  *Living* (3-seat sofa, sectional sofa, loveseat, armchair, ottoman, coffee
  table, side table, console table, TV stand, fireplace, rug, bookshelf, floor
  lamp, potted plant, **books**); *Bedroom* (double/single bed, nightstand,
  wardrobe, dresser, dressing table, bed bench, crib, bedside lamp, full-length
  mirror); *Kitchen* (counter, upper cabinet, pantry cabinet, kitchen island,
  fridge, stove, dishwasher, microwave, dining table/chair, bar stool, bench,
  **kettle, toaster, coffee maker**); *Bathroom* (toilet, bidet, sink vanity,
  bathtub, shower stall, towel rack, bathroom cabinet); *Office* (desk, office
  chair, filing cabinet, desk lamp, **computer** — the bookshelf is reused, not
  duplicated); *Utility* (washing machine, dryer); *Outdoor* (patio table, patio
  chair, sun lounger, parasol, BBQ grill, garden bench, planter box, fire pit,
  tree, shrub, fence panel — all free-standing and collidable; placed on the
  ground level; decking/paving use the existing planks/tile floor patterns, not
  new items). The `tree` and `shrub` (id `hedge`) entries each carry three shape
  **variants** (Phase 4c, above). **Phase 4d Part A** adds the surface/decor items
  (computer, kettle, toaster, coffee maker, books) — `stackable`, `collidable:
  false`, riding the existing auto-stacking. (The `computer` `build()` places the
  monitor-on-stand at the back-left with the tower standing to its right and the
  keyboard in front, so the parts no longer intersect; same slots/ids.) **Phase 4d
  Part B** adds six
  `mount:"wall"` items (see "Wall-mounted items"): framed wall art, wall-mounted
  TV, floating shelf, wall sconce, wall mirror, range hood. **Phase 5f** adds three
  `mount:"ceiling"` lights (see "Ceiling lights"): pendant light, flush ceiling
  light, chandelier.
  **Deferred** (do NOT add): curtains (a future fabric pass); true valley
  **mitering** between overlapping/adjacent roof pieces (Phase 6.2 polygon roofs
  show an **approximate** ridge/valley join); **exact** gabled/hipped roofs over
  **angled (non-rectilinear) footprints** (Phase 6.2 falls back to the bounding
  rectangle + an honest message — flat/pitched cover angled shapes exactly);
  roofs **auto-updating** on wall edits or **per-mass** automatic roofing across a
  level (the failed Phase 5.1 system — Phase 6.2 Auto is generate-once + static);
  auto-stacking ONTO a wall shelf (`computeStackBaseLifts` is plan-position based
  and can't know a shelf's wall height; the floating shelf is decorative for now).

## Wall-mounted items (Phase 4d Part B)

- A `mount:"wall"` `CatalogEntry` hangs on a wall face as a `WallMount` (child of
  the wall, like a window/door). Its `footprint` is read as (width along the wall)
  × (protrusion out from the wall), `height` is the vertical size, and
  `defaultMountHeight` is the placement height to the item's vertical center.
- **Placement** reuses the window/door wall-attach interaction: with a wall item
  active in the **Furniture** tool, hovering near a wall shows a ghost marker on
  the nearest face at the cursor's `t` and side (`face`); click attaches at
  `defaultMountHeight`; Esc cancels; the tool stays active. `addWallMount`.
- **Child-of-wall:** mounts move with their wall (parametric `t`) and are deleted
  with it; `copyWallsToAbove` copies them under fresh ids.
- **3D** (`WallMount3D`, rendered as a child of `Wall3D`): a group on the chosen
  face, offset out by `thickness/2 + protrusion/2`, vertical center at `elevation
  + heightUpWall`, oriented to face away from the wall, scaled, materials via the
  shared `materialRefToThreeMaterial` helper. Because it renders inside `Wall3D`
  it inherits the wall's **Cutaway** Invisible/Ghost suppression and is **hidden
  in Stubs** (it sits above stub height, like windows). Wall mirror glass is an
  **opaque** pale material (no real transparency — cutaway-safe).
- **2D plan:** a small distinct selectable marker (the footprint rectangle on the
  face + a dot). Height isn't visible top-down, so only position/side show.
- **Selection** is **plan-only** (`Selection` kind `wallMount`); 3D picking is not
  wired for mounts. The properties panel edits position along wall (meters), height
  up wall, face A/B, Size (per scaling policy), material slots, and Delete — all
  undoable store actions (`updateWallMount` / `setWallMountMaterial` /
  `setWallMountScale` / `deleteWallMount`). Mounts are **excluded** from furniture
  collision and never wall-hug or floor-stack. Pure transforms live in
  `src/geometry/wallMount.ts` (`wallMountPlanFootprint`, `wallMountWorld`, tested).
- Schema bumped to **v8**; the v7→v8 migration gives every wall `mounts: []`
  (fixture-tested). Export/Import + autosave round-trip mounts.

## Furniture collision (Phase 3c.2 — footprint; Phase 4d Part C — height-aware)

- Each `CatalogEntry` carries `collidable: boolean` — **true** for bulky
  floor-standing items you'd never overlap, **false** for flat/surface/decor
  items meant to sit on or under others (rug, lamps, plant, microwave, mirror,
  towel rack, bathroom cabinet, and the Part A surface items). A non-collidable
  item never collides.
- Two **collidable** items on the **same level** collide when their oriented
  (scaled, rotated) footprint rectangles overlap beyond a small tolerance
  (Separating Axis Theorem, `footprintsOverlap`) **AND** their vertical extents
  `[base, base + scaledHeight]` overlap (`verticalExtentsOverlap`; `base` is 0 on
  the floor) **AND** neither tucks under the other. The full predicate is
  `collidableItemsCollide`; `collidingIds` / `collidingMovableIds` use it (all in
  pure tested `src/geometry/furniture.ts`).
- **Tuck-under (Part C).** Leggy entries (dining table, desk, console table,
  coffee table, kitchen island, patio table) carry `legClearance` (open space
  beneath the top); tuckable entries (dining chair, bar stool, office chair, patio
  chair, bench) carry `tuckHeight` (default = `height`). `fitsUnder(t, l)` is true
  when `l.legClearance` exists and `t.tuckHeight <= l.legClearance` — those two do
  NOT collide even with overlapping footprints (chairs tuck under tables). The
  catalog→collision inputs (scaled height/legClearance/tuckHeight) come from
  `collisionExtent(entry, scale)`. Tuck-under does **not** apply to walls/openings.
- **Walls and stairwell openings are barriers too:** a collidable item overlapping
  a wall (an oriented length×thickness footprint via `wallFootprint`) OR a
  stairwell opening (the floor hole on this level from a staircase on the level
  **below**) collides — footprint-only, **no** vertical/tuck exemption (a chair
  vs a wall always collides). `collidingMovableIds` checks movables vs other
  movables + barriers; the store's `collidesOnLevel` (Hard guards) does the same.
  An item sitting **flush** against a wall has ≈0 overlap (within the
  `footprintsOverlap` tolerance) so it doesn't trip the barrier; only **actual
  penetration** (rotated/moved past flush) does. This flush-vs-penetrate rule is
  the wall-barrier behavior for ALL items (no per-item exemption — the snap just
  keeps snapped items flush).
- **Snap to wall (Phase 6.1 Part C)** is a persisted UI pref (`snapToWall`, NOT in
  the Design; default on), toggled from a **"Snap to wall"** checkbox in the right
  panel during **Furniture** placement (in `FurniturePalette`) and **Staircase**
  placement (`StairToolPanel`). When **on**, ANY furniture/staircase snaps its back
  edge flush to a nearby wall face while placing or dragging — this **overrides**
  the per-item `wallHugger` catalog flag (which now only informs the
  default/recommended behavior; the toggle is authoritative). When **off**, nothing
  auto-snaps (even current wall-huggers). The snap **aligns** the item's front into
  the room by **default**, but **manual rotation wins**: once the user rotates
  (R/Shift+R or the panel) the snap keeps the flush **position** but honors the
  rotation (`wallHuggerSnap(..., align)`; dragging an already-placed item always
  keeps its rotation). A snapped item still participates in collision warnings via
  the flush-vs-penetrate rule above.
- **Collision mode** is a persisted UI pref (`collisionMode`, NOT in the Design),
  set from the **Settings** dialog (gear in the top bar, next to Undo/Redo):
  **Off** (no checks),
  **Soft** (default — overlaps allowed but overlapping collidable items get a red
  warning tint in 2D and 3D, live), **Hard** (an item may not come to rest
  overlapping: placement is blocked, a drag reverts to its last non-overlapping
  spot, and rotating/scaling into an overlap reverts). Hard guards live in the
  store actions (`placeFurniture`/`rotateFurniture`/`setFurnitureScale`); the
  drag-revert is in the plan editor (tracks last-valid, falls back to pre-drag).

## State, undo, persistence

- One Zustand store holds: the `Design`, the current level id, the active tool, the
  current selection, view settings, and undo/redo history.
- **Every mutation goes through a named store action.** Components never write
  state directly.
- **Undo/redo from day one.** Implement as snapshots of the `Design` (structurally
  shared or deep-cloned — design docs are small) pushed on each *committed* action.
  Mid-drag movements update a transient preview; history records only on commit
  (mouse-up). Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y). Cap history at 100 entries.
- **Copy/paste.** A transient store `clipboard` (NOT persisted, NOT in history)
  holds a deep clone of the selected top-level object (wall, furniture, roof,
  staircase, ceiling light). `copySelection` fills it; `pasteClipboard` drops a
  fresh-id duplicate offset by `PASTE_OFFSET` (0.5 m) onto the **active** level,
  selects it, and is one undo step. A copied wall brings its windows/doors/mounts
  under fresh ids (`cloneWallWithNewIds`); a pasted staircase auto-creates the
  level above like placement. The clipboard survives level switches (copy on one
  floor, paste on another). Wired to Ctrl/Cmd+C / Ctrl/Cmd+V in
  `useGlobalShortcuts` (suppressed while typing so browser text copy still works).
- **Persistence (Phase 5b — design library):** designs live in an IndexedDB
  library (`src/storage/library.ts`) of records `{ id, name, createdAt,
  modifiedAt, thumbnail?, design }` — 100% local/offline, no backend (raw IDB, no
  package). The store tracks the open record's id (`openDesignId`); debounced
  autosave (`useAutosave`) writes the open design to its record via
  `saveOpenDesign` and refreshes a small `captureView` thumbnail on save (NOT per
  keystroke). On first run, `migrateLegacyAutosave` imports any old
  single-slot localStorage autosave into the library (never lost) and clears it.
  The welcome screen and the in-app **My Designs** menu list records (New / Open /
  Duplicate / Rename / Delete; Continue = most recent; Save As forks a new record
  via `saveAs`). Import (`setDesign`) and New (`newDesign`) start a fresh record
  id. Still: explicit "Export JSON" / "Import JSON" (the unified **Design JSON**
  top-bar menu); per-design `schemaVersion`
  migrations run on open via `validateDesign`; a future unknown version is refused
  rather than corrupting data.

## Image export (Phase 5a)

- Reusable capture utilities live in `src/lib/capture.ts`. `capture3D(handles,
  {scale, transparent})` renders the live preview scene/camera to an offscreen
  render target at `scale`× the on-screen size and returns a canvas; transparent
  clears alpha to 0 and drops the scene background (real alpha, never blank), and
  renderer state is restored afterwards. `captureView` is the small-thumbnail
  wrapper reused by the design library (Phase 5b). `capturePlan(svg, bounds,
  {scale, transparent})` clones the plan's `[data-plan-content]` group (dropping
  its pan/zoom transform + screen-space dimming), frames it to the design bounds
  via a viewBox, and rasterizes to a 2× canvas.
- The 3D handles (`gl`/`scene`/`camera`/`size`) reach the export UI via a
  `SceneCapture` component inside the `<Canvas>` writing a parent-owned ref AND a
  module-level pointer (`setCaptureHandles`/`getCaptureHandles`); the plan editor
  registers its capturer the same way (`setPlanCapturer`/`getPlanCapturer`), so
  non-pane code can drive either capture on demand.
- UI: a single **Export image** button in the **top bar** (`ExportMenu`, beside My
  Designs and Settings) opens a popover to export the **2D plan**, the **3D
  image**, or **Both** (two PNGs) — each at 2× via `downloadCanvasPng`, reusing
  the capture utilities above. A **Transparent 3D background** toggle applies to
  the 3D image only (the plan always exports on a white ground). Options for a
  pane not currently shown (per `layout`) are disabled. The design **document**
  (JSON) has its own unified top-bar **Design JSON** menu (`DesignFileMenu`, same
  popover pattern) with **Import JSON…** / **Export JSON** options.

## Geometry rules

- **No CSG libraries.** Window holes are made by composing each wall from
  axis-aligned-in-wall-space **sub-boxes**: for every window, the wall splits into
  a box under the sill, a box above the window head, and full-height boxes between
  openings. One pure function computes the sub-box list for a wall:
  `wallToBoxes(wall): Box3Spec[]` — unit test it heavily.
- **Opening-overlap warning (Phase 6.1 Part B):** the placement validators only
  compare opening **holes**, but editing (especially switching a door to
  **sliding**, whose panel parks to one side of the hole) can make an opening
  visually cover another. Pure tested `openingsOverlap` / `overlappingOpeningIds`
  (`src/geometry/openings.ts`) compare each opening's **occupied span** along the
  wall — `openingOccupiedSpan` extends a sliding door one width toward the wall
  start — and flag any two overlapping openings (windows + doors together). The 2D
  plan tints overlapping openings with the **same red warning** used by furniture
  collision, live as the user edits. **Warning-only**: never blocks/clamps, and
  independent of `collisionMode` (opening overlaps always warn).
- **Corners (Phase 5d — corner posts, NOT mitering):** thick walls overlap where
  they meet; a small **corner post** fills each junction so corners read clean.
  Pure tested `cornerPosts(walls)` (`src/geometry/cornerPosts.ts`) groups walls by
  coincident endpoint (and detects T-junctions where an endpoint snapped onto a
  wall's segment); at each junction of 2+ walls it emits a full-height box sized to
  the thickest wall there, centered on the shared point, with the meeting wall ids.
  `CornerPosts3D` renders them (neutral tone via the shared material helper) and
  honors the level's view mode: Stubs at 10%, and Cutaway suppresses a post only
  when ALL its walls are front-facing (so corners with a visible rear wall stay
  solid). Render-side only; no schema change. Still no true mitering/joinery.
- Walls are line segments with thickness; render each sub-box as a `BoxGeometry`
  oriented along the wall direction.
- Side A/B paint maps to the box faces facing left/right of the wall direction.

## 3D preview rules

- **OrthographicCamera** for the isometric look. Orbit rotation (drag) and zoom
  around the model are allowed; lock vertical orbit so the camera can't go below
  the floor plane. Default view: classic iso angle (~45° azimuth, ~35° elevation).
- Three **wall view modes**, switchable at any time:
  1. `full` — render walls normally.
  2. `cutaway` — walls whose outward normal faces the camera (dot(wallNormal,
     toCamera) > 0 for either side facing the viewer between camera and interior)
     are suppressed; recompute as the camera rotates. A sub-option controls
     suppression style: **invisible** (not rendered) or **ghost** (rendered at
     ~15% opacity, depthWrite off). Rear walls always render solid.
  3. `stubs` — every wall renders at 10% of its height. Windows are simply not
     rendered in this mode (they sit above the stub height); that is expected
     behavior, do not special-case them.
- The preview is **read-only except for furniture selection.** Phase 3a adds 3D
  picking: hovering a furniture item highlights it (subtle emissive echo of the
  selection tint) with a pointer cursor, and a clean click (not an orbit drag)
  selects it through the SAME `selection` state and store action the plan uses —
  highlighting in both views and the properties panel. Clicking empty space
  deselects. **Only furniture is pickable** (walls/doors/windows/floors are not);
  raycasting hits the real furniture meshes and resolves up to the owning item id
  via `userData.itemId` (`resolveItemId` in `preview/picking.ts`, tested). There
  is still **no moving/rotating/scaling/editing in 3D** — all editing stays in the
  2D plan and properties panel.
- **Stacking offsets.** Surfaces meant to read as separate must never share an
  exact world Y or they z-fight as the camera orbits. Ground plane < floor
  regions < flat items (rugs) < regular furniture each sit on their own layer,
  defined as named constants in `src/components/preview/stacking.ts` (no scattered
  magic numbers). Transparent materials (ghost cutaway) use `depthWrite: false`;
  keep furniture materials opaque (rugs included) so they don't occlude what's
  behind them. **Flat items (rugs/mats) are thin solid boxes** (not zero-thickness
  planes) and render **double-sided** (`THREE.DoubleSide`, keyed off `entry.flat`
  in `FurniturePiece`) so their thin faces never backface-cull and vanish as the
  camera orbits low/overhead.
- **Automatic surface stacking.** A `stackable` catalog item (microwave, lamp)
  whose footprint CENTER lies within a `surfaceTop` item's footprint (counter,
  table, dresser…) automatically rests on that surface's top instead of being
  buried inside it; surfaces can rest on surfaces (transitive). This is a pure
  render-side computation (`computeStackBaseLifts` in `geometry/furniture.ts`,
  tested) keyed off plan positions — elevation is invisible top-down, so it
  needs **no schema field or persistence**. It resolves live as items move; it is
  NOT a manual elevation control.

## Work area, welcome screen & Fit view

- **Welcome screen** (`WelcomeScreen`, shown before the editor when `started` is
  false): if a save exists, offer **Continue** (resume untouched) and **New
  design**; otherwise go straight to the size chooser. The chooser (shared
  `SiteSizeForm`) shows the three presets + a custom width × depth and creates a
  fresh design with the chosen `site`. Returning users are never re-prompted.
- **Site rendering:** the 2D plan shades the site rectangle with a border +
  dimension label and dims the grid outside it (soft — drawing outside still
  works). The 3D ground shows the site as a lighter "lot" over the dark
  surroundings. **Resize area** (top-bar button, left of New → `setSite`, undoable) grows
  or shrinks the site without moving/deleting anything.
- **Fit view** exists in BOTH the 2D plan and the 3D preview and they're
  siblings: frame the union of the site and all drawn geometry (or just the site
  when empty), with a margin. The 2D math is pure in `src/geometry/planview.ts`
  (tested); the plan also fits once on first mount.

## Levels / storeys (Phase 3c — no staircases yet)

- The `levels` array is ordered **ground-first**. Editing always acts on the
  **active level** (`currentLevelId`, a persisted UI pref — not part of the
  Design). Anywhere that needs the active level uses `selectCurrentLevel`; never
  hardcode `levels[0]`.
- **Elevation is derived, never hand-edited.** `computeElevations(levels)` (pure,
  tested, in `src/model/levels.ts`): ground = 0; each level above sits at the
  previous `elevation + wallHeight + FLOOR_SLAB_THICKNESS` (0.2 m, in
  `model/defaults.ts`). `restackElevations` writes it back after any add/remove,
  so `level.elevation` always matches. No schema change (levels/elevation already
  existed); existing single-level designs open as the ground floor.
- **Level management** (`LevelsPanel`): a vertical list, **bottom floor at the
  bottom**, upper floors above. Levels are named by the **American convention**
  (`defaultLevelName`: bottom = "First floor", then "Second floor"… — no "Ground
  floor"). Add floor above (empty), rename inline, delete (confirm; never the last
  level), click to set active. All structural changes are undoable store actions
  (`addLevelAbove`, `deleteLevel`, `renameLevel`, `setCurrentLevel`). It lives in
  the **Floors dropdown** (a button beside Fit View in the plan controls), which
  also holds the underlay toggle; clicking a floor row collapses the dropdown. In
  the **3D-only** layout (no plan visible) the same dropdown appears in the 3D view
  bar so you can still switch floors. (The toolbar scrolls vertically when the
  viewport is too short for every tool.)
- **Wall dimensions (Phase 5c):** a persisted UI pref `showDimensions`
  (`setShowDimensions`, toggle in the plan controls) draws a length label on every
  wall segment, not just while drawing. Labels render in **screen space** (constant
  font at any zoom), rotated along the wall, flipped to avoid upside-down text,
  offset slightly off the face; walls too short on screen are skipped (light
  de-clutter, no full collision-avoidance). Plan-only; 3D unaffected.
- **2D underlay:** the level directly below the active one renders as a faint,
  **non-interactive** reference (`UnderlayLayer`, `pointer-events: none`), toggled
  from the Floors dropdown (only when not on the bottom floor).
- **3D:** `Building3D` stacks every level at its elevation; an "Active level only"
  toggle isolates the active one. Floor regions render as **real slabs**
  (`Floors3D`, extruded `FLOOR_SLAB_THICKNESS`, walking surface at the elevation).
  In **Cutaway/Stubs**, upper-level slabs get the SAME Invisible/Ghost suppression
  as walls (`isUpperSlab`); the ground slab stays solid — so you can see into
  every storey. Reuses the existing cutaway/ghost machinery and shared material
  helper. **Fit view frames the whole building.** Picking an item on a non-active
  level switches the active level to it (so the plan/panel act on it).
- **Walls connect between storeys:** in the stacked view each upper level's walls
  render a `skirt` (a solid band of `FLOOR_SLAB_THICKNESS` below the floor, full
  footprint, no openings) so they meet the lower level's wall tops — no floor band
  shows between levels. Skipped on the ground level, in Stubs, and in active-only.

## Staircases (Phase 3d — straight stairs only)

- A `Staircase` is stored on the **lower** level it ascends from. **Staircase tool
  (S):** ghost footprint follows the cursor (grid-snapped), R / Shift+R rotate in
  15° steps, click places, Esc cancels, tool stays active. Placing one with no
  level above **auto-creates** the level above (3c naming); the active level stays
  the lower one.
- Pure tested `computeStair(stair, storeyHeight)` in `src/geometry/stair.ts`:
  storey height = `wallHeight + FLOOR_SLAB_THICKNESS`; `steps = round(storey /
  STAIR_RISER_TARGET)` (0.18), actual riser = storey/steps, `runLength = steps *
  STAIR_TREAD_DEPTH` (0.25); footprint = width × runLength rotated about position;
  the **opening** rectangle (= footprint) is cut from the floor above.
- **Floor opening:** a level's floor regions (its slabs) are built with
  `THREE.Shape` + **hole paths** for the opening rectangles of the level BELOW
  (`Floors3D`, no CSG); the 2D plan path mirrors them as even-odd holes. The mask
  is authoritative — a floor region drawn over the opening still renders the hole,
  so the floor tool needs no special blocking. **Which** openings cut a given
  floor polygon is the single pure tested helper `openingsForFloor(openings,
  polygon)` (`src/geometry/floorOpenings.ts`): it keeps any opening that shares
  interior AREA with the floor — **fully inside OR flush against an edge**. (A
  strict "every corner inside" test used to drop the hole when a stair sat flush
  against a wall, since those corners land ON the floor boundary.) The 3D slab,
  the 3D floor regions, and the 2D path all go through this one helper so they
  can't drift.
- **Collidable:** staircases participate in the collision system as bulky
  footprints (`levelCollidables` includes furniture + stairs); Soft warns / Hard
  reverts vs furniture and other stairs on the same level.
- **3D:** `Staircase3D` is a box per step rising from the lower elevation; pickable
  like furniture (Phase 3a). **2D:** tread lines + up-arrow on the lower level; an
  "open below" dashed void on the upper level (plus the stair through the
  underlay). Selectable/draggable/rotatable with a properties panel (width,
  rotation, position, material, delete). `Selection` gains `{ kind: "staircase" }`.

## Roofs (Phase 5.2 — manual roof tool, user-placed rectangles)

- Roofs are **objects the user places**, not auto-generated. They live **per
  level** as `Level.roofs: Roof[]` (NO top-level `Design.roof`). The old
  automatic per-mass system (Phase 5.1 — mass detection, rectilinear
  decomposition, anchor association/reconciliation) is **removed**: there is no
  `roofMass.ts` / `roofReconcile.ts`, no `reconcileRoofSections`, and no roof
  logic runs on wall edits. An **L-shape is made by placing two rectangles**,
  each independent. Roofs **stay put** — adding/copying a floor above never adds,
  moves, duplicates, or re-tops any roof.
- **Roof tool** (left toolbar, directly under the Stair button; shortcut **O**)
  has **two modes**, chosen in its properties panel (`RoofToolPanel`) like the
  Wall tool's Draw/Room sub-modes — a transient UI pref `roofMode` (`"draw"` |
  `"auto"`, default `"draw"`, NOT in the Design, `setRoofMode`):
  - **Draw** (Phase 5.2): drag a rectangle (grid-snapped corners, live W × D
    labels, mirroring the Room sub-tool); release creates a rect `Roof` centered
    on the dragged rect with the default type (**gabled**), default pitch/overhang/
    material, `visible: true`, on the active level. Esc cancels; a zero-area drag
    is ignored; the tool stays active. One undo step per roof (`addRoof`).
  - **Auto** (Phase 6.2): click inside a fully enclosed room → generate **ONE**
    polygon `Roof` fitted to the section's **true footprint** (incl. L/T/U),
    **once**. Reuses the Fill Room flood-fill (`detectRoom`), then
    `simplifyPolygon` (RDP, tol ≈ grid) collapses grid-traced staircases so a
    real rectilinear room stays axis-aligned and an angled-walled one reads as
    non-rectilinear. The traced polygon becomes the roof's **static** `footprint`
    (captured at generation; `shape:"polygon"`). One undo step (`addRoofAuto`,
    returns `{ generated, rectilinear }` for messaging). A non-enclosed click
    generates nothing and shows "Area isn't fully enclosed — roof not generated".
- **Generated roofs are ordinary roof objects** (selectable, movable, editable,
  deletable, per-level). They **never auto-update/re-run** on wall edits (the
  `footprint` is frozen) and **never multiply across floors** — to re-fit a
  changed building, delete and re-run Auto. Do NOT reintroduce mass detection /
  reconciliation / anchors (the failed Phase 5.1 system).
- **Editing** (Select tool): a roof is selectable via `roofContainsPoint`
  (`src/geometry/roofPlacement.ts`, tested) — a rect roof uses its rotated
  rectangle (`pointInFootprint`/`roofFootprint`), a **polygon** roof its
  `footprint` outline (`pointInPolygon`). Drag the body to move
  (`moveRoof` translates the whole `footprint` for polygons); **R / Shift+R**
  rotate rect roofs (no-op for polygons). `Selection` gains `{ kind: "roof" }`.
  Delete/Backspace removes it. The panel edits type/pitch/overhang/material/
  visible for both; **width/depth/rotation only for rect roofs** (hidden for
  polygons) — all undoable named store actions (`addRoof`, `addRoofAuto`,
  `updateRoof` coalesced for sliders, `rotateRoof`, `moveRoof`, `deleteRoof`).
- **Rect geometry:** pure tested `computeRoof(bbox, type, pitch, overhang, baseY,
  thickness?)` (`src/geometry/roof.ts`) over the roof's **local** (centered,
  axis-aligned) rectangle (`roofLocalBounds`). **flat** = a real slab over (rect +
  overhang); **pitched** = a shed slope; **gabled** = ridge along the longer axis;
  **hipped** = inset ridge, four slopes.
- **Polygon geometry:** pure tested `computePolygonRoof(footprint, type, pitch,
  overhang, baseY, thickness?)` (`src/geometry/roof.ts`), built in **absolute**
  plan/world coords (no group transform). **flat** & **pitched** tile cleanly over
  the **whole polygon** (ear-clipped via `triangulate`, overhang via
  `offsetPolygon`) — so they cover L/T/U **and angled** footprints exactly.
  **gabled** & **hipped** **rectilinear-decompose** the polygon into rectangles
  (`decomposeRectilinear`, horizontal slabs) and emit a `computeRoof` piece per
  rectangle, all under the SINGLE roof object. Pieces meeting at inner corners
  show an **approximate** ridge/valley join (true valley **mitering** stays
  deferred). A pure tested `isRectilinear(footprint)` gates this: when the
  footprint is **NOT** rectilinear AND the type is gabled/hipped, the
  decomposition can't represent it, so it falls back to the **bounding rectangle**
  and the plan editor surfaces an **honest, non-blocking** message ("Angled walls
  can't get a gabled/hipped roof yet — using a best-fit; try Flat or Pitched for
  exact coverage."). Flat/pitched on any polygon, and gabled/hipped on
  rectilinear polygons, never show it. `ROOF_LIFT` (`preview/stacking.ts`) raises
  every roof a hair above the wall-top plane so flat slabs never z-fight it.
- **Render** (`LevelRoofs3D` per level, in `Building3D` → `RoofMesh`): a **rect**
  roof's parts are built in local space, then a parent group rotates about world Y
  by `-rotation` (SVG-clockwise, like furniture) and seats it at the roof's plan
  position; a **polygon** roof's parts are already absolute, rendered in a group
  at the origin. Meshes fan-triangulate double-sided (shared material helper,
  planar UVs) at `level.elevation + level.wallHeight (+ ROOF_LIFT)`. Roofs are
  **independent of walls** — they cover their footprint. **View-mode:** suppresses
  in Cutaway/Stubs exactly like an upper floor slab (Invisible/Ghost); solid in
  Full; kept solid in active-level-only. PLUS each roof's `visible` flag and a
  **global hide-roofs** UI pref (`hideRoofs`, persisted) remove it — toggled by a
  **Show roofs** button in the 3D **`ViewModeBar`**, NOT in the 2D editor.
- **2D plan** (`RoofSymbol`): a rect roof draws its (rotated) rectangle with a
  faint ridge line (along the longer axis; omitted for flat); a polygon roof draws
  its `footprint` outline with a faint ridge hint per decomposed piece (gabled/
  hipped). Both selectable. The only global roof control is the **Show roofs**
  toggle in the 3D view bar.
- The v11→v12 migration **clears** every level's `roofs` to `[]` (the old auto
  output was unsatisfactory). The v15→v16 migration gives every existing roof
  `shape: "rect"` (missing `shape` is also treated as rect everywhere).
  Export/Import round-trips both shapes (storage validates a polygon roof's
  `footprint`).

## Ceiling lights (Phase 5f — fixtures only, ceiling-attach)

- A `mount:"ceiling"` `CatalogEntry` hangs from a level's ceiling as a
  `CeilingLight` (stored on the level). `build()` parts rise y-up from 0 (bulb)
  to `height` (canopy); `defaultDrop` is the placement drop below the ceiling.
  Fixtures only — NO real illumination; the shade reads "lit" via a warm
  near-white default color (no scene light, no emissive material field).
- The ceiling height for a level = `elevation + wallHeight`; a light hangs with
  its canopy at `ceilingY - drop`, and `CeilingLight3D` draws the connecting cord
  (length = drop) up to the ceiling. Excluded from collision (like wall mounts).
- **Placement** reuses the Furniture tool: with a `mount:"ceiling"` item active a
  ghost follows the cursor in the plan (X/Z, grid-snapped); click places at the
  default drop; Esc cancels; the tool stays active. `addCeilingLight`.
- **3D** (`CeilingLights3D` per level): hidden in **Stubs** (above stub height,
  like windows); shown in **Full** and **Cutaway** (in Cutaway the ceiling/roof
  above suppresses, so the lights become visible — correct). Materials via the
  shared helper.
- **2D plan:** a small selectable circle+cross marker at `position` (drop/height
  aren't visible top-down). **Selection** kind `ceilingLight` is **plan-only** (no
  3D picking); the properties panel edits X/Y, drop, Size, materials, Delete — all
  undoable (`updateCeilingLight` / `setCeilingLightMaterial` /
  `setCeilingLightScale` / `deleteCeilingLight`); draggable in the plan.
- Schema bumped to **v10**; the v9→v10 migration gives every level
  `ceilingLights: []` (fixture-tested). Export/Import round-trips them. Three
  catalog items: pendant light, flush ceiling light, chandelier.

## 2D plan editor rules

- SVG with pan (space-drag or middle-drag) and zoom (wheel, cursor-centered).
  Visible grid (light minor lines every 0.1 m at high zoom, major every 1 m).
- Tools are explicit modes in a left toolbar with icons + labels + keyboard
  shortcuts shown in tooltips: **Select (V)**, **Wall (W)**, and in later phases
  Window (N), Floor (F), Paint (P).
- Wall tool: click to start, click to place end (live preview line + length label
  while drawing), Esc cancels; consecutive clicks chain walls; Enter/double-click
  ends the chain. Hold Shift to constrain to 0/45/90°.
- **Room** is a sub-mode of the **Wall** tool (one toolbar button; Draw / Room
  chosen in the properties panel — R is taken by furniture-rotate): drag a
  rectangle to create **four joined walls** with shared coincident corners (live
  W×D labels); Esc cancels; a zero-area rect is ignored; one undo step (`addRoom`).
- **2D walls render each side's paint:** every wall span draws an A-side half and a
  B-side half (each filled with `paintA` / `paintB`) plus a thin outline, so paint
  applied to either side (Paint tool or Fill Room) shows in the plan, not just 3D.
- **2D floors cut stairwell holes:** floor regions render as SVG paths with the
  level-below's stairwell openings as even-odd holes (mirrors the 3D slab mask), so
  a filled floor over a stair shows the opening in the plan too.
- **Fill Room tool (G):** click inside a fully enclosed room to fill its floor
  and/or paint its interior wall faces with the current material (panel toggle:
  Floor / Walls / Both, default Both). Enclosure is found by a pure tested **grid
  flood-fill** at the 0.1 m grid (`detectRoom` in `src/geometry/roomFill.ts`):
  walls rasterize to barrier cells, the flood from the click is **open** if it
  reaches the site+margin border (→ "Room isn't fully enclosed", no change), else
  the flooded cells are traced into a rectilinear floor polygon and each bordering
  wall's **interior-facing side** (A/B, sampled just off each face) is painted —
  the outward face is untouched. Floor fill replaces an existing floor covering
  the clicked point (no stacking). Staircase holes are handled by the existing
  floor-slab render mask. One undo step (`fillRoom`).
- **Wall auto-snap/heal** (`WALL_SNAP_TOLERANCE = 0.2 m`, pure `snapEndpoint` in
  `src/geometry/wallSnap.ts`, tested): every wall create/edit path — freehand
  draw, room tool, endpoint drag, copy-up — snaps an endpoint first onto a nearby
  **endpoint** (exact coincidence), else onto a wall **segment** (T-junction),
  else falls back to grid. A green snap ring shows while a snap is active. (No
  auto-trim/auto-split this phase.)
- **Copy walls to floor above** (`copyWallsToAbove`): from the level list (all
  active-level walls) or the wall properties panel (just the selected wall).
  Duplicates geometry + openings under fresh ids onto the level above (created if
  missing), skips exact duplicates, snaps copied endpoints, switches the active
  level to the target. One undo step.
- Select tool: click selects a wall (highlight in BOTH the plan and the 3D
  preview); drag an endpoint handle to move it; drag the wall body to translate
  the whole wall; Delete/Backspace removes it.
- A right-side **properties panel** shows the selection's editable fields (wall:
  length, thickness, height, later paint per side; window: width, sill height,
  position; floor: material) and a Delete button. Empty state shows tips.
- Layout: toolbar left, plan center, properties right, 3D preview either side-by-
  side with the plan or toggled via a Plan / 3D / Split control — Split is the
  default on wide screens.

## Help panel & empty-state nudge (Phase 6 Part C)

- **Help panel** (`HelpPanel`): a **?** button in the top bar (beside Settings)
  opens a modal listing tools + keyboard shortcuts, grouped (Tools / Edit /
  Drawing & placement / View). It is a short, skimmable reference — no guided
  tour. **The shortcut list (`SHORTCUT_GROUPS` in `HelpPanel.tsx`) is
  HAND-MAINTAINED** and is NOT derived from the keymap/toolbar: whenever a tool
  shortcut (`useGlobalShortcuts.ts` / `Toolbar.tsx`) or an edit/rotate/copy-paste
  binding changes, update that list too or the panel silently drifts. A prominent
  comment at the list says so.
- **Empty-state nudge:** when the **active level has no walls** (the primary
  "nothing to see" case), the plan shows a faint centered hint
  ("Draw a wall to begin", `.plan-empty-hint`). It is **non-interactive**
  (`pointer-events: none`), is **contextual** (reappears if the user deletes
  every wall — keyed off `walls.length === 0`, not first-visit), and is plan-only
  (a simple centered text hint, never pointing at the toolbar).

## Verification (do this every session)

- `npm run dev` must start clean; interact with the changed features and check the
  browser console for errors/warnings.
- `npm test` (Vitest) must pass. New pure-geometry functions require tests:
  snapping, `wallToBoxes`, plan→world mapping, wall hit-testing helpers,
  polygon validity.
- `npm run build` must succeed before finishing a session.
- Keep `README.md` current: how to run, current feature list, controls/shortcuts.

## Scope guards

- **Desktop, mouse + keyboard only.** Do not write touch handling.
- Multiple levels are supported (Phase 3c). Editing acts on the **active level**
  only; staircases are NOT built yet (a later session).
- Roofs exist (Phase 5e → 5.1 → 5.2: now a **manual** roof tool — user-placed
  rectangles, no auto-detection); ceiling-light fixtures exist (Phase 5f) but
  there is no real lighting/illumination design, and no measurements/dimension
  annotations beyond wall length labels.
- Accessibility basics only: focus styles, button labels, no exotic ARIA work.

## Phase plan

- **1a (foundation):** project scaffold, store + schema + undo, 2D plan editor with
  wall draw/select/drag/delete + properties panel, save/load, GitHub Pages deploy.
- **1b (preview):** 3D orthographic preview, rotation/zoom, the three wall view
  modes incl. invisible/ghost cutaway sub-option, Plan/3D/Split layout.
- **1c (surfaces & openings):** windows (tool + rendering via sub-boxes), paint
  tool with color wheel + swatches, floor-region tool with solid/pattern
  materials.
- **2+:** furniture, doors, multiple storeys + staircases, corner mitering,
  additional views. Do not start any of this without instruction.
