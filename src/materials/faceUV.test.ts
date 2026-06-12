import { describe, it, expect } from "vitest";
import { faceTextureTransform } from "./faceUV";
import { patternTextureVariantKey } from "./textures";
import type { FaceRect } from "../geometry/boxes";
import type { MaterialRef } from "../model/types";

const TILE = 1;

// World texture coordinate at the two ends of a face (local u/v 0 and 1).
function ends(face: FaceRect, mirror: boolean) {
  const t = faceTextureTransform(face, TILE, mirror);
  const u = (k: number) => k * t.repeat[0] + t.offset[0];
  const v = (k: number) => k * t.repeat[1] + t.offset[1];
  return { u0: u(0), u1: u(1), v0: v(0), v1: v(1), t };
}

// A 4 m wall, height 2.4, split by a centred 1.2 m window (sill 0.9, head 2.1):
// pier | under-sill + over-head | pier.
const pier1: FaceRect = { u0: 0, v0: 0, w: 1.4, h: 2.4 };
const sill: FaceRect = { u0: 1.4, v0: 0, w: 1.2, h: 0.9 };
const head: FaceRect = { u0: 1.4, v0: 2.1, w: 1.2, h: 0.3 };
const pier2: FaceRect = { u0: 2.6, v0: 0, w: 1.4, h: 2.4 };

describe("faceTextureTransform — side B (+Z, not mirrored)", () => {
  it("maps local u/v onto world along-wall / height position", () => {
    const e = ends(pier2, false);
    expect(e.u0).toBeCloseTo(2.6); // box start
    expect(e.u1).toBeCloseTo(4.0); // box end
    expect(e.v0).toBeCloseTo(0);
    expect(e.v1).toBeCloseTo(2.4);
  });

  it("is continuous across the window (sub-box edges share a coordinate)", () => {
    // pier1 ends where the sill/head boxes begin (1.4), which end where pier2
    // begins (2.6) — all anchored to the same world coordinate.
    expect(ends(pier1, false).u1).toBeCloseTo(1.4);
    expect(ends(sill, false).u0).toBeCloseTo(1.4);
    expect(ends(sill, false).u1).toBeCloseTo(2.6);
    expect(ends(head, false).u0).toBeCloseTo(1.4);
    expect(ends(pier2, false).u0).toBeCloseTo(2.6);
    // Vertically the over-head box starts at the window head height (2.1).
    expect(ends(head, false).v0).toBeCloseTo(2.1);
    expect(ends(sill, false).v1).toBeCloseTo(0.9);
  });
});

describe("faceTextureTransform — side A (-Z, mirrored)", () => {
  it("reverses u but keeps the same world coordinates at the edges", () => {
    const e = ends(pier2, true);
    expect(e.u0).toBeCloseTo(4.0); // local u=0 is the far (high) end
    expect(e.u1).toBeCloseTo(2.6);
    expect(e.t.repeat[0]).toBeLessThan(0); // negative repeat mirrors the face
    expect(e.v0).toBeCloseTo(0);
    expect(e.v1).toBeCloseTo(2.4);
  });

  it("stays continuous across the window on the mirrored side too", () => {
    // Both boxes still cover world along-wall 1.4 and 2.6 at their edges.
    const p1 = ends(pier1, true);
    const s = ends(sill, true);
    expect(Math.min(p1.u0, p1.u1)).toBeCloseTo(0);
    expect(Math.max(p1.u0, p1.u1)).toBeCloseTo(1.4);
    expect(Math.min(s.u0, s.u1)).toBeCloseTo(1.4);
    expect(Math.max(s.u0, s.u1)).toBeCloseTo(2.6);
  });
});

describe("patternTextureVariantKey", () => {
  const ref: Extract<MaterialRef, { kind: "pattern" }> = {
    kind: "pattern",
    pattern: "planks",
    colorA: "#aaa",
    colorB: "#bbb",
  };

  it("is equal for identical repeat + offset", () => {
    expect(patternTextureVariantKey(ref, [2, 3], [0.5, 0])).toBe(
      patternTextureVariantKey(ref, [2, 3], [0.5, 0]),
    );
  });

  it("differs by repeat", () => {
    expect(patternTextureVariantKey(ref, [2, 3], [0, 0])).not.toBe(
      patternTextureVariantKey(ref, [2, 4], [0, 0]),
    );
  });

  it("differs by offset", () => {
    expect(patternTextureVariantKey(ref, [2, 3], [0, 0])).not.toBe(
      patternTextureVariantKey(ref, [2, 3], [1, 0]),
    );
  });

  it("differs by material", () => {
    const other = { ...ref, pattern: "tile" as const };
    expect(patternTextureVariantKey(ref, [1, 1], [0, 0])).not.toBe(
      patternTextureVariantKey(other, [1, 1], [0, 0]),
    );
  });
});
