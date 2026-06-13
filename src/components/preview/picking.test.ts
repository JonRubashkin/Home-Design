import { describe, it, expect } from "vitest";
import { resolveItemId, isClick, type PickNode } from "./picking";

describe("resolveItemId", () => {
  it("finds itemId on the hit object's ancestor group", () => {
    const group: PickNode = { userData: { itemId: "f1" }, parent: null };
    const mesh: PickNode = { userData: {}, parent: group };
    const subMesh: PickNode = { userData: {}, parent: mesh };
    expect(resolveItemId(subMesh)).toBe("f1");
    expect(resolveItemId(mesh)).toBe("f1");
    expect(resolveItemId(group)).toBe("f1");
  });

  it("returns null when no ancestor carries an itemId", () => {
    const root: PickNode = { userData: {}, parent: null };
    const child: PickNode = { userData: { other: 1 }, parent: root };
    expect(resolveItemId(child)).toBeNull();
    expect(resolveItemId(null)).toBeNull();
  });

  it("ignores a non-string itemId", () => {
    const node: PickNode = { userData: { itemId: 42 }, parent: null };
    expect(resolveItemId(node)).toBeNull();
  });
});

describe("isClick", () => {
  it("treats a tiny movement as a click", () => {
    expect(isClick({ x: 100, y: 100 }, { x: 102, y: 101 })).toBe(true);
  });

  it("treats movement beyond the threshold as a drag", () => {
    expect(isClick({ x: 100, y: 100 }, { x: 140, y: 100 })).toBe(false);
  });

  it("counts a missing origin as a click", () => {
    expect(isClick(null, { x: 0, y: 0 })).toBe(true);
  });
});
