import { describe, it, expect } from "vitest";
import { hexToRgb, patternPixel, renderPatternRGBA, type RGB } from "./patterns";

const A: RGB = [10, 20, 30];
const B: RGB = [200, 210, 220];
const SIZE = 256;

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ff8800")).toEqual([255, 136, 0]);
  });
  it("parses 3-digit shorthand", () => {
    expect(hexToRgb("#abc")).toEqual([170, 187, 204]);
  });
  it("is tolerant of a missing hash", () => {
    expect(hexToRgb("00ff00")).toEqual([0, 255, 0]);
  });
  it("falls back to grey on garbage", () => {
    expect(hexToRgb("nope")).toEqual([128, 128, 128]);
  });
});

// Interior patterns are two-tone (exactly A or B); landscape patterns blend.
const TWO_TONE = ["checker", "planks", "tile", "stripes"] as const;
const LANDSCAPE = ["grass", "water", "gravel"] as const;

describe("patternPixel", () => {
  it("two-tone patterns only ever return one of the two colors", () => {
    for (const p of TWO_TONE) {
      for (let y = 0; y < SIZE; y += 13) {
        for (let x = 0; x < SIZE; x += 13) {
          const px = patternPixel(p, x, y, SIZE, A, B);
          expect(px === A || px === B).toBe(true);
        }
      }
    }
  });

  it("landscape patterns blend within the A..B range per channel", () => {
    const lo = [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.min(A[2], B[2])];
    const hi = [Math.max(A[0], B[0]), Math.max(A[1], B[1]), Math.max(A[2], B[2])];
    for (const p of LANDSCAPE) {
      for (let y = 0; y < SIZE; y += 17) {
        for (let x = 0; x < SIZE; x += 17) {
          const px = patternPixel(p, x, y, SIZE, A, B);
          for (let c = 0; c < 3; c++) {
            expect(px[c]!).toBeGreaterThanOrEqual(lo[c]! - 1e-9);
            expect(px[c]!).toBeLessThanOrEqual(hi[c]! + 1e-9);
          }
        }
      }
    }
  });

  it("landscape patterns tile seamlessly (periodic with size)", () => {
    const pts: [number, number][] = [
      [0, 0],
      [37, 5],
      [128, 200],
      [255, 17],
    ];
    // Sine-based ripples drift by float rounding across the seam, so compare
    // per-channel within a tolerance rather than exact equality.
    const near = (p: (typeof LANDSCAPE)[number], x: number, y: number) => {
      const base = patternPixel(p, x, y, SIZE, A, B);
      const dx = patternPixel(p, x + SIZE, y, SIZE, A, B);
      const dy = patternPixel(p, x, y + SIZE, SIZE, A, B);
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(dx[c]! - base[c]!)).toBeLessThan(1e-3);
        expect(Math.abs(dy[c]! - base[c]!)).toBeLessThan(1e-3);
      }
    };
    for (const p of LANDSCAPE) for (const [x, y] of pts) near(p, x, y);
  });

  it("checker alternates by quadrant", () => {
    expect(patternPixel("checker", 0, 0, SIZE, A, B)).toBe(A);
    expect(patternPixel("checker", SIZE / 2, 0, SIZE, A, B)).toBe(B);
    expect(patternPixel("checker", 0, SIZE / 2, SIZE, A, B)).toBe(B);
    expect(patternPixel("checker", SIZE / 2, SIZE / 2, SIZE, A, B)).toBe(A);
  });

  // checker, tile and stripes are fully periodic with `size` (seamless tiling).
  it("checker / tile / stripes repeat exactly every tile", () => {
    const pts: [number, number][] = [
      [0, 0],
      [37, 5],
      [128, 200],
      [255, 17],
    ];
    for (const p of ["checker", "tile", "stripes"] as const) {
      for (const [x, y] of pts) {
        const base = patternPixel(p, x, y, SIZE, A, B);
        expect(patternPixel(p, x + SIZE, y, SIZE, A, B)).toBe(base);
        expect(patternPixel(p, x, y + SIZE, SIZE, A, B)).toBe(base);
      }
    }
  });

  // planks have interior cross-joints (not periodic in x), but the tile's left
  // and right edges are plain field, so tiling stays seamless.
  it("planks edge columns carry no vertical joint", () => {
    for (let y = 2; y < SIZE; y += 7) {
      // avoid the horizontal seam rows
      if (y % (SIZE / 4) < 2) continue;
      expect(patternPixel("planks", 0, y, SIZE, A, B)).toBe(A);
      expect(patternPixel("planks", SIZE - 1, y, SIZE, A, B)).toBe(A);
    }
  });
});

describe("renderPatternRGBA", () => {
  it("produces an opaque RGBA buffer of the right size", () => {
    const data = renderPatternRGBA("tile", "#ffffff", "#000000", 16);
    expect(data.length).toBe(16 * 16 * 4);
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  });
});
