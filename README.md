# Home Design Visualizer

A browser-based home design tool. Draw walls in a 2D plan editor and see them
live in a 3D preview; later phases add windows, paint, and floor materials.
Everything runs client-side — no backend.

**Phase 1 + Phase 2 (doors, furniture).** A 2D plan editor with walls, windows,
doors, wall paint, floor regions, and a procedural furniture catalog, plus a live
3D preview with three wall view modes — all editing in 2D, the 3D view is
read-only.

## Tech stack

- Vite + React + TypeScript (strict)
- Zustand for application state (single source of truth)
- Plain React-rendered SVG for the 2D plan editor
- three + @react-three/fiber + @react-three/drei for the 3D preview
- Vitest for unit tests

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm test         # run unit tests
npm run build    # type-check + production build
npm run lint     # ESLint
npm run format   # Prettier
```

## Features

### Ceiling lights (phase 5f)

- Three **ceiling-attached fixtures** (pendant light, flush ceiling light,
  chandelier) hang from a level's ceiling. Pick one in the **Furniture** palette
  and click in the plan to place it; it hangs at the chosen **drop** below the
  ceiling with a connecting cord. Edit position, drop, size, and materials in the
  properties panel (all undoable); drag the plan marker to move it.
- Fixtures only — no real illumination; the shade reads as "lit". Hidden in
  **Stubs**, visible in **Cutaway** (the ceiling above is suppressed). Excluded
  from collision. Schema v10; round-trips through Export/Import.

### Roofs (phase 5.2 — manual roof tool)

- Roofs are **objects you place**, not auto-generated. Pick the **Roof tool**
  (left toolbar, under Stair; shortcut `O`) and **drag a rectangle** (grid-snapped,
  with live W × D labels) to drop a roof on the active level — gabled by default.
  Make an **L-shape** by placing **two rectangles**, each independent.
- **Select** a roof (Select tool) to edit it in the properties panel: **width**,
  **depth**, **rotation** (15° steps; also `R` / `Shift+R`), **type** (flat /
  gabled / hipped / pitched-shed), **pitch**, **overhang**, **material**, and a
  **Show this roof** toggle. Drag the body to move it; `Delete` removes it. All
  edits are undoable. A global **Show roofs** toggle lives in the **3D view bar**
  (beside Full / Cutaway / Stubs).
- Roofs **stay where you put them** — adding or copying a floor above never adds,
  moves, duplicates, or re-tops any roof. No auto-detection runs anywhere.
- In **Cutaway/Stubs** each roof suppresses like an upper floor slab so the
  interior stays visible; in **Full** it's solid. The flat roof is a real slab
  seated a hair above the wall tops (the `ROOF_LIFT` offset in
  `preview/stacking.ts`) so it never z-fights ("flickers") as the camera orbits.
- Pure tested geometry: per-rectangle `computeRoof` (`roof.ts`) built over the
  roof's local rectangle (`roofPlacement.ts`), then positioned/rotated in 3D.
  Round-trips through Export/Import; old auto-roof designs migrate to **no roofs**
  (you re-place them with the tool).

### Corner posts (phase 5d)

- Junctions where thick walls meet get a small **corner post** so corners read
  clean in 3D (no notch/overlap artifact) — not true mitering. Pure tested
  `cornerPosts(walls)` finds L-corners, T-junctions, and multi-wall junctions; the
  posts honor the level's **Cutaway/Stubs** view mode like walls.

### Wall dimensions (phase 5c)

- **Dimensions** toggle (plan controls, persisted) shows a **length label on every
  wall** — not just while drawing. Labels run along each wall, offset slightly off
  it, flipped to never read upside-down, in meters with cm precision, and stay a
  constant readable size while panning/zooming. Plan-only. Walls too short to fit
  the text on screen are skipped (light de-clutter).

### Saved-design library (phase 5b)

- A **local, offline design library** backed by IndexedDB (`src/storage/library.ts`)
  replaces the old single-slot autosave. Each record holds `{ id, name, createdAt,
  modifiedAt, thumbnail, design }`.
- The **welcome screen** shows your recent designs with thumbnails — **Continue**
  (most recently modified), open any design, or start a **New** one. Inside the
  app, **My Designs** (top bar) lets you switch designs, plus **Save as copy**.
- **New / Open / Duplicate / Rename / Delete** (Delete confirms; you can't delete
  the design you're editing). Autosave writes the open design to its record and
  refreshes a small 3D **thumbnail** on save (not on every keystroke).
- An existing localStorage autosave is **migrated into the library** on first run
  (never lost). Per-design `schemaVersion` migrations still run on open.

### Image export (phase 5a)

- A single **Export image** button in the top bar (beside My Designs and
  Settings) opens a small menu to download a crisp **2× PNG** of the **2D plan**,
  the **3D image**, or **Both** (two files). The plan is framed to the design
  content like Fit view; the 3D image has a **Transparent 3D background** toggle
  that produces real alpha (no opaque background fill). Options for a pane that
  isn't currently shown (per the layout) are disabled.
- Built on a reusable `captureView` / `capture3D` / `capturePlan` utility in
  `src/lib/capture.ts` (the design library reuses it for thumbnails). The plan
  registers its capturer via `setPlanCapturer` and the 3D pane its handles via
  `setCaptureHandles`, so the top-bar menu can drive both.
- The design **document** (JSON) has its own unified **Design JSON** menu in the
  top bar (same popover style as Export image) with **Import JSON…** / **Export
  JSON** options.

### Fill Room (phase 3e)

- **Fill Room tool (G)** — click inside a fully enclosed room to fill its **floor**
  and/or paint its **interior wall faces** with the current material (choose Floor
  / Walls / Both in the panel). Enclosure is detected by a grid **flood-fill**
  bounded by the work area: walls become barriers, and if the flood leaks to the
  outside the room is reported "not fully enclosed" and nothing changes. The
  detected floor is traced to the wall inner faces (handles L-shaped rooms), only
  the room-facing wall side is painted, re-filling replaces rather than stacks,
  and a room containing a staircase still shows the stairwell hole. One undo step.

### Staircases (phase 3d)

- **Staircase tool (S)** — a ghost follows the cursor (grid-snapped); `R` /
  `Shift+R` rotate in 15° steps; click to place. Steps auto-fit the storey height.
  Placing a stair with no floor above **auto-creates** the floor above and ascends
  to it.
- **Opens the floor above** — the upper floor slab gets a real **hole** over the
  stair (built with `THREE.Shape` holes, no CSG), so the stair is visible from
  below and reachable from above. Drawing a floor region across the opening still
  renders the hole.
- Staircases are **collidable** (bulky footprint), selectable/draggable/rotatable
  in the plan with a properties panel (width, rotation, position, material), and
  pickable in 3D. The plan shows tread lines + an up arrow (lower level) and an
  "open below" void (upper level).

### Multiple levels / storeys (phase 3c)

- **Level list** (in the **Floors** dropdown beside Fit View, bottom floor at the
  bottom): add a floor above, rename inline, delete (with confirm; the last level
  can't be removed), and click a row to make it the **active** (editable) level —
  which collapses the dropdown. Floors use American naming (First floor, Second
  floor, … — no ground floor). The dropdown also holds the underlay toggle. All
  level changes are undoable; the active level persists across reloads.
- **Auto-stacked elevations:** a level's height is derived — the bottom floor sits
  at 0 and each floor above sits at the previous one's wall height + a 0.2 m slab.
- **Edit one level at a time** — the plan edits the active level; the level
  directly below shows as a faint, non-interactive **underlay** (toggle in the
  plan controls) so you can align to it.
- **3D shows the whole stacked building** by default, with an **Active level only**
  toggle to focus. Floor regions become real slabs. In **Cutaway** and **Stubs**,
  upper floor slabs are suppressed (Invisible/Ghost, like walls) so you can see
  the walls, floors, and furniture of **every** storey while orbiting; the ground
  slab stays solid. Walls connect between storeys (each upper level's walls extend
  down through the slab band) so no floor strip shows between levels. Fit view
  frames the whole building.

### Welcome screen & work area (phase 3b)

- **Welcome screen** on load: if you have a saved design, **Continue** resumes it
  untouched, or start a **New design**; first-timers go straight to the size
  chooser. Pick a work-area size — **Small** (100 m² → 10 × 10 m), **Medium**
  (300 m² → ≈17.3 × 17.3 m), **Large** (1000 m² → ≈31.6 × 31.6 m), or a custom
  width × depth — and the editor opens framed on it.
- **Work area ("site")** — a *soft* buildable rectangle stored in the design
  (origin at the top-left corner). The 2D plan shades it, labels its dimensions,
  and de-emphasizes the grid outside it; the 3D ground shows it as a lighter lot.
  The boundary is never enforced — you can draw and place outside it.
- **Resize area** (top-bar button, left of New) grows or shrinks the site (preset or custom)
  without moving or deleting anything — it's a normal undoable action, so items
  left outside a shrink stay put.
- **Fit view** in the 2D plan (sibling of the 3D one) frames the site plus
  everything drawn, with a margin; it frames just the site when empty.

### 2D plan editor (phase 1a)

- **SVG plan editor** with pan, cursor-centered zoom, and a multi-tier grid
  (0.1 m minor / 1 m major lines that fade in and out with zoom).
- **Wall tool** — click to start, live preview segment with a length label, click
  to commit, chained drawing, endpoint + grid snapping, angle constraint.
- **Room mode** — a sub-mode of the Wall tool (Draw / Room toggle in the panel):
  drag a rectangle to drop four joined walls (shared corners) with live width ×
  depth labels; one undo removes the whole room.
- **Auto-snap / heal** — wall endpoints fuse onto a nearby endpoint (exact, fixing
  short/overshoot) or onto a wall face (T-junction) within 0.2 m, else grid-snap; a
  green ring shows the active snap. Applies to drawing, the room tool, endpoint
  dragging, and copy-to-floor-above.
- **Copy walls to floor above** — duplicate the active level's walls (or just the
  selected wall) with their openings onto the floor above (created if needed);
  exact duplicates are skipped. One undo step.
- **Select tool** — click to select (respects wall thickness), drag endpoints,
  drag the whole wall, edit length / thickness / height in the properties panel,
  delete.
- **Undo / redo** for every committed action; a full drag is a single undo step.
- **Copy / paste** (`Ctrl/Cmd`+`C` / `Ctrl/Cmd`+`V`) — duplicate the selected
  wall, furniture item, roof, staircase, or ceiling light. The copy lands a touch
  offset from the original on the **active** level and is selected; the clipboard
  survives floor switches, so you can copy on one floor and paste on another. A
  copied wall brings its windows/doors/wall-mounts along (under fresh ids).
- **Persistence** — the open design autosaves (debounced) to its record in the
  design library (see below), plus New / Export JSON / Import JSON. Imports are
  validated against the schema version and added as a new library record.
- All lengths are in **meters**, snapped to a **0.1 m** grid.

### 3D preview (phase 1b)

- **Live orthographic preview** derived from the same store as the plan — drawing,
  moving, or deleting a wall updates the 3D view instantly.
- **Orbit + zoom** (drag to orbit, wheel to zoom); the camera is clamped so it
  never drops below the floor. **Fit view** frames the whole design.
- **Three wall view modes:**
  - **Full** — all walls render normally.
  - **Cutaway** — walls between the camera and the interior are suppressed and
    handed off smoothly as you orbit, so the interior stays visible. A sub-toggle
    chooses **Invisible** (not drawn) or **Ghost** (~15% opacity).
  - **Stubs** — all walls render at 10% height.
- **Selection echo** — the wall, window, or floor selected in the plan is
  highlighted in 3D.
- **3D furniture picking** — hover a furniture item in the 3D view to highlight it
  (pointer cursor); click to select it, which highlights it in the plan and fills
  the properties panel — the same single selection as clicking it in the plan.
  Clicking empty space deselects, and an orbit drag never changes the selection.
  Only furniture is pickable; selection is the only thing you can do in 3D
  (moving/rotating/editing still happens in the 2D plan).
- **Stacking offsets** — the ground plane, floor regions, flat items (rugs), and
  regular furniture each sit on their own tiny vertical layer (named constants in
  `preview/stacking.ts`) so overlapping/stacked items never share an exact height
  and z-fight.
- **Flat items** (rugs/mats) are thin solid boxes rendered double-sided, so they
  stay fully visible at every orbit angle (no edge-on or overhead vanishing).
- **Automatic surface stacking** — small items (microwave, bedside lamp) placed
  with their centre over a surface item (counter, table, dresser, nightstand…)
  automatically rest on that surface's top instead of being buried inside it;
  surfaces can stack on surfaces. It resolves live from the plan positions as you
  drag — move an item off the surface and it drops back to the floor.
- **Layout:** **Plan / Split / 3D** (Split is the default). The view mode,
  cutaway style, layout, and current material persist across reloads (separate
  from the design).

### Surfaces & openings (phase 1c)

- **Window tool (N)** — hover a wall to preview a window (invalid spots show
  red), click to place. Windows are selectable, drag along their wall, and edit
  (width / height / sill / position) in the panel. In 3D the opening is a real
  hole (sub-boxes) with a translucent glass pane that ghosts/suppresses with its
  wall and disappears in Stubs mode.
- **Paint tool (P)** — hover a wall to highlight the **near side**, click to
  paint that face with the current material. Each wall's two sides are also
  editable from its properties panel (the chips highlight their side on hover).
- **Floor tool (F)** — click to outline a region with grid + endpoint snapping
  and a live closing preview; click the first point or press `Enter` to close
  (`Backspace` removes the last point, `Esc` cancels). Self-intersecting outlines
  are rejected. Floors fill the plan beneath walls and render as flat meshes in
  3D in all view modes.
- **Material picker** — preset swatches, a color wheel + hex input for solids,
  and seven procedural patterns with two colors each; patterns render as textures
  in both the plan and 3D. The interior patterns (checker, planks, tile, stripes)
  are two-tone; the **landscape** patterns (**grass, water, gravel**) blend the
  two colors for a noisy/rippled look and are meant for outdoor floor regions
  (a lawn, pond, river, or path is just a floor polygon). **Water is opaque** —
  the watery look comes from the texture + sheen, not transparency. (Wood decking
  and stone paving use the existing planks / tile patterns.)

### Doors (phase 2a)

- **Door tool (D)** — hover a wall to preview a door (invalid spots show red),
  click to place. The plan shows the standard architectural symbol — a gap, the
  open leaf, and a quarter-circle swing arc. Doors are selectable, drag along
  their wall, and edit (width / height / position / **hinge** / **swing side** /
  material) in the panel. In 3D the opening is a real hole with a slim frame and
  a closed leaf (solid or pattern); doors ghost/suppress with their wall and read
  as clean gaps in Stubs mode.
- **Schema v2** — designs now store `doors`; older (v1) designs migrate
  automatically on load/import (every wall gains an empty `doors` array).

### Furniture (phase 2b)

- **Furniture tool (U)** — the right panel becomes a catalog palette grouped by
  category, each item shown as a rendered plan symbol. Pick an item, then a ghost
  footprint follows the cursor (grid-snapped); `R` / `Shift+R` rotate in 15°
  steps, click to place (the tool stays active for repeat placement), `Esc`
  cancels. **Wall-hugger soft snap:** items like sofas and beds snap their back
  edge flush to a nearby wall and align to it (works on angled walls too).
- **Select tool** — furniture is selectable (rotation-aware footprint), draggable,
  rotates with `R` / `Shift+R`, and deletes. The properties panel shows position,
  rotation, **size**, and one material chip per part slot, with Reset buttons.
  Overlap is allowed (rugs under beds, chairs under tables).
- **Resizing (phase 2c)** — each item declares a scaling policy and the panel
  shows matching **Size** controls in real-world meters: a single control for
  proportional items (lamps, chairs), one per free axis for items that stretch
  (Width/Depth/Height — e.g. a sofa widens, a rug stretches in both floor axes
  but never gets taller), or a "fixed size" note for standardised items (e.g. the
  microwave). Each control is a **slider plus an editable number field** showing
  the resulting dimension in metres — type "1.80" straight into a Width field.
  Ranges are deliberately generous (proportional items roughly ½×–2½×, free axes
  up to ~4×); out-of-range entries clamp to the boundary and the field snaps to
  the clamped value. **Reset size** restores the catalog default. Scaling drives
  the 3D mesh, the plan symbol, and hit-testing / wall-hugger snapping alike,
  participates in undo/redo, and round-trips through Export/Import.
- **Collision** (Settings → gear in the top bar, by Undo/Redo) — **Off** / **Soft** (default) /
  **Hard**. Bulky items collide by 2D footprint on the same level — with each
  other, with staircases, **with walls** (so furniture can't be pushed through a
  wall), and **with stairwell openings** (so furniture can't float over the floor
  hole a staircase rises through); flat/decor items (rugs, lamps, plant,
  microwave, mirror…) never collide.
  Soft tints
  overlapping items red (2D + 3D) but still lets you drop them; Hard blocks an
  overlapping placement, reverts a drag to its last clear spot, and undoes a
  rotate/scale that would overlap.
- **Height-aware collision (phase 4d)** — collision now also checks vertical
  extents and **tuck-under**: a dining chair tucks fully under a dining table, a
  bar stool under the kitchen island, an office chair under a desk — no false
  collision. Leggy items declare `legClearance` (open space under the top) and
  tuckable items a `tuckHeight` (seat height); a tuckable fits under a leggy item
  when its tuck height clears. Two chairs, a chair vs a wardrobe, and a chair vs a
  **wall** all still collide (walls/stairwell openings stay hard barriers — no
  tuck-under).
- **Paint tool** — clicking a furniture item recolors its primary slot in one
  click; per-slot chips remain the precise route. Patterns work on furniture.
- **Catalog instances reference a catalog id, never geometry.** Items are
  procedural (shared box / rounded-box / cylinder primitives) and render in all
  three wall view modes. Open `#catalog` in the URL for a 3D QA line-up of every
  item. **Schema v4** adds per-item `scale` (v3 adds `furniture`); older designs
  migrate automatically.

