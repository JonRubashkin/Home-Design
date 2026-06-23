import type { Wall } from "../model/types";
import { wallLength, wallDirection, wallNormal } from "./wall";
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
//
// `extraSplits` (meters along the wall) further subdivide every emitted box at
// those along-wall positions — used by the 3D renderer to break a face where its
// per-segment paint changes (Phase 6.3 Part B), so each box carries one paint
// material per side. No effect on geometry, only on box boundaries.
export function wallToBoxes(
  wall: Wall,
  elevation = 0,
  extraSplits: number[] = [],
): Box3Spec[] {
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

  // Unified opening list: windows carry their sill, doors sit on the floor
  // (sill 0, so no box under them — just the header above). Clamp to the wall,
  // drop degenerate ones, and process left-to-right.
  const openings = [
    ...wall.windows.map((w) => ({
      t: w.t,
      width: w.width,
      sill: w.sillHeight,
      top: w.sillHeight + w.height,
    })),
    ...(wall.doors ?? []).map((d) => ({
      t: d.t,
      width: d.width,
      sill: 0,
      top: d.height,
    })),
  ]
    .map((o) => ({
      a: clamp(o.t * L - o.width / 2, 0, L),
      b: clamp(o.t * L + o.width / 2, 0, L),
      sill: clamp(o.sill, 0, H),
      head: clamp(o.top, 0, H),
    }))
    .filter((o) => o.b - o.a > 1e-6)
    .sort((p, q) => p.a - q.a);

  // Emit makeBox(a,b,y0,y1), further split along-wall at any extraSplits inside.
  const splits = extraSplits
    .filter((s) => s > 1e-9 && s < L - 1e-9)
    .sort((p, q) => p - q);
  const emit = (a: number, b: number, y0: number, y1: number) => {
    const cuts = splits.filter((s) => s > a + 1e-9 && s < b - 1e-9);
    let prev = a;
    for (const c of cuts) {
      boxes.push(makeBox(prev, c, y0, y1));
      prev = c;
    }
    boxes.push(makeBox(prev, b, y0, y1));
  };

  const boxes: Box3Spec[] = [];
  let cursor = 0;

  for (const o of openings) {
    if (o.a > cursor + 1e-9) emit(cursor, o.a, 0, H); // pier
    if (o.sill > 1e-9) emit(o.a, o.b, 0, o.sill); // under sill
    if (o.head < H - 1e-9) emit(o.a, o.b, o.head, H); // over head
    cursor = Math.max(cursor, o.b);
  }
  if (cursor < L - 1e-9) emit(cursor, L, 0, H); // final pier

  return boxes;
}

// Build an oriented sub-box from along-wall span [a,b], vertical [y0,y1], and a
// custom thickness. Centered on the wall centerline unless `lateral` offsets it
// along the wall normal (+ = toward side A; used to park a sliding door on a
// wall face).
function orientedBox(
  wall: Wall,
  a: number,
  b: number,
  y0: number,
  y1: number,
  thickness: number,
  elevation: number,
  lateral = 0,
): Box3Spec {
  const dir = wallDirection(wall);
  const n = wallNormal(wall); // unit normal toward side A
  const rotationY = Math.atan2(-dir.y, dir.x);
  const alongCenter = (a + b) / 2;
  const px = wall.start.x + dir.x * alongCenter + n.x * lateral;
  const py = wall.start.y + dir.y * alongCenter + n.y * lateral;
  const [wx, , wz] = planToWorld({ x: px, y: py }, elevation);
  return {
    center: [wx, elevation + (y0 + y1) / 2, wz],
    size: [b - a, y1 - y0, thickness],
    rotationY,
    face: { u0: a, v0: y0, w: b - a, h: y1 - y0 },
  };
}

export const DOOR_FRAME_W = 0.06;

// Slim trim boxes around a door opening: two jambs + a head.
export function doorFrameBoxes(
  wall: Wall,
  door: { t: number; width: number; height: number },
  elevation = 0,
): Box3Spec[] {
  const L = wallLength(wall);
  const { a, b } = windowSpan(L, door.t, door.width);
  const h = door.height;
  const t = wall.thickness * 0.98;
  const fw = Math.min(DOOR_FRAME_W, (b - a) / 3);
  return [
    orientedBox(wall, a, a + fw, 0, h, t, elevation), // left jamb
    orientedBox(wall, b - fw, b, 0, h, t, elevation), // right jamb
    orientedBox(wall, a, b, h - fw, h, t, elevation), // head
  ];
}

