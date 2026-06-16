import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import {
  applyMaterialStyle,
  materialRefToThreeMaterial,
} from "./threeMaterial";

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

describe("applyMaterialStyle ghost transparency", () => {
  // `Material.needsUpdate = true` is a write-only setter that bumps `.version`;
  // we observe that bump to prove a recompile was requested.
  it("flags a recompile when transparency toggles on a live material", () => {
    const m = materialRefToThreeMaterial({ kind: "solid", color: "#888888" });
    // Fresh material starts opaque.
    expect(m.transparent).toBe(false);

    // Turning ghost on must flip transparent AND request a recompile, else
    // three.js keeps rendering the (compiled) opaque program.
    let v = m.version;
    applyMaterialStyle(m, { ghost: true });
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBeCloseTo(0.15);
    expect(m.depthWrite).toBe(false);
    expect(m.version).toBeGreaterThan(v);

    // Re-applying the same ghost state should NOT keep forcing recompiles.
    v = m.version;
    applyMaterialStyle(m, { ghost: true });
    expect(m.version).toBe(v);

    // Turning ghost off flips back and recompiles once more.
    v = m.version;
    applyMaterialStyle(m, { ghost: false });
    expect(m.transparent).toBe(false);
    expect(m.opacity).toBe(1);
    expect(m.depthWrite).toBe(true);
    expect(m.version).toBeGreaterThan(v);
  });
});