**Catalog (71):**

- _Living:_ 3-seat sofa, sectional sofa, loveseat, armchair, ottoman, coffee
  table, side table, console table, TV stand, fireplace, rug, bookshelf, floor
  lamp, potted plant, books.
- _Bedroom:_ double bed, single bed, nightstand, wardrobe, dresser, dressing
  table, bed bench, crib, bedside lamp, full-length mirror.
- _Kitchen / dining:_ counter unit, upper cabinet, pantry cabinet, kitchen
  island, fridge, stove, dishwasher, microwave, dining table, dining chair, bar
  stool, bench, kettle, toaster, coffee maker.
- _Bathroom:_ toilet, bidet, sink vanity, bathtub, shower stall, towel rack,
  bathroom cabinet.
- _Office:_ desk, office chair, filing cabinet, desk lamp, computer (the
  bookshelf is reused for the office too).
- _Utility / laundry:_ washing machine, dryer.
- _Outdoor:_ patio table, patio chair, sun lounger, parasol, BBQ grill, garden
  bench, planter box, fire pit, tree, shrub, fence panel.
- _Wall-mounted (phase 4d):_ framed wall art, wall-mounted TV, floating shelf,
  wall sconce, wall mirror, range hood.

The new **surface items** (computer, kettle, toaster, coffee maker, books) are
decor that auto-rest on a counter/desk/table/shelf via the existing surface
stacking and never collide.

