import type { MaterialRef, PatternId } from "../model/types";

export const PATTERN_IDS: PatternId[] = [
  "checker",
  "planks",
  "tile",
  "stripes",
];

// Tile resolution and how many world-meters one tile covers (shared by 2D fills
// and 3D textures so the plan and preview match).
export const TILE_PX = 256;
export const PATTERN_TILE_METERS = 1;

export type RGB = [number, number, number];

// Parse "#rgb" or "#rrggbb" (the only forms the pickers produce) to RGB.
export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Pure per-pixel pattern definition. Every pattern is periodic with `size`, so
// tiles repeat seamlessly on any surface, and the same pixels feed the 2D plan,
// the 3D textures, and the picker thumbnails. Returns colorA or colorB.
export function patternPixel(
  pattern: PatternId,
  x: number,
  y: number,
  size: number,
  a: RGB,
  b: RGB,
): RGB {
  switch (pattern) {
    case "checker": {
      const cell = size / 2;
      const cx = Math.floor(x / cell) % 2;
      const cy = Math.floor(y / cell) % 2;
      return cx === cy ? a : b;
    }
    case "planks": {
      const plank = size / 4;
      const lineW = Math.max(1, size / 128);
      const onSeam = y % plank < lineW; // plank seam (horizontal)
      const row = Math.floor(y / plank);
      const xJoint = row % 2 === 0 ? size / 2 : size / 4;
      const onJoint = Math.abs(x - xJoint) < lineW; // staggered cross-joint
      return onSeam || onJoint ? b : a;
    }
    case "tile": {
      const cell = size / 2;
      const grout = Math.max(2, size / 32);
      const ix = x % cell;
      const iy = y % cell;
      const inTile =
        ix >= grout / 2 &&
        ix < cell - grout / 2 &&
        iy >= grout / 2 &&
        iy < cell - grout / 2;
      return inTile ? a : b;
    }
    case "stripes": {
      const band = size / 4;
      // Anti-diagonal banding; (x+y) shifts by a whole number of bands across a
      // tile edge (size / band is even), so stripes line up seamlessly.
      return Math.floor((x + y) / band) % 2 === 0 ? a : b;
    }
  }
}

// Fill RGBA pixels for one tile. Reused by the canvas drawing and verifiable
// without a DOM (pure function over a typed array).
export function renderPatternRGBA(
  pattern: PatternId,
  colorA: string,
  colorB: string,
  size = TILE_PX,
): Uint8ClampedArray {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, bl] = patternPixel(pattern, x, y, size, a, b);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = bl;
      data[i + 3] = 255;
    }
  }
  return data;
}

export function createPatternCanvas(
  ref: Extract<MaterialRef, { kind: "pattern" }>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const rgba = renderPatternRGBA(
      ref.pattern,
      ref.colorA,
      ref.colorB,
      TILE_PX,
    );
    const image = ctx.createImageData(TILE_PX, TILE_PX);
    image.data.set(rgba);
    ctx.putImageData(image, 0, 0);
  }
  return canvas;
}
