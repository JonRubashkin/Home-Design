import { describe, it, expect } from "vitest";
import { materialKey, materialLabel } from "./key";
import type { MaterialRef } from "../model/types";

const solid = (color: string): MaterialRef => ({ kind: "solid", color });
const pattern = (
  p: "checker" | "planks" | "tile" | "stripes",
  a: string,
  b: string,
): MaterialRef => ({ kind: "pattern", pattern: p, colorA: a, colorB: b });

describe("materialKey", () => {
  it("distinguishes solids by color", () => {
    expect(materialKey(solid("#ff0000"))).not.toBe(
      materialKey(solid("#00ff00")),
    );
  });

  it("is identical for equal materials (so they share a texture)", () => {
    expect(materialKey(pattern("planks", "#aaa", "#bbb"))).toBe(
      materialKey(pattern("planks", "#aaa", "#bbb")),
    );
  });

  it("is case-insensitive on hex", () => {
    expect(materialKey(solid("#ABCDEF"))).toBe(materialKey(solid("#abcdef")));
  });

  it("distinguishes solids from patterns", () => {
    expect(materialKey(solid("#abcdef"))).not.toBe(
      materialKey(pattern("tile", "#abcdef", "#abcdef")),
    );
  });

  it("distinguishes patterns by id and both colors", () => {
    expect(materialKey(pattern("checker", "#111", "#222"))).not.toBe(
      materialKey(pattern("stripes", "#111", "#222")),
    );
    expect(materialKey(pattern("checker", "#111", "#222"))).not.toBe(
      materialKey(pattern("checker", "#111", "#333")),
    );
  });
});

describe("materialLabel", () => {
  it("labels solids by hex and patterns by name", () => {
    expect(materialLabel(solid("#abcdef"))).toBe("#ABCDEF");
    expect(materialLabel(pattern("planks", "#1", "#2"))).toBe("Planks");
  });
});
