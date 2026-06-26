import { expect, type Page } from "@playwright/test";
import type { Vec2 } from "../src/model/types";

// Shared helpers for the Playwright E2E suite. We assert on DOM and app/store
// state — never on the 3D WebGL canvas pixels (out of scope). The store is read
// via a tiny test-only accessor (`window.__EZ_TEST__`) exposed ONLY when the
// page is loaded with `?e2e=1` (see src/store/store.ts).

// Always load the app with the e2e flag so the test-only store accessor mounts.
export const APP_URL = "/?e2e=1";

// ---- store accessor (only present under ?e2e=1) ---------------------------

// Minimal shape of what the test accessor exposes; mirrors src/store/store.ts.
interface TestLevel {
  walls: { id: string; start: Vec2; end: Vec2 }[];
  floors: { id: string }[];
}
interface TestState {
  started: boolean;
  selection: { kind: string; id?: string } | null;
  design: { name: string; site: { width: number; depth: number } };
}

// The walls on the currently-active level.
export function activeWalls(
  page: Page,
): Promise<{ id: string; start: Vec2; end: Vec2 }[]> {
  return page.evaluate(() => {
    const t = (
      window as unknown as { __EZ_TEST__?: { currentLevel: () => TestLevel } }
    ).__EZ_TEST__;
    if (!t) throw new Error("__EZ_TEST__ not present — load with ?e2e=1");
    return t.currentLevel().walls.map((w) => ({
      id: w.id,
      start: w.start,
      end: w.end,
    }));
  });
}

export function activeFloors(page: Page): Promise<{ id: string }[]> {
  return page.evaluate(() => {
    const t = (
      window as unknown as { __EZ_TEST__?: { currentLevel: () => TestLevel } }
    ).__EZ_TEST__;
    if (!t) throw new Error("__EZ_TEST__ not present — load with ?e2e=1");
    return t.currentLevel().floors.map((f) => ({ id: f.id }));
  });
}

export function selection(
  page: Page,
): Promise<{ kind: string; id?: string } | null> {
  return page.evaluate(() => {
    const t = (
      window as unknown as { __EZ_TEST__?: { getState: () => TestState } }
    ).__EZ_TEST__;
    if (!t) throw new Error("__EZ_TEST__ not present — load with ?e2e=1");
    return t.getState().selection;
  });
}

export function site(page: Page): Promise<{ width: number; depth: number }> {
  return page.evaluate(() => {
    const t = (
      window as unknown as { __EZ_TEST__?: { getState: () => TestState } }
    ).__EZ_TEST__;
    if (!t) throw new Error("__EZ_TEST__ not present — load with ?e2e=1");
    return t.getState().design.site;
  });
}

// ---- editor entry ---------------------------------------------------------

// Load the app and enter the editor from the welcome screen. On a fresh browser
// context (empty IndexedDB) the welcome screen shows the size chooser straight
// away; we confirm it to create a default design and land in the editor.
export async function enterEditor(page: Page): Promise<void> {
  await page.goto(APP_URL);
  await expect(page.getByTestId("site-confirm")).toBeVisible();
  await page.getByTestId("site-confirm").click();
  await expect(page.getByTestId("editor")).toBeVisible();
  // The plan surface is mounted and laid out before we try to draw on it.
  await expect(page.getByTestId("plan-svg")).toBeVisible();
}

// ---- plan coordinate mapping ----------------------------------------------

// Convert a plan-space point (meters) to client (screen) pixels using the live
// pan/zoom transform on the plan's [data-plan-content] group, so drawing helpers
// hit exact grid points regardless of the fit-to-view transform.
export async function planToClient(page: Page, pt: Vec2): Promise<Vec2> {
  const svg = page.getByTestId("plan-svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("plan-svg has no bounding box");
  const transform = await page
    .locator("[data-plan-content]")
    .getAttribute("transform");
  if (!transform) throw new Error("[data-plan-content] has no transform");
  const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(
    transform,
  );
  if (!m) throw new Error(`unexpected plan transform: ${transform}`);
  const panX = Number(m[1]);
  const panY = Number(m[2]);
  const scale = Number(m[3]);
  return {
    x: box.x + pt.x * scale + panX,
    y: box.y + pt.y * scale + panY,
  };
}

// ---- drawing helpers (drive real pointer events) --------------------------

// Select a tool via its toolbar button.
export async function selectTool(page: Page, tool: string): Promise<void> {
  await page.getByTestId(`tool-${tool}`).click();
}

// Draw one wall segment with the Wall tool (click start, click end). The Wall
// tool chains, so we press Escape afterwards to end the chain.
export async function drawWall(page: Page, a: Vec2, b: Vec2): Promise<void> {
  const A = await planToClient(page, a);
  await page.mouse.move(A.x, A.y);
  await page.mouse.down();
  await page.mouse.up();
  const B = await planToClient(page, b);
  await page.mouse.move(B.x, B.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press("Escape");
}

// Drag a rectangle from a → b (used by the Room and other drag tools).
export async function dragRect(page: Page, a: Vec2, b: Vec2): Promise<void> {
  const A = await planToClient(page, a);
  const B = await planToClient(page, b);
  await page.mouse.move(A.x, A.y);
  await page.mouse.down();
  // Move in a couple of steps so pointermove handlers see the drag.
  await page.mouse.move((A.x + B.x) / 2, (A.y + B.y) / 2);
  await page.mouse.move(B.x, B.y);
  await page.mouse.up();
}

// Click at a plan-space point (single click; used for select / fill).
export async function clickPlan(page: Page, pt: Vec2): Promise<void> {
  const P = await planToClient(page, pt);
  await page.mouse.move(P.x, P.y);
  await page.mouse.down();
  await page.mouse.up();
}
