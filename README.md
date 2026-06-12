# Home Design Visualizer

A browser-based home design tool. Draw walls in a 2D plan editor; later phases add
a live 3D preview, windows, paint, and floor materials. Everything runs
client-side — no backend.

**Current phase: 1a** — project foundation and the 2D plan editor (wall
draw / select / edit / delete, undo/redo, autosave, JSON import/export).
There is no 3D preview yet; that arrives in phase 1b.

## Tech stack

- Vite + React + TypeScript (strict)
- Zustand for application state (single source of truth)
- Plain React-rendered SVG for the 2D plan editor
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

## Features (phase 1a)

- **2D plan editor (SVG)** with pan, cursor-centered zoom, and a multi-tier grid
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

## Project structure

```
src/
  model/         schema-v1 types + defaults/factories
  geometry/      pure geometry functions (snapping, hit-testing, mapping) + tests
  store/         Zustand store with undo/redo + tests
  persistence/   localStorage autosave + JSON import/export + tests
  components/     TopBar, Toolbar, PlanEditor (SVG), PropertiesPanel
  hooks/          global shortcuts, autosave
  lib/            small UI utilities
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
`.github/workflows/deploy.yml`, which builds the app and deploys it to GitHub
Pages. The Vite `base` is set to `/Home-Design/` for the project page. Enable
Pages for the repo with the **GitHub Actions** source.
