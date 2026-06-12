import type { Wall } from "../model/types";
import { wallLength, wallDirection } from "./wall";
import { planToWorld } from "./mapping";
import { windowSpan } from "./windows";

// An oriented box in world space, ready to render as a Three.js BoxGeometry.
// `size` is [alongWall, height, thickness]; the box is rotated about world Y by
// `rotationY` so its local X axis follows the wall direction. `face` locates the
// box on the whole wall face (u0 = along-wall start, v0 = height start, w/h =
// extent, all metres) so textures can flow continuously across sub-boxes.
export interface FaceRect {
  u0: number;
  v0: number;
  w: number;
  h: number;
}

export interface Box3Spec {
  center: [number, number, number];
  size: [number, number, number];
  rotationY: number;
  face: FaceRect;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

// Decompose a wall into oriented sub-boxes. With no windows this is a single
// full box. Each window splits the wall into a box under the sill, a box above
// the head, and full-height piers between/around openings — no CSG (per
// CLAUDE.md). `elevation` is the level's floor height in world Y.
export function wallToBoxes(wall: Wall, elevation = 0): Box3Spec[] {
  const L = wallLength(wall);
  if (L === 0) return [];

  const dir = wallDirection(wall); // plan-space unit direction
  const T = wall.thickness;
  const H = wall.height;

  // Rotation taking local +X onto the world wall direction (x,0,z). Rotation
  // about +Y by θ maps (1,0,0) -> (cosθ, 0, -sinθ), so cosθ=dir.x, sinθ=-dir.y.
  const rotationY = Math.atan2(-dir.y, dir.x);

  // Build a box covering along-wall span [a,b] and vertical span [y0,y1].
  const makeBox = (a: number, b: number, y0: number, y1: number): Box3Spec => {
    const alongCenter = (a + b) / 2;
    const px = wall.start.x + dir.x * alongCenter;
    const py = wall.start.y + dir.y * alongCenter;
    const [wx, , wz] = planToWorld({ x: px, y: py }, elevation);
    return {
      center: [wx, elevation + (y0 + y1) / 2, wz],
      size: [b - a, y1 - y0, T],
      rotationY,
      face: { u0: a, v0: y0, w: b - a, h: y1 - y0 },
    };
  };

  // Normalize windows to along-wall spans, clamp to the wall, drop degenerate
  // ones, and process left-to-right.
  const wins = wall.windows
    .map((w) => {
      const center = w.t * L;
      const half = w.width / 2;
      return {
        a: clamp(center - half, 0, L),
        b: clamp(center + half, 0, L),
        sill: clamp(w.sillHeight, 0, H),
        head: clamp(w.sillHeight + w.height, 0, H),
      };
    })
    .filter((w) => w.b - w.a > 1e-6)
    .sort((p, q) => p.a - q.a);

  const boxes: Box3Spec[] = [];
  let cursor = 0;

  for (const w of wins) {
    if (w.a > cursor + 1e-9) boxes.push(makeBox(cursor, w.a, 0, H)); // pier
    if (w.sill > 1e-9) boxes.push(makeBox(w.a, w.b, 0, w.sill)); // under sill
    if (w.head < H - 1e-9) boxes.push(makeBox(w.a, w.b, w.head, H)); // over head
    cursor = Math.max(cursor, w.b);
  }
  if (cursor < L - 1e-9) boxes.push(makeBox(cursor, L, 0, H)); // final pier

  return boxes;
}

// A thin oriented box filling one window opening, for the translucent glass pane.
// Thinner than the wall so it sits inside the reveal.
export function windowGlassBox(
  wall: Wall,
  win: { t: number; width: number; height: number; sillHeight: number },
  elevation = 0,
): Box3Spec {
  const L = wallLength(wall);
  const dir = wallDirection(wall);
  const rotationY = Math.atan2(-dir.y, dir.x);
  const { a, b } = windowSpan(L, win.t, win.width);
  const alongCenter = (a + b) / 2;
  const px = wall.start.x + dir.x * alongCenter;
  const py = wall.start.y + dir.y * alongCenter;
  const [wx, , wz] = planToWorld({ x: px, y: py }, elevation);
  const glassThickness = Math.min(0.04, wall.thickness * 0.4);
  return {
    center: [wx, elevation + win.sillHeight + win.height / 2, wz],
    size: [win.width, win.height, glassThickness],
    rotationY,
    face: { u0: a, v0: win.sillHeight, w: win.width, h: win.height },
  };
}
