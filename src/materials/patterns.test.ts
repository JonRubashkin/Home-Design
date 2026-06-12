import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  patternPixel,
  renderPatternRGBA,
  PATTERN_IDS,
  type RGB,
} from "./patterns";

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

describe("patternPixel", () => {
  it("only ever returns one of the two colors", () => {
    for (const p of PATTERN_IDS) {
      for (let y = 0; y < SIZE; y += 13) {
        for (let x = 0; x < SIZE; x += 13) {
          const px = patternPixel(p, x, y, SIZE, A, B);
          expect(px === A || px === B).toBe(true);
        }
      }
    }
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
