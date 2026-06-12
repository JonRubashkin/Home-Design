import type { FaceRect } from "../geometry/boxes";

export interface TexTransform {
  repeat: [number, number];
  offset: [number, number];
}

// Map a wall sub-box face onto a world-anchored texture so the pattern flows
// continuously across the sub-boxes of a windowed wall. With one tile spanning
// `tileMeters`, the texture coordinate at along-wall position p / height y is
// p/tile, y/tile on every box.
//
// Three.js BoxGeometry UVs: the +Z face's u runs with +x and the -Z face's u is
// mirrored, while v is bottom-up on both. So side A (the -Z face) needs a
// negative repeat.x and a shifted offset to keep the same world-anchored
// coordinate as side B (+Z).
export function faceTextureTransform(
  face: FaceRect,
  tileMeters: number,
  mirror: boolean,
): TexTransform {
  const rx = face.w / tileMeters;
  const ry = face.h / tileMeters;
  const oy = face.v0 / tileMeters;
  if (mirror) {
    return { repeat: [-rx, ry], offset: [(face.u0 + face.w) / tileMeters, oy] };
  }
  return { repeat: [rx, ry], offset: [face.u0 / tileMeters, oy] };
}
