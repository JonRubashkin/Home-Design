import type { MaterialRef } from "../model/types";
import type { Part, Primitive } from "./types";

export const solid = (color: string): MaterialRef => ({ kind: "solid", color });

type Vec3 = [number, number, number];

export function box(
  slot: string,
  size: Vec3,
  position: Vec3,
  rotation?: Vec3,
): Part {
  const primitive: Primitive = { kind: "box", size };
  return rotation
    ? { slot, primitive, position, rotation }
    : { slot, primitive, position };
}

export function rbox(
  slot: string,
  size: Vec3,
  radius: number,
  position: Vec3,
): Part {
  return { slot, primitive: { kind: "roundedBox", size, radius }, position };
}

export function cyl(
  slot: string,
  radius: number,
  height: number,
  position: Vec3,
  rotation?: Vec3,
): Part {
  const primitive: Primitive = {
    kind: "cylinder",
    radiusTop: radius,
    radiusBottom: radius,
    height,
  };
  return rotation
    ? { slot, primitive, position, rotation }
    : { slot, primitive, position };
}

// Four identical legs inset from the footprint corners, from the floor to `top`.
export function legs(
  slot: string,
  width: number,
  depth: number,
  top: number,
  thickness = 0.06,
  inset = 0.05,
): Part[] {
  const x = width / 2 - inset - thickness / 2;
  const z = depth / 2 - inset - thickness / 2;
  const size: Vec3 = [thickness, top, thickness];
  const y = top / 2;
  return [
    [-x, y, -z],
    [x, y, -z],
    [x, y, z],
    [-x, y, z],
  ].map((p) => box(slot, size, p as Vec3));
}
