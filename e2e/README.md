# End-to-end tests (Playwright)

Small, deterministic browser tests for EZ Design Homes. Run from the repo root:

```bash
npm run test:e2e      # headless; auto-starts the Vite dev server
npm run test:e2e:ui   # interactive Playwright UI
```

First run locally: `npx playwright install --with-deps chromium`.

## Layout

- `smoke.spec.ts` — boot/regression smoke tests (clean boot, New-with-content
  doesn't white-screen, overflow "⋯" menu stays on-screen, reload persistence).
- `drawing.spec.ts` — core 2D drawing flows (wall, room, select+delete, Fill Room).
- `helpers.ts` — editor entry, the test-only store reads, plan↔client coordinate
  mapping, and the pointer-driven drawing helpers.

## Conventions

- **Assert on DOM and app/store state, never on 3D WebGL canvas pixels.** The
  Three.js preview is intentionally not pixel-tested (a possible future tier).
- Prefer stable `data-testid` selectors.
- The app is loaded with `?e2e=1`, which exposes a tiny read-only store accessor
  at `window.__EZ_TEST__` (see `src/store/store.ts`). It exists only under that
  flag and changes no app behavior.

See the root `README.md` ("Testing") for the full description and CI behavior.