// Leaf panel thickness (meters), slimmer than the wall so it sits in the reveal.
const doorLeafThickness = (wall: Wall) => Math.min(0.045, wall.thickness * 0.5);

export type DoorLeafStyle = "single" | "double" | "sliding";

// The closed door leaf filling the opening (inside the frame). Single style.
export function doorLeafBox(
  wall: Wall,
  door: { t: number; width: number; height: number },
  elevation = 0,
): Box3Spec {
  const L = wallLength(wall);
  const { a, b } = windowSpan(L, door.t, door.width);
  const fw = Math.min(DOOR_FRAME_W, (b - a) / 3);
  const t = doorLeafThickness(wall);
  return orientedBox(wall, a + fw, b - fw, 0, door.height - fw, t, elevation);
}

// Closed leaves for a "double"/French door: two half-width panels meeting at the
// opening center, hinged at opposite jambs. A thin seam separates them.
export function doubleDoorLeafBoxes(
  wall: Wall,
  door: { t: number; width: number; height: number },
  elevation = 0,
): Box3Spec[] {
  const L = wallLength(wall);
  const { a, b } = windowSpan(L, door.t, door.width);
  const fw = Math.min(DOOR_FRAME_W, (b - a) / 3);
  const t = doorLeafThickness(wall);
  const mid = (a + b) / 2;
  const seam = Math.min(0.01, (b - a) / 20);
  const h = door.height - fw;
  return [
    orientedBox(wall, a + fw, mid - seam, 0, h, t, elevation), // start leaf
    orientedBox(wall, mid + seam, b - fw, 0, h, t, elevation), // end leaf
  ];
}

// A sliding door: one panel parked on side A's face, slid toward the wall START
// (so the opening reads open), plus a thin track rail above. hinge/swing are
// ignored. The panel rides on the face (offset out by half the wall + half the
// panel) and spans the door's width ending at the opening's start edge.
export function slidingDoorBoxes(
  wall: Wall,
  door: { t: number; width: number; height: number },
  elevation = 0,
): { panel: Box3Spec; track: Box3Spec } {
  const L = wallLength(wall);
  const { a } = windowSpan(L, door.t, door.width);
  const t = doorLeafThickness(wall);
  // Park the panel just behind the start jamb; clamp so it stays on the wall.
  const panelEnd = a;
  const panelStart = Math.max(0, a - door.width);
  // Sit the panel against side A's outer face.
  const lateral = wall.thickness / 2 + t / 2;
  const railH = 0.05;
  const panel = orientedBox(
    wall,
    panelStart,
    panelEnd,
    0,
    door.height,
    t,
    elevation,
    lateral,
  );
  // The track spans the parked panel plus the opening, at the head.
  const trackEnd = a + door.width;
  const track = orientedBox(
    wall,
    panelStart,
    Math.min(L, trackEnd),
    door.height,
    door.height + railH,
    t,
    elevation,
    lateral,
  );
  return { panel, track };
}

export type WindowMuntinStyle = "grid" | "divided" | "picture";

// Glazing-bar (muntin) boxes inside a window opening, by style — cosmetic only,
// the hole is unchanged. "picture" = no bars (single pane); "divided" = one
// centered VERTICAL bar (splits the pane left/right); "grid"/colonial = a 2x3
// layout (1 vertical + 2 horizontal bars → two columns, three rows). Bars sit a
// hair proud of the glass so they read on both faces.
export function windowMuntinBoxes(
  wall: Wall,
  win: {
    t: number;
    width: number;
    height: number;
    sillHeight: number;
    style?: WindowMuntinStyle;
  },
  elevation = 0,
): Box3Spec[] {
  const style = win.style ?? "picture";
  if (style === "picture") return [];

  const L = wallLength(wall);
  const { a, b } = windowSpan(L, win.t, win.width);
  const y0 = win.sillHeight;
  const y1 = win.sillHeight + win.height;
  const barW = 0.04; // bar cross-section in the glazing plane
  const depth = Math.min(0.06, wall.thickness * 0.6); // slightly proud of glass
  const midAlong = (a + b) / 2;

  const boxes: Box3Spec[] = [
    // Central vertical bar (divided and grid both have it → 2 columns).
    orientedBox(wall, midAlong - barW / 2, midAlong + barW / 2, y0, y1, depth, elevation),
  ];
  if (style === "grid") {
    // Two horizontal bars split the height into three rows.
    const h = win.height;
    for (const k of [1, 2]) {
      const yc = y0 + (h * k) / 3;
      boxes.push(orientedBox(wall, a, b, yc - barW / 2, yc + barW / 2, depth, elevation));
    }
  }
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