**Shape variants (phase 4c).** Trees and shrubs come in three shapes each so
gardens have variety. Each is a **single catalog id plus a `variant` field**
(not duplicate items), and shows in the palette as one button per variant:

- _Tree:_ **Broadleaf** (rounded canopy), **Conifer** (tall layered evergreen),
  **Ornamental** (slender trunk, small oval canopy).
- _Shrub:_ **Spreading** (low hedge-type — stretch it along its length to make a
  divider), **Rounded** (compact dome), **Columnar** (tall, narrow).

Each variant reads distinctly in both 3D and the 2D plan symbol. **Scaling still
applies on top** (a conifer scales uniformly; a spreading shrub stretches in
length), so size variety is independent of shape. Pick a variant when placing
from the palette, or switch it on a selected item from the **Variant** buttons in
the properties panel (undoable). **Schema v7** adds the optional `variant` field;
older designs migrate automatically — pre-4c trees become Broadleaf and hedges
become the Spreading shrub (kept at their original width).

### Wall-mounted items (phase 4d)

Wall items attach to a **wall face** as children of the wall — exactly like
windows and doors — so they move with the wall and are deleted with it.

- **Placement** — pick a wall item in the Furniture palette (framed wall art,
  wall-mounted TV, floating shelf, wall sconce, wall mirror, range hood). The
  ghost snaps to the nearest wall face at the cursor, on the side you're hovering,
  at the item's default height; click to attach, `Esc` cancels, the tool stays
  active. Their `footprint` is read as _width along the wall × protrusion out_,
  and `height` is the vertical size.
