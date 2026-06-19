import type { Vec2, Wall } from "../model/types";
import { distancePointToSegment, wallNormal } from "./wall";
import { GRID_SNAP } from "../model/defaults";
import type { Bounds } from "./planview";

// Enclosed-room detection by grid flood-fill at the plan grid resolution.
// Walls (with thickness) rasterize to barrier cells; a flood from the clicked
// cell that reaches the bounded margin means the region is OPEN (not a room).
// Otherwise the flooded cells are the interior, whose boundary is traced into a
// clean rectilinear polygon and whose bordering walls' interior faces are found.

export const ROOM_FILL_MARGIN = 1.0; // meters of exterior buffer for leak detection

export interface RoomDetection {
  enclosed: boolean;
  polygon: Vec2[];
  wallSides: { wallId: string; side: "A" | "B" }[];
}

// Exported so other features can reuse the same grid rasterization and boundary
// trace as room flood-fill.
export interface Grid {
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  cell: number;
}

export function makeGrid(bounds: Bounds, cell: number): Grid {
  const minX = Math.floor(bounds.minX / cell) * cell;
  const minY = Math.floor(bounds.minY / cell) * cell;
  const cols = Math.max(1, Math.ceil((bounds.maxX - minX) / cell) + 1);
  const rows = Math.max(1, Math.ceil((bounds.maxY - minY) / cell) + 1);
  return { minX, minY, cols, rows, cell };
}

export const cellCenter = (g: Grid, c: number, r: number): Vec2 => ({
  x: g.minX + (c + 0.5) * g.cell,
  y: g.minY + (r + 0.5) * g.cell,
});

export const cellOf = (g: Grid, p: Vec2): { c: number; r: number } | null => {
  const c = Math.floor((p.x - g.minX) / g.cell);
  const r = Math.floor((p.y - g.minY) / g.cell);
  if (c < 0 || c >= g.cols || r < 0 || r >= g.rows) return null;
  return { c, r };
};

// Mark a cell a barrier when its center is within thickness/2 of any wall.
export function rasterizeWalls(walls: Wall[], g: Grid): Uint8Array {
  const barrier = new Uint8Array(g.cols * g.rows);
  for (const w of walls) {
    const half = w.thickness / 2;
    const c0 = Math.max(
      0,
      Math.floor((Math.min(w.start.x, w.end.x) - half - g.minX) / g.cell),
    );
    const c1 = Math.min(
      g.cols - 1,
      Math.ceil((Math.max(w.start.x, w.end.x) + half - g.minX) / g.cell),
    );
    const r0 = Math.max(
      0,
      Math.floor((Math.min(w.start.y, w.end.y) - half - g.minY) / g.cell),
    );
    const r1 = Math.min(
      g.rows - 1,
      Math.ceil((Math.max(w.start.y, w.end.y) + half - g.minY) / g.cell),
    );
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (distancePointToSegment(cellCenter(g, c, r), w.start, w.end) <= half)
          barrier[r * g.cols + c] = 1;
      }
    }
  }
  return barrier;
}

// 4-connected flood from `start`. `open` is true if it reaches the grid border
// (the region leaks to the exterior). `interior` is the flooded cell mask.
export function flood(
  barrier: Uint8Array,
  g: Grid,
  start: { c: number; r: number },
): { open: boolean; interior: Uint8Array; count: number } {
  const interior = new Uint8Array(g.cols * g.rows);
  const startIdx = start.r * g.cols + start.c;
  if (barrier[startIdx]) return { open: false, interior, count: 0 }; // on a wall
  let open = false;
  let count = 0;
  const stack = [startIdx];
  interior[startIdx] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    const c = idx % g.cols;
    const r = (idx - c) / g.cols;
    count++;
    if (c === 0 || c === g.cols - 1 || r === 0 || r === g.rows - 1) open = true;
    const DX = [-1, 1, 0, 0];
    const DY = [0, 0, -1, 1];
    for (let k = 0; k < 4; k++) {
      const nc = c + DX[k]!;
      const nr = r + DY[k]!;
      if (nc < 0 || nc >= g.cols || nr < 0 || nr >= g.rows) {
        open = true;
        continue;
      }
      const ni = nr * g.cols + nc;
      if (!interior[ni] && !barrier[ni]) {
        interior[ni] = 1;
        stack.push(ni);
      }
    }
  }
  return { open, interior, count };
}

