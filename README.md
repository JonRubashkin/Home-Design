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

### Multiple levels / storeys (phase 3c)

- **Level list** (docked, ground floor at the bottom): add a floor above, rename
  inline, delete (with confirm; the last level can't be removed), and click a row
  to make it the **active** (editable) level. All level changes are undoable; the
  active level persists across reloads.
- **Auto-stacked elevations:** a level's height is derived — ground sits at 0 and
  each floor above sits at the previous one's wall height + a 0.2 m floor slab.
- **Edit one level at a time** — the plan edits the active level; the level
  directly below shows as a faint, non-interactive **underlay** (toggle in the
  plan controls) so you can align to it.
- **3D shows the whole stacked building** by default, with an **Active level only**
  toggle to focus. Floor regions become real slabs. In **Cutaway** and **Stubs**,
  upper floor slabs are suppressed (Invisible/Ghost, like walls) so you can see
  the walls, floors, and furniture of **every** storey while orbiting; the ground
  slab stays solid. Fit view frames the whole building.

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
- **Resize area** (plan button) grows or shrinks the site (preset or custom)
  without moving or deleting anything — it's a normal undoable action, so items
  left outside a shrink stay put.
- **Fit view** in the 2D plan (sibling of the 3D one) frames the site plus
  everything drawn, with a margin; it frames just the site when empty.

### 2D plan editor (phase 1a)

- **SVG plan editor** with pan, cursor-centered zoom, and a multi-tier grid
  (0.1 m minor / 1 m major lines that fade in and out with zoom).
- **Wall tool** — click to start, live preview segment with a length label, click
  to commit, chained drawing, endpoint + grid snapping, angle constraint.
- **Room tool** — drag a rectangle to drop four joined walls (shared corners) with
  live width × depth labels; one undo removes the whole room.
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
- **Persistence** — debounced autosave to localStorage, plus New / Export JSON /
  Import JSON. Imports are validated against the schema version.
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
  and four procedural patterns (checker, planks, tile, stripes) with two colors
  each; patterns render as textures in both the plan and 3D.

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
- **Paint tool** — clicking a furniture item recolors its primary slot in one
  click; per-slot chips remain the precise route. Patterns work on furniture.
- **Catalog instances reference a catalog id, never geometry.** Items are
  procedural (shared box / rounded-box / cylinder primitives) and render in all
  three wall view modes. Open `#catalog` in the URL for a 3D QA line-up of every
  item. **Schema v4** adds per-item `scale` (v3 adds `furniture`); older designs
  migrate automatically.

**Catalog (31):**

- _Living:_ 3-seat sofa, armchair, coffee table, TV stand, rug, bookshelf, floor
  lamp, side table, console table, potted plant.
- _Bedroom:_ double bed, single bed, nightstand, wardrobe, dresser, bedside lamp,
  full-length mirror.
- _Kitchen / dining:_ counter unit, upper cabinet, fridge, microwave, dining
  table, dining chair, bar stool, bench.
- _Bathroom:_ toilet, sink vanity, bathtub, shower stall, towel rack, bathroom
  cabinet.

## Controls & keyboard shortcuts

| Action                    | Control                                     |
| ------------------------- | ------------------------------------------- |
| Select tool               | `V`                                         |
| Wall tool                 | `W`                                         |
| Window tool               | `N`                                         |
| Door tool                 | `D`                                         |
| Floor tool                | `F`                                         |
| Paint tool                | `P`                                         |
| Furniture tool            | `U`                                         |
| Rotate furniture / ghost  | `R` (+15°) · `Shift`+`R` (−15°)             |
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
  catalog/       furniture catalog: primitive helpers + 31 procedural items + scaling
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
