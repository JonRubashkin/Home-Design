import { useMemo } from "react";
import * as THREE from "three";
import type { Level, MaterialRef, Roof } from "../../model/types";
import { useStore } from "../../store/store";
import {
  computeRoof,
  computePolygonRoof,
  type RoofPart,
} from "../../geometry/roof";
import { roofLocalBounds } from "../../geometry/roofPlacement";
import { planToWorld } from "../../geometry/mapping";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { ROOF_LIFT } from "./stacking";
import { FLOOR_SLAB_THICKNESS } from "../../model/defaults";

const DEG = Math.PI / 180;

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

// One manually placed roof rectangle: build the roof over the LOCAL (centered,
// axis-aligned) rectangle via `computeRoof`, then a parent group rotates it about
// world Y (matching the plan's SVG-clockwise rotation, like furniture) and seats
// it at the roof's plan position. Roofs are independent of walls — they cover the
// drawn rectangle at the level's wall-top height.
function RoofMesh({
  roof,
  baseY,
  ghost,
}: {
  roof: Roof;
  baseY: number;
  ghost: boolean;
}) {
  const parts = useMemo(() => {
    if (!roof.visible) return [];
    // A polygon (auto) roof covers its static footprint (absolute plan coords),
    // so its parts are already in world X/Z — no group transform needed.
    if (roof.shape === "polygon" && roof.footprint && roof.footprint.length >= 3)
      return computePolygonRoof(
        roof.footprint,
        roof.type,
        roof.pitch,
        roof.overhang,
        baseY,
        FLOOR_SLAB_THICKNESS,
      ).parts;
    // A rect roof is built over its LOCAL centered rectangle; the parent group
    // applies its plan position + rotation.
    return computeRoof(
      roofLocalBounds(roof),
      roof.type,
      roof.pitch,
      roof.overhang,
      baseY,
      FLOOR_SLAB_THICKNESS,
    ).parts;
  }, [roof, baseY]);

  if (parts.length === 0) return null;
  if (roof.shape === "polygon") {
    return (
      <group>
        {parts.map((part, i) => (
          <RoofFace key={i} part={part} material={roof.material} ghost={ghost} />
        ))}
      </group>
    );
  }
  const [wx, , wz] = planToWorld(roof.position, 0);
  return (
    <group position={[wx, 0, wz]} rotation={[0, -roof.rotation * DEG, 0]}>
      {parts.map((part, i) => (
        <RoofFace key={i} part={part} material={roof.material} ghost={ghost} />
      ))}
    </group>
  );
}

// Every manual roof on one level, seated a hair above the wall tops (so a flat
// slab never z-fights the wall-top plane). Each roof suppresses in Cutaway/Stubs
// like an upper slab (Invisible/Ghost) so the iso interior stays visible; solid
// in Full; kept solid in active-level-only. The global hide-roofs toggle and each
// roof's own `visible` flag also apply.
export function LevelRoofs3D({ level, baseY }: { level: Level; baseY: number }) {
  const viewMode = useStore((s) => s.viewMode);
  const cutawayStyle = useStore((s) => s.cutawayStyle);
  const activeLevelOnly = useStore((s) => s.activeLevelOnly);
  const hideRoofs = useStore((s) => s.hideRoofs);

  if (hideRoofs || level.roofs.length === 0) return null;

  const suppress =
    !activeLevelOnly && (viewMode === "cutaway" || viewMode === "stubs");
  if (suppress && cutawayStyle === "invisible") return null;
  const ghost = suppress && cutawayStyle === "ghost";

  return (
    <group>
      {level.roofs.map((roof) => (
        <RoofMesh
          key={roof.id}
          roof={roof}
          baseY={baseY + ROOF_LIFT}
          ghost={ghost}
        />
      ))}
    </group>
  );
}