// Trace the interior mask boundary into a rectilinear polygon (interior on the
// right of each directed edge), then drop collinear points. Corner (i,j) is at
// world (minX + i*cell, minY + j*cell).
export function traceContour(interior: Uint8Array, g: Grid): Vec2[] {
  const isInt = (c: number, r: number) =>
    c >= 0 && c < g.cols && r >= 0 && r < g.rows && interior[r * g.cols + c] === 1;
  const next = new Map<string, string>();
  const key = (i: number, j: number) => `${i},${j}`;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!isInt(c, r)) continue;
      if (!isInt(c, r - 1)) next.set(key(c, r), key(c + 1, r)); // top  +x
      if (!isInt(c + 1, r)) next.set(key(c + 1, r), key(c + 1, r + 1)); // right +y
      if (!isInt(c, r + 1)) next.set(key(c + 1, r + 1), key(c, r + 1)); // bottom -x
      if (!isInt(c - 1, r)) next.set(key(c, r + 1), key(c, r)); // left  -y
    }
  }
  if (next.size === 0) return [];
  const start = next.keys().next().value as string;
  const loopKeys: string[] = [];
  let cur = start;
  for (let n = 0; n <= next.size; n++) {
    loopKeys.push(cur);
    const nx = next.get(cur);
    if (nx === undefined || nx === start) break;
    cur = nx;
  }
  const pts = loopKeys.map((k) => {
    const [i, j] = k.split(",").map(Number);
    return { x: g.minX + i! * g.cell, y: g.minY + j! * g.cell };
  });
  return simplifyRectilinear(pts);
}

// Drop points that are collinear with their neighbors (keep only corners).
function simplifyRectilinear(pts: Vec2[]): Vec2[] {
  const n = pts.length;
  if (n < 3) return pts;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]!;
    const b = pts[i]!;
    const c = pts[(i + 1) % n]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-9) out.push({ x: b.x, y: b.y });
  }
  return out;
}

const interiorAt = (interior: Uint8Array, g: Grid, p: Vec2): boolean => {
  const cl = cellOf(g, p);
  return cl ? interior[cl.r * g.cols + cl.c] === 1 : false;
};

// For each wall, decide which side (if any) faces the flooded interior, by
// sampling just outside each face at several points along the wall.
function interiorWallSides(
  walls: Wall[],
  interior: Uint8Array,
  g: Grid,
): { wallId: string; side: "A" | "B" }[] {
  const out: { wallId: string; side: "A" | "B" }[] = [];
  for (const w of walls) {
    const n = wallNormal(w); // unit normal toward side A
    const off = w.thickness / 2 + g.cell;
    let aHits = 0;
    let bHits = 0;
    for (const t of [0.15, 0.35, 0.5, 0.65, 0.85]) {
      const px = w.start.x + (w.end.x - w.start.x) * t;
      const py = w.start.y + (w.end.y - w.start.y) * t;
      if (interiorAt(interior, g, { x: px + n.x * off, y: py + n.y * off }))
        aHits++;
      if (interiorAt(interior, g, { x: px - n.x * off, y: py - n.y * off }))
        bHits++;
    }
    if (aHits > 0 || bHits > 0)
      out.push({ wallId: w.id, side: aHits >= bHits ? "A" : "B" });
  }
  return out;
}

// Detect the enclosed room around `point` on a level's `walls`. `bounds` is the
// grid extent (caller passes the site union walls, expanded by ROOM_FILL_MARGIN).
export function detectRoom(
  point: Vec2,
  walls: Wall[],
  bounds: Bounds,
  cell = GRID_SNAP,
): RoomDetection {
  const empty: RoomDetection = { enclosed: false, polygon: [], wallSides: [] };
  const g = makeGrid(bounds, cell);
  const start = cellOf(g, point);
  if (!start) return empty;
  const barrier = rasterizeWalls(walls, g);
  const { open, interior, count } = flood(barrier, g, start);
  if (open || count === 0) return empty;
  const polygon = traceContour(interior, g);
  if (polygon.length < 3) return empty;
  return { enclosed: true, polygon, wallSides: interiorWallSides(walls, interior, g) };
}
