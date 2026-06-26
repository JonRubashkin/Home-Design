import { defineConfig, devices } from "@playwright/test";

// Playwright end-to-end config. The E2E suite is deliberately small and lives in
// `e2e/`, kept entirely separate from the Vitest unit tests under `src/` (Vitest
// excludes `e2e/**`; Playwright only picks up this folder) so the two runners
// never collide. We assert on DOM and app/store state — never on the 3D WebGL
// canvas pixels (deliberately out of scope; see e2e/README.md / the app README).
//
// The app is served by the Vite dev server, auto-started (and reused if already
// running) via the `webServer` option below. Chromium only for now.

const PORT = Number(process.env.E2E_PORT ?? 5179);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // A small, deterministic suite — run files in parallel but keep it tight.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["list"]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Auto-start the Vite dev server for tests and reuse a running one locally.
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
