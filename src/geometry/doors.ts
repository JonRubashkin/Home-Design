import type { Vec2, Wall } from "../model/types";
import { wallLength, wallDirection, wallNormal } from "./wall";
import { add, scale } from "./vec";
import {
  windowSpan,
  openingSpans,
  spanOverlapsAny,
  WINDOW_END_MARGIN,
  type WindowValidity,
} from "./windows";

export const DOOR_END_MARGIN = WINDOW_END_MARGIN; // 0.1 m, same rule as windows

export interface DoorCandidate {
  t: number;
  width: number;
  height: number;
}

// Validate a door against its wall: fits within the length (with end margins),
// doesn't exceed the wall height, and doesn't overlap windows or other doors.
export function validateDoor(
  wall: Wall,
  door: DoorCandidate,
  excludeId?: string,
): WindowValidity {
  const L = wallLength(wall);
  if (door.width <= 0 || door.height <= 0)
    return { ok: false, reason: "Invalid size" };
  if (door.height > wall.height + 1e-9)
    return { ok: false, reason: "Taller than the wall" };

  const { a, b } = windowSpan(L, door.t, door.width);
  if (a < DOOR_END_MARGIN - 1e-9)
    return { ok: false, reason: "Too close to the wall start" };
  if (b > L - DOOR_END_MARGIN + 1e-9)
    return { ok: false, reason: "Too close to the wall end" };

  if (spanOverlapsAny(a, b, openingSpans(wall, undefined, excludeId)))
    return { ok: false, reason: "Overlaps another opening" };
  return { ok: true };
}

export interface DoorSymbol {
  hinge: Vec2; // hinge point on the wall centerline
  jamb: Vec2; // far jamb point on the wall centerline (closed-leaf position)
  leafEnd: Vec2; // tip of the open leaf (perpendicular, on the swing side)
  sweepFlag: 0 | 1; // SVG arc sweep flag from jamb -> leafEnd around hinge
  radius: number; // = door width
}

// Geometry of the standard architectural door symbol in plan space: the leaf
// drawn open (perpendicular from the hinge) plus a quarter-circle swing arc on
// the swing side, from the closed position (along the wall) to the open leaf.
export function doorSymbol(
  wall: Wall,
  door: { t: number; width: number; hinge: "start" | "end"; swing: "A" | "B" },
): DoorSymbol {
  const L = wallLength(wall);
  const dir = wallDirection(wall);
  const normal = wallNormal(wall); // points to side A
  const { a, b } = windowSpan(L, door.t, door.width);

  // Hinge at the door edge nearer the chosen wall end.
  const hingeAlong = door.hinge === "start" ? a : b;
  const jambAlong = door.hinge === "start" ? b : a;
  const hinge = add(wall.start, scale(dir, hingeAlong));
  const jamb = add(wall.start, scale(dir, jambAlong));

  const swingDir = door.swing === "A" ? normal : scale(normal, -1);
  const leafEnd = add(hinge, scale(swingDir, door.width));

  // Sweep flag for the SVG arc from `jamb` to `leafEnd` around `hinge`. In SVG's
  // y-down space, flag 1 sweeps in the direction of a negative 2D cross product.
  const u = { x: jamb.x - hinge.x, y: jamb.y - hinge.y };
  const v = { x: leafEnd.x - hinge.x, y: leafEnd.y - hinge.y };
  const cross = u.x * v.y - u.y * v.x;
  return {
    hinge,
    jamb,
    leafEnd,
    sweepFlag: cross < 0 ? 0 : 1,
    radius: door.width,
  };
}
