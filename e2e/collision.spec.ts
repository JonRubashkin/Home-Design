import { test, expect } from "@playwright/test";
import { enterEditor, placeFurniture } from "./helpers";

// Elevation-aware collision (Part B). Furniture that hangs above the floor (an
// upper/wall cabinet) must NOT show the red collision warning against floor
// items beneath it — the vertical extents are clear. A genuine floor-vs-floor
// overlap must still warn. Assertions are on the plan DOM (the `.warn` class the
// red tint uses), never on 3D canvas pixels. Default collisionMode is "soft", so
// overlaps warn rather than block.

test("an upper cabinet over a counter does NOT warn (clear above)", async ({
  page,
}) => {
  await enterEditor(page);

  // Drop a counter and an upper cabinet at the SAME plan position: their
  // footprints fully overlap, so only the vertical extent separates them.
  await placeFurniture(page, "counter", { x: 4, y: 4 });
  await placeFurniture(page, "upper-cabinet", { x: 4, y: 4 });

  // Both items rendered in the plan...
  await expect(page.locator(".furn")).toHaveCount(2);
  // ...and neither shows the red collision warning (cabinet is clear above).
  await expect(page.locator(".furn.warn")).toHaveCount(0);
});

test("two overlapping floor items DO warn (guard not vacuous)", async ({
  page,
}) => {
  await enterEditor(page);

  // Two bulky floor-standing items at the same spot genuinely overlap.
  await placeFurniture(page, "counter", { x: 4, y: 4 });
  await placeFurniture(page, "fridge", { x: 4, y: 4 });

  await expect(page.locator(".furn")).toHaveCount(2);
  // Both are tinted with the red collision warning.
  await expect(page.locator(".furn.warn")).toHaveCount(2);
});
