import { test, expect } from "@playwright/test";
import {
  enterEditor,
  selectTool,
  drawWall,
  dragRect,
  clickPlan,
  activeWalls,
  activeFloors,
  selection,
} from "./helpers";

// Core 2D drawing-flow tests. Assertions are on store / DOM state, never on 3D
// canvas pixels. Coordinates are grid-aligned (0.1 m snap) so the snapped
// endpoints land exactly where intended.

test("Wall tool draws a single segment between two grid points", async ({
  page,
}) => {
  await enterEditor(page);
  await selectTool(page, "wall");

  await drawWall(page, { x: 2, y: 2 }, { x: 6, y: 2 });

  const walls = await activeWalls(page);
  expect(walls).toHaveLength(1);
  const w = walls[0]!;
  // Endpoints near the intended grid points (order-independent).
  const pts = [w.start, w.end];
  const near = (p: { x: number; y: number }, x: number, y: number) =>
    Math.abs(p.x - x) < 0.05 && Math.abs(p.y - y) < 0.05;
  expect(pts.some((p) => near(p, 2, 2))).toBeTruthy();
  expect(pts.some((p) => near(p, 6, 2))).toBeTruthy();

  // The wall is rendered in the plan (DOM cross-check).
  await expect(page.getByTestId("wall")).toHaveCount(1);
});

test("Room sub-mode creates four joined walls forming a closed loop", async ({
  page,
}) => {
  await enterEditor(page);
  await selectTool(page, "wall");
  // Switch the Wall tool to its Room sub-mode via the properties-panel control.
  await page.getByRole("button", { name: "Room", exact: true }).click();

  await dragRect(page, { x: 2, y: 2 }, { x: 7, y: 5 });

  const walls = await activeWalls(page);
  expect(walls).toHaveLength(4);
  await expect(page.getByTestId("wall")).toHaveCount(4);

  // Endpoints form a closed loop: every endpoint coincides with exactly one
  // other wall's endpoint (4 shared corners).
  const corners = new Map<string, number>();
  for (const w of walls) {
    for (const p of [w.start, w.end]) {
      const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      corners.set(key, (corners.get(key) ?? 0) + 1);
    }
  }
  expect(corners.size).toBe(4);
  for (const count of corners.values()) expect(count).toBe(2);
});

test("Select tool selects a wall, Delete removes it", async ({ page }) => {
  await enterEditor(page);
  await selectTool(page, "wall");
  await drawWall(page, { x: 2, y: 2 }, { x: 6, y: 2 });
  expect(await activeWalls(page)).toHaveLength(1);

  await selectTool(page, "select");
  // Click on the wall body (midpoint) to select it.
  await clickPlan(page, { x: 4, y: 2 });
  const sel = await selection(page);
  expect(sel?.kind).toBe("wall");

  await page.keyboard.press("Delete");
  expect(await activeWalls(page)).toHaveLength(0);
  await expect(page.getByTestId("wall")).toHaveCount(0);
});

test("Fill Room adds a floor region inside an enclosed room", async ({
  page,
}) => {
  await enterEditor(page);

  // Build an enclosed room with the Room sub-mode.
  await selectTool(page, "wall");
  await page.getByRole("button", { name: "Room", exact: true }).click();
  await dragRect(page, { x: 2, y: 2 }, { x: 7, y: 6 });
  expect(await activeWalls(page)).toHaveLength(4);
  expect(await activeFloors(page)).toHaveLength(0);

  // Fill Room (default target = both) — click inside the room.
  await selectTool(page, "fill");
  await clickPlan(page, { x: 4.5, y: 4 });

  expect(await activeFloors(page)).toHaveLength(1);
});
