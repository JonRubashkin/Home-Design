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
  schemaVersion: 4;         // v1 = Phase 1; v2 = doors; v3 = furniture;
                            // v4 = furniture scale. Migrations in
                            // src/model/migrations.ts upgrade older saved designs.
  name: string;
  levels: Level[];          // Phase 1 uses exactly one level; the structure is
                            // multi-level NOW so storeys can be added without
                            // migration. Never hardcode levels[0] outside of a
                            // single "current level" selector.
}

interface Level {
  id: string;
  name: string;             // "Ground floor"
  elevation: number;        // world Y of this level's floor, meters. 0 for level 0.
  wallHeight: number;       // default height for new walls on this level (2.4)
  walls: Wall[];
  floors: FloorRegion[];
  furniture: FurnitureItem[]; // Phase 2b
}

interface FurnitureItem {   // Phase 2b. References a catalog id — never geometry.
  id: string;
  catalogId: string;        // e.g. "sofa-3seat"
  position: Vec2;           // plan coords of footprint CENTER
  rotation: number;         // degrees; UI rotates in 15° steps
  scale: Vec3;              // Phase 2c. per-axis multiplier, default {1,1,1};
                            // clamped to the catalog entry's `scaling` policy.
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
}

interface WindowOpening {
  id: string;
  t: number;                // center position along wall, 0..1 (exclusive of ends)
  width: number;            // meters
  height: number;           // meters
  sillHeight: number;       // meters from floor to bottom of window
}

interface DoorOpening {     // Phase 2a. Like a window but sits on the floor.
  id: string;
  t: number;                // center along wall, 0..1
  width: number;            // meters (default 0.9)
  height: number;           // meters (default 2.0)
  hinge: "start" | "end";   // hinge side relative to wall start→end direction
  swing: "A" | "B";         // which wall side the door opens toward
  material: MaterialRef;    // leaf material (default solid #9a6b4f)
}

interface FloorRegion {
  id: string;
  polygon: Vec2[];          // user-drawn, grid-snapped, >= 3 points, plan coords
  material: MaterialRef;
}

interface Vec2 { x: number; y: number; }
interface Vec3 { x: number; y: number; z: number; }

// Materials are data, never baked into meshes. Furniture and future features
// reuse this exact system.
type MaterialRef =
  | { kind: "solid"; color: string }                              // hex
  | { kind: "pattern"; pattern: PatternId; colorA: string; colorB: string };

type PatternId = "checker" | "planks" | "tile" | "stripes";
```

Pattern textures are generated procedurally at runtime onto small offscreen
canvases and used as repeating Three.js textures. No image assets.

## Furniture catalog (Phase 2b)

Furniture instances reference a **catalog id**, never geometry. The catalog lives
in code under `src/catalog/`:

- Each `CatalogEntry` declares `id`, `name`, `category`
  (`living | bedroom | kitchen | bathroom`), `footprint` (width × depth, meters),
  `height`, `wallHugger`, an optional `flat` flag (rugs: above floors, below other
  furniture), optional `surfaceTop` (local meters — marks a support surface) and
  `stackable` (small item that auto-climbs onto a surface), a `scaling` policy
  (see below), ordered named material `slots`
  (slot[0] is the primary slot the Paint tool recolors), a pure `build()` that
  returns `Part[]` (composed from shared `box` / `roundedBox` / `cylinder`
  primitives in local space, y up from the floor, +z = front), and a `glyph(w,d)`
  that returns the distinguishing 2D plan marks.
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
  `#catalog` in the URL opens a dev-only 3D QA line-up of every item.

## State, undo, persistence

- One Zustand store holds: the `Design`, the current level id, the active tool, the
  current selection, view settings, and undo/redo history.
- **Every mutation goes through a named store action.** Components never write
  state directly.
- **Undo/redo from day one.** Implement as snapshots of the `Design` (structurally
  shared or deep-cloned — design docs are small) pushed on each *committed* action.
  Mid-drag movements update a transient preview; history records only on commit
  (mouse-up). Ctrl+Z / Ctrl+Shift+Z (and Ctrl+Y). Cap history at 100 entries.
- **Persistence:** autosave the `Design` JSON to localStorage (debounced), plus
  explicit "Export JSON" (file download) and "Import JSON" (file picker). On load,
  check `schemaVersion`; if it's a future unknown version, refuse with a friendly
  message rather than corrupting data.

## Geometry rules

- **No CSG libraries.** Window holes are made by composing each wall from
  axis-aligned-in-wall-space **sub-boxes**: for every window, the wall splits into
  a box under the sill, a box above the window head, and full-height boxes between
  openings. One pure function computes the sub-box list for a wall:
  `wallToBoxes(wall): Box3Spec[]` — unit test it heavily.
- **Corners:** simple overlap where thick walls meet is acceptable for now. Do not
  attempt mitering/joinery. (Future phase.)
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
  behind them.
- **Automatic surface stacking.** A `stackable` catalog item (microwave, lamp)
  whose footprint CENTER lies within a `surfaceTop` item's footprint (counter,
  table, dresser…) automatically rests on that surface's top instead of being
  buried inside it; surfaces can rest on surfaces (transitive). This is a pure
  render-side computation (`computeStackBaseLifts` in `geometry/furniture.ts`,
  tested) keyed off plan positions — elevation is invisible top-down, so it
  needs **no schema field or persistence**. It resolves live as items move; it is
  NOT a manual elevation control.

## 2D plan editor rules

- SVG with pan (space-drag or middle-drag) and zoom (wheel, cursor-centered).
  Visible grid (light minor lines every 0.1 m at high zoom, major every 1 m).
- Tools are explicit modes in a left toolbar with icons + labels + keyboard
  shortcuts shown in tooltips: **Select (V)**, **Wall (W)**, and in later phases
  Window (N), Floor (F), Paint (P).
- Wall tool: click to start, click to place end (live preview line + length label
  while drawing), Esc cancels; consecutive clicks chain walls; Enter/double-click
  ends the chain. Hold Shift to constrain to 0/45/90°.
- Select tool: click selects a wall (highlight in BOTH the plan and the 3D
  preview); drag an endpoint handle to move it; drag the wall body to translate
  the whole wall; Delete/Backspace removes it.
- A right-side **properties panel** shows the selection's editable fields (wall:
  length, thickness, height, later paint per side; window: width, sill height,
  position; floor: material) and a Delete button. Empty state shows tips.
- Layout: toolbar left, plan center, properties right, 3D preview either side-by-
  side with the plan or toggled via a Plan / 3D / Split control — Split is the
  default on wide screens.

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
- Single visible level in the UI (data model is multi-level).
- No doors yet. No furniture yet. No roof, no ceilings, no lighting design, no
  measurements/dimension annotations beyond live length labels while drawing.
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
