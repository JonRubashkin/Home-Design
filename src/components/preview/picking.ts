// Pure helpers for 3D furniture picking. Kept free of three.js so they can be
// unit-tested with plain objects.

// A minimal view of a three Object3D for walking the parent chain. three's
// Object3D is structurally compatible (it has `userData` and `parent`).
export interface PickNode {
  userData: Record<string, unknown>;
  parent: PickNode | null;
}

// Resolve a raycast hit (any child mesh of a furniture group) back to the
// owning item's id by walking up the parent chain looking for `userData.itemId`.
export function resolveItemId(node: PickNode | null): string | null {
  let current: PickNode | null = node;
  while (current) {
    const id = current.userData?.itemId;
    if (typeof id === "string") return id;
    current = current.parent;
  }
  return null;
}

// Max pointer travel (CSS px) between pointer-down and -up for the gesture to
// count as a click rather than a camera-orbit drag.
export const PICK_CLICK_PX = 5;

interface Point {
  x: number;
  y: number;
}

// True if the pointer barely moved between down (`from`) and up (`to`) — i.e. a
// click, not a drag. A missing origin counts as a click (no drag recorded).
export function isClick(
  from: Point | null,
  to: Point,
  threshold = PICK_CLICK_PX,
): boolean {
  if (!from) return true;
  return Math.hypot(from.x - to.x, from.y - to.y) <= threshold;
}
