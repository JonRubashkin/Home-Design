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

// Draw one repeating tile of a pattern onto a 2D canvas context.
export function drawPatternTile(
  ctx: CanvasRenderingContext2D,
  pattern: PatternId,
  colorA: string,
  colorB: string,
  size = TILE_PX,
): void {
  switch (pattern) {
    case "checker": {
      const h = size / 2;
      ctx.fillStyle = colorA;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = colorB;
      ctx.fillRect(0, 0, h, h);
      ctx.fillRect(h, h, h, h);
      break;
    }
    case "planks": {
      const rows = 4;
      const plank = size / rows;
      ctx.fillStyle = colorA;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = colorB;
      ctx.lineWidth = Math.max(1, size / 128);
      for (let i = 0; i <= rows; i++) {
        const y = i * plank;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      // Staggered cross-joints between planks.
      for (let i = 0; i < rows; i++) {
        const x = (i % 2 === 0 ? 0.5 : 0.25) * size;
        ctx.beginPath();
        ctx.moveTo(x, i * plank);
        ctx.lineTo(x, (i + 1) * plank);
        ctx.stroke();
      }
      break;
    }
    case "tile": {
      const cells = 2;
      const cell = size / cells;
      const grout = Math.max(2, size / 32);
      ctx.fillStyle = colorB; // grout
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = colorA; // tile faces
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          ctx.fillRect(
            c * cell + grout / 2,
            r * cell + grout / 2,
            cell - grout,
            cell - grout,
          );
        }
      }
      break;
    }
    case "stripes": {
      ctx.fillStyle = colorA;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = colorB;
      // Diagonal stripes via a clipped, rotated set of bars.
      const band = size / 4;
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(Math.PI / 4);
      for (let x = -size; x < size; x += band * 2) {
        ctx.fillRect(x, -size, band, size * 2);
      }
      ctx.restore();
      break;
    }
  }
}

export function createPatternCanvas(
  ref: Extract<MaterialRef, { kind: "pattern" }>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) drawPatternTile(ctx, ref.pattern, ref.colorA, ref.colorB, TILE_PX);
  return canvas;
}