- **3D** — rendered on the chosen face, protruding outward, centred at the height
  up the wall. In **Cutaway** a mount follows its wall's Invisible/Ghost
  suppression; in **Stubs** it's hidden (it sits above stub height, like windows).
  The wall mirror's glass is an opaque pale material (no real transparency).
- **2D plan** — a small distinct marker on the wall at the mount's position and
  side (height isn't visible top-down). Mounts are **selectable in the plan**; the
  properties panel edits position along the wall, height up the wall, face A/B,
  size, and materials, plus Delete — all undoable.
- Mounts don't participate in furniture collision and don't wall-hug or
  floor-stack. **Schema v8** adds `mounts` to every wall; older designs migrate
  automatically. Auto-stacking _onto_ a wall shelf is out of scope (a shelf can't
  know its wall height from a top-down plan position), so the floating shelf is
  decorative for now.

_Deferred to a future ceiling-attach pass: curtains, pendant / ceiling lights._

## Controls & keyboard shortcuts

| Action                    | Control                                     |
| ------------------------- | ------------------------------------------- |
| Select tool               | `V`                                         |
| Wall tool                 | `W`                                         |
| Window tool               | `N`                                         |
| Door tool                 | `D`                                         |
| Floor tool                | `F`                                         |
| Paint tool                | `P`                                         |
| Fill Room tool            | `G`                                         |
| Staircase tool            | `S`                                         |
| Roof tool                 | `O`                                         |
| Furniture tool            | `U`                                         |
| Rotate furniture / roof / ghost | `R` (+15°) · `Shift`+`R` (−15°)       |
| Draw / place point        | Click (Wall / Floor tools)                  |
| Chain walls               | Keep clicking                               |
| Finish wall chain         | `Enter` or double-click                     |
| Close floor outline       | Click the first point or `Enter`            |
| Remove last floor point   | `Backspace`                                 |
| Cancel current draw       | `Esc`                                       |
| Constrain to 0 / 45 / 90° | Hold `Shift` while drawing                  |
| Place a window            | Hover a wall, click (Window tool)           |
| Place a door              | Hover a wall, click (Door tool)             |
| Paint a wall face         | Hover the near side, click (Paint tool)     |
| Select wall/window/floor  | Click it (Select tool)                      |
| Move a wall / window      | Drag its body / drag along the wall         |
| Move an endpoint          | Drag an endpoint handle (Select tool)       |
| Delete selection          | `Delete` or `Backspace`                     |
| Copy selection            | `Ctrl/Cmd` + `C`                            |
| Paste copy                | `Ctrl/Cmd` + `V`                            |
| Pan                       | `Space`-drag or middle-mouse drag           |
| Zoom                      | Scroll wheel (centered on cursor)           |
| Undo                      | `Ctrl/Cmd` + `Z`                            |
| Redo                      | `Ctrl/Cmd` + `Shift` + `Z`, or `Ctrl` + `Y` |
| Orbit the 3D view         | Drag in the 3D preview                      |
| Zoom the 3D view          | Scroll wheel in the 3D preview              |
| Frame the design (3D)     | **Fit view** button                         |
| Wall view mode            | **Full / Cutaway / Stubs** (above 3D view)  |
| Cutaway style             | **Invisible / Ghost** (Cutaway mode only)   |
| Layout                    | **Plan / Split / 3D** (top bar)             |

## Project structure

```
src/
  model/         schema-v1 types + defaults/factories
  geometry/      pure geometry (snap, hit-test, mapping, wallToBoxes, cutaway,
                 windows, polygon) + tests
  materials/     material cache keys (tested) + procedural pattern textures
  catalog/       furniture catalog: primitive helpers + 74 procedural items + scaling
  store/         Zustand store with undo/redo + view prefs + tests
  persistence/   localStorage autosave, JSON import/export, view prefs + tests
  components/     TopBar, Toolbar, PlanEditor (SVG), PropertiesPanel, LayoutToggle
    material/     reusable material picker, chips, thumbnails
    preview/      3D preview: Canvas/scene, wall + floor meshes, cutaway, camera
  hooks/          global shortcuts, autosave
  lib/            small UI utilities
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
`.github/workflows/deploy.yml`, which builds the app and deploys it to GitHub
Pages. The Vite `base` is set to `/Home-Design/` for the project page. Enable
Pages for the repo with the **GitHub Actions** source.
