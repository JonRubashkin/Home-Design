import type { Vec2, Wall, WallMount } from "../model/types";
import { add, scale } from "./vec";
import { wallDirection, wallLength, wallNormal } from "./wall";
import { planToWorld } from "./mapping";
import type { OrientedFootprint } from "./furniture";

const DEG = Math.PI / 180;

// Outward (room-ward) unit normal of the chosen wall face in plan space. Side A
// is the wall normal (left of start->end); side B is its negation.
export function mountFaceNormal(wall: Pick<Wall, "start" | "end">, face: "A" | "B"): Vec2 {
  const n = wallNormal(wall);
  return face === "A" ? n : { x: -n.x, y: -n.y };
}

// The mount's footprint in the PLAN as an oriented rectangle: centered just off
// the chosen face (wall thickness/2 + protrusion/2 out along the face normal),
// `width` running along the wall and `depth` (protrusion) out from it. Used for
// the 2D marker and for plan hit-testing (via footprintCorners / pointInFootprint).
export function wallMountPlanFootprint(
  wall: Wall,
  t: number,
  face: "A" | "B",
  width: number,
  protrusion: number,
): OrientedFootprint {
  const L = wallLength(wall);
  const dir = wallDirection(wall);
  const nFace = mountFaceNormal(wall, face);
  const base = add(wall.start, scale(dir, t * L));
  const center = add(base, scale(nFace, wall.thickness / 2 + protrusion / 2));
  // Plan rotation (SVG-clockwise degrees) whose local +y (front) points along
  // nFace, matching the FurniturePiece rotation convention.
  const rotation = Math.atan2(-nFace.x, nFace.y) / DEG;
  return { center, rotation, footprint: { width, depth: protrusion } };
}

export interface WallMountWorld {
  position: [number, number, number]; // world group position
  rotationY: number; // radians about world Y
}

// World transform for a wall mount's 3D group: positioned on the chosen face,
// offset outward by (wall thickness/2 + protrusion/2), with its vertical CENTER
// at `elevation + heightUpWall`, oriented so its front (+z) faces away from the
// wall. `dims` is the scaled real-world size (width × depth(protrusion) × height).
export function wallMountWorld(
  wall: Wall,
  mount: Pick<WallMount, "t" | "face" | "heightUpWall">,
  dims: { width: number; depth: number; height: number },
  elevation: number,
): WallMountWorld {
  const { center } = wallMountPlanFootprint(
    wall,
    mount.t,
    mount.face,
    dims.width,
    dims.depth,
  );
  const [wx, , wz] = planToWorld(center, 0);
  const nFace = mountFaceNormal(wall, mount.face);
  const rotationDeg = Math.atan2(-nFace.x, nFace.y) / DEG;
  return {
    position: [wx, elevation + mount.heightUpWall - dims.height / 2, wz],
    rotationY: -rotationDeg * DEG,
  };
}
