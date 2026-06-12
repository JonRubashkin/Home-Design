# Home Design Visualizer

A browser-based home design tool. Draw walls in a 2D plan editor and see them
live in a 3D preview; later phases add windows, paint, and floor materials.
Everything runs client-side — no backend.

**Phase 1 complete (1a + 1b + 1c).** A 2D plan editor with walls, windows, wall
paint, and floor regions, plus a live 3D preview with three wall view modes —
all editing in 2D, the 3D view is read-only.

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

### 2D plan editor (phase 1a)

- **SVG plan editor** with pan, cursor-centered zoom, and a multi-tier grid
  (0.1 m minor / 1 m major lines that fade in and out with zoom).
- **Wall tool** — click to start, live preview segment with a length label, click
  to commit, chained drawing, endpoint + grid snapping, angle constraint.
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

## Controls & keyboard shortcuts

| Action                    | Control                                     |
| ------------------------- | ------------------------------------------- |
| Select tool               | `V`                                         |
| Wall tool                 | `W`                                         |
| Window tool               | `N`                                         |
| Floor tool                | `F`                                         |
| Paint tool                | `P`                                         |
| Draw / place point        | Click (Wall / Floor tools)                  |
| Chain walls               | Keep clicking                               |
| Finish wall chain         | `Enter` or double-click                     |
| Close floor outline       | Click the first point or `Enter`            |
| Remove last floor point   | `Backspace`                                 |
| Cancel current draw       | `Esc`                                       |
| Constrain to 0 / 45 / 90° | Hold `Shift` while drawing                  |
| Place a window            | Hover a wall, click (Window tool)           |
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
