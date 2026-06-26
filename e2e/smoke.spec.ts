import { test, expect, type ConsoleMessage } from "@playwright/test";
import {
  APP_URL,
  enterEditor,
  drawWall,
  selectTool,
  activeWalls,
  site,
} from "./helpers";

// Console noise we deliberately ignore: the Vercel analytics / speed-insights
// scripts are dev/ad-blocker noisy (debug logs + 404s for /_vercel/insights),
// and are unrelated to app health.
function isIgnorableConsole(msg: ConsoleMessage): boolean {
  const text = msg.text().toLowerCase();
  const url = msg.location().url.toLowerCase();
  return (
    text.includes("vercel") ||
    text.includes("insights") ||
    text.includes("analytics") ||
    url.includes("_vercel") ||
    url.includes("vercel") ||
    // A 404 for the analytics script surfaces as a generic resource error.
    (text.includes("failed to load resource") && url.includes("vercel"))
  );
}

// Smoke tests — the high-value integration regressions that have actually bitten
// this project (white-screen on New, off-screen overflow menu, boot failures).
// All assertions are on DOM / store state, never on 3D canvas pixels.

test("app boots clean into the editor with no crash or console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isIgnorableConsole(msg))
      errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(APP_URL);
  // Welcome screen renders (the size chooser on a fresh browser).
  await expect(page.getByTestId("site-confirm")).toBeVisible();

  // Enter the editor.
  await page.getByTestId("site-confirm").click();
  await expect(page.getByTestId("editor")).toBeVisible();
  await expect(page.getByTestId("plan-svg")).toBeVisible();

  // The ErrorBoundary fallback is NOT shown, and nothing logged to console.error.
  await expect(page.getByTestId("error-boundary")).toHaveCount(0);
  expect(errors, `unexpected console errors:\n${errors.join("\n")}`).toEqual(
    [],
  );
});

test("New design with content lands clean (React #185 regression)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await enterEditor(page);

  // Draw a wall so the document has content — this is the exact case that used
  // to white-screen when "New" swapped the document under a live editor.
  await selectTool(page, "wall");
  await drawWall(page, { x: 2, y: 2 }, { x: 6, y: 2 });
  expect(await activeWalls(page)).toHaveLength(1);

  // New → choose a (distinct) size in the dialog → confirm.
  await page.getByTestId("new-design").click();
  await expect(page.getByTestId("new-design-dialog")).toBeVisible();
  // Pick the Medium preset (300 m² ≈ 17.3 × 17.3) so the chosen size is clearly
  // different from the default, then confirm.
  await page.getByRole("button", { name: /Medium/ }).click();
  await page.getByTestId("site-confirm").click();

  // We land back in a clean, empty editor — no crash, no ErrorBoundary, the wall
  // is gone, and the site matches the chosen size.
  await expect(page.getByTestId("editor")).toBeVisible();
  await expect(page.getByTestId("error-boundary")).toHaveCount(0);
  expect(await activeWalls(page)).toHaveLength(0);
  const s = await site(page);
  expect(s.width).toBeCloseTo(Math.sqrt(300), 1);
  expect(s.depth).toBeCloseTo(Math.sqrt(300), 1);
  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
});

test("overflow menu stays within the viewport when the bar is narrow", async ({
  page,
}) => {
  // Narrow viewport forces the top bar to collapse low-priority actions into "⋯".
  await page.setViewportSize({ width: 520, height: 720 });
  await enterEditor(page);

  const more = page.getByTestId("overflow-more");
  await expect(more).toBeVisible();
  await more.click();

  const menu = page.getByTestId("overflow-menu");
  await expect(menu).toBeVisible();

  // The menu must stay within the viewport bounds (the original bug ran it off
  // the right edge of the window).
  const vp = page.viewportSize()!;
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

  // A known item inside the menu is reachable/clickable (Resize area overflows
  // first by priority). Clicking it opens its dialog.
  const resize = menu.getByRole("button", { name: /Resize area/ });
  await expect(resize).toBeVisible();
  await resize.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the overflow '⋯' button is absent at a wide viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await enterEditor(page);
  await expect(page.getByTestId("overflow-more")).toHaveCount(0);
});

test("a drawn wall persists across reload (autosave + library)", async ({
  page,
}) => {
  await enterEditor(page);

  await selectTool(page, "wall");
  await drawWall(page, { x: 2, y: 2 }, { x: 6, y: 2 });
  expect(await activeWalls(page)).toHaveLength(1);

  // Give the debounced autosave (500ms) time to flush to IndexedDB.
  await page.waitForTimeout(900);

  // Reload: the welcome screen now offers Continue (a saved design exists).
  await page.goto(APP_URL);
  const cont = page.getByRole("button", { name: /Continue/ });
  await expect(cont).toBeVisible();
  await cont.click();

  await expect(page.getByTestId("editor")).toBeVisible();
  // The wall survived the round-trip through the library.
  expect(await activeWalls(page)).toHaveLength(1);
});
