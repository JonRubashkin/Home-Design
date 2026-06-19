import { useMemo } from "react";
import * as THREE from "three";
import type { MaterialRef } from "../../model/types";
import { useStore } from "../../store/store";
import { computeRoof, type RoofPart } from "../../geometry/roof";
import { boundsOfPoints, siteBounds, type Bounds } from "../../geometry/planview";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { ROOF_LIFT } from "./stacking";
import { FLOOR_SLAB_THICKNESS } from "../../model/defaults";

// Build a BufferGeometry for one planar roof polygon: fan-triangulate the
// vertices, with planar UVs (projected on X/Z) so patterns tile.
function partGeometry(part: RoofPart): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const uv: number[] = [];
  for (const [x, y, z] of part.vertices) {
    pos.push(x, y, z);
    uv.push(x / PATTERN_TILE_METERS, z / PATTERN_TILE_METERS);
  }
  const index: number[] = [];
  for (let i = 1; i < part.vertices.length - 1; i++) index.push(0, i, i + 1);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function RoofFace({
  part,
  material,
  ghost,
}: {
  part: RoofPart;
  material: MaterialRef;
  ghost: boolean;
}) {
  const geometry = useMemo(() => partGeometry(part), [part]);
  const r = 1 / PATTERN_TILE_METERS;
  const mat = useThreeMaterial(
    material,
    { repeat: [r, r], side: THREE.DoubleSide, roughness: 0.9 },
    { ghost },
  );
  return (
    <mesh geometry={geometry} renderOrder={ghost ? 2 : 0}>
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// One roof over the top level, generated from its wall-footprint bounding
// rectangle. Hidden entirely when `roof.visible` is false (the hide-roof toggle).
// In Cutaway/Stubs it suppresses exactly like an upper floor slab (Invisible /
// Ghost) so it never blocks the iso view of the interior; solid in Full.
export function Roof3D() {
  const roof = useStore((s) => s.design.roof);
  const levels = useStore((s) => s.design.levels);
  const site = useStore((s) => s.design.site);
  const viewMode = useStore((s) => s.viewMode);
  const cutawayStyle = useStore((s) => s.cutawayStyle);
  const activeLevelOnly = useStore((s) => s.activeLevelOnly);

  const top = levels[levels.length - 1];

  const result = useMemo(() => {
    if (!roof || !roof.visible || !top) return null;
    // Footprint = bounding rect of the top level's walls, else the site rect.
    const pts = top.walls.flatMap((w) => [w.start, w.end]);
    const bbox: Bounds = boundsOfPoints(pts) ?? siteBounds(site);
    // Seat the roof a hair ABOVE the wall tops so a flat slab never sits exactly
    // on the wall-top plane (z-fighting); this also keeps sloped eave edges off it.
    const baseY = top.elevation + top.wallHeight + ROOF_LIFT;
    return computeRoof(
      bbox,
      roof.type,
      roof.pitch,
      roof.overhang,
      baseY,
      FLOOR_SLAB_THICKNESS,
    );
  }, [roof, top, site]);

  if (!roof || !roof.visible || !result) return null;

  // Suppress like an upper slab (so the interior stays visible). In active-level-
  // only mode the building is isolated, so keep the roof solid there.
  const suppress =
    !activeLevelOnly && (viewMode === "cutaway" || viewMode === "stubs");
  if (suppress && cutawayStyle === "invisible") return null;
  const ghost = suppress && cutawayStyle === "ghost";

  return (
    <group>
      {result.parts.map((part, i) => (
        <RoofFace key={i} part={part} material={roof.material} ghost={ghost} />
      ))}
    </group>
  );
}
