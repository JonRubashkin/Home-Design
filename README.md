# Home Design Visualizer

A browser-based home design tool. Draw walls in a 2D plan editor and see them
live in a 3D preview; later phases add windows, paint, and floor materials.
Everything runs client-side — no backend.

**Current phase: 1b** — the live 3D preview (orthographic, orbit/zoom, three wall
view modes, selection echo) alongside the phase-1a 2D plan editor. Windows,
paint, and floor tools arrive in phase 1c.

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
- **Selection echo** — the wall selected in the plan is highlighted in 3D.
- **Layout:** **Plan / Split / 3D** (Split is the default). The view mode,
  cutaway style, and layout persist across reloads (separate from the design).

## Controls & keyboard shortcuts

| Action                    | Control                                     |
| ------------------------- | ------------------------------------------- |
| Select tool               | `V`                                         |
| Wall tool                 | `W`                                         |
| Draw / place point        | Click (Wall tool)                           |
| Chain walls               | Keep clicking                               |
| Finish wall chain         | `Enter` or double-click                     |
| Cancel current wall       | `Esc`                                       |
| Constrain to 0 / 45 / 90° | Hold `Shift` while drawing                  |
| Select a wall             | Click it (Select tool)                      |
| Move a wall               | Drag its body (Select tool)                 |
| Move an endpoint          | Drag an endpoint handle (Select tool)       |
| Delete selected wall      | `Delete` or `Backspace`                     |
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
  geometry/      pure geometry (snap, hit-test, mapping, wallToBoxes, cutaway) + tests
  store/         Zustand store with undo/redo + view prefs + tests
  persistence/   localStorage autosave, JSON import/export, view prefs + tests
  components/     TopBar, Toolbar, PlanEditor (SVG), PropertiesPanel, LayoutToggle
    preview/      3D preview: Canvas/scene, wall meshes, cutaway, camera fit
  hooks/          global shortcuts, autosave
  lib/            small UI utilities
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
`.github/workflows/deploy.yml`, which builds the app and deploys it to GitHub
Pages. The Vite `base` is set to `/Home-Design/` for the project page. Enable
Pages for the repo with the **GitHub Actions** source.
