import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { materialRefToThreeMaterial } from "./threeMaterial";

beforeAll(() => {
  THREE.ColorManagement.enabled = true;
});

describe("materialRefToThreeMaterial color management", () => {
  it("interprets solid hex as sRGB so it round-trips exactly", () => {
    // Dark colors are where an sRGB/linear mismatch shows; verify they survive.
    for (const hex of ["#1a1a1a", "#1b2a4a", "#808080", "#e8e4dc", "#ffffff"]) {
      const m = materialRefToThreeMaterial({ kind: "solid", color: hex });
      expect("#" + m.color.getHexString(THREE.SRGBColorSpace)).toBe(hex);
      // Stored value is linear (darker than the sRGB number) — i.e. converted.
      if (hex === "#808080") {
        expect(m.color.r).toBeLessThan(0.5); // sRGB 0.5 -> linear ~0.214
      }
    }
  });
});
