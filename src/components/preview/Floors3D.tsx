import { useMemo } from "react";
import * as THREE from "three";
import type { FloorRegion, Level, Vec2 } from "../../model/types";
import { useStore } from "../../store/store";
import { FLOOR_SLAB_THICKNESS } from "../../model/defaults";
import { pointInPolygon } from "../../geometry/polygon";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { PATTERN_TILE_METERS } from "../../materials/patterns";

// A user-drawn floor region as a real slab: the polygon extruded down by
// FLOOR_SLAB_THICKNESS so the walking surface (top) sits at the level's
// elevation. The slab doubles as the ceiling of the level below. Stairwell
// openings (from the level below) that fall inside the region become HOLES via
// THREE.Shape hole paths — no CSG — so the floor opens over the stairs and a
// floor region drawn across the opening still renders the hole.
function slabGeometry(polygon: Vec2[], holes: Vec2[][]) {
  const shape = new THREE.Shape(
    polygon.map((p) => new THREE.Vector2(p.x, p.y)),
  );
  for (const hole of holes) {
    if (hole.every((c) => pointInPolygon(c, polygon))) {
      shape.holes.push(
        new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, p.y))),
      );
    }
  }
  // Extrude along +Z; rotating the mesh +90° about X lays it flat with the top
  // cap (z=0) facing up and the body hanging below (world Y [-t, 0]).
  return new THREE.ExtrudeGeometry(shape, {
    depth: FLOOR_SLAB_THICKNESS,
    bevelEnabled: false,
  });
}

function FloorSlab({
  floor,
  elevation,
  selected,
  bias,
  ghost,
  holes,
}: {
  floor: FloorRegion;
  elevation: number;
  selected: boolean;
  bias: number;
  ghost: boolean;
  holes: Vec2[][];
}) {
  const geometry = useMemo(
    () => slabGeometry(floor.polygon, holes),
    [floor.polygon, holes],
  );
  const r = 1 / PATTERN_TILE_METERS;
  const material = useThreeMaterial(
    floor.material,
    { repeat: [r, r], offset: [0, 0], roughness: 0.95 },
    { selected, depthBias: bias, ghost },
  );
  return (
    <mesh
      geometry={geometry}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, elevation, 0]}
      renderOrder={ghost ? 2 : 0}
    >
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// One level's floor slabs. Upper levels' slabs would hide the storey beneath from
// the top-down camera, so in Cutaway/Stubs they get the same Invisible/Ghost
// suppression as walls (`isUpperSlab`); the ground slab always stays solid.
export function Floors3D({
  level,
  elevation,
  isUpperSlab,
  openings,
}: {
  level: Level;
  elevation: number;
  isUpperSlab: boolean;
  openings: Vec2[][];
}) {
  const selection = useStore((s) => s.selection);
  const viewMode = useStore((s) => s.viewMode);
  const cutawayStyle = useStore((s) => s.cutawayStyle);

  const suppress = isUpperSlab && (viewMode === "cutaway" || viewMode === "stubs");
  if (suppress && cutawayStyle === "invisible") return null;
  const ghost = suppress && cutawayStyle === "ghost";

  return (
    <group>
      {level.floors.map((f, i) => (
        <FloorSlab
          key={f.id}
          floor={f}
          elevation={elevation}
          // Later floors (drawn over earlier ones) get more depth bias so they
          // render on top of the area they cover; the rest of the old floor shows.
          bias={i + 1}
          ghost={ghost}
          holes={openings}
          selected={selection?.kind === "floor" && selection.id === f.id}
        />
      ))}
    </group>
  );
}
