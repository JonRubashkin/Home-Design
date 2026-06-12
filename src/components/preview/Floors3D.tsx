import { useMemo } from "react";
import * as THREE from "three";
import type { FloorRegion } from "../../model/types";
import { selectCurrentLevel, useStore } from "../../store/store";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { PATTERN_TILE_METERS } from "../../materials/patterns";

// Triangulate a plan polygon into a flat, upward-facing mesh at world height y.
// UVs are in meters so pattern textures tile one cell per meter (matching 2D).
function floorGeometry(polygon: { x: number; y: number }[], y: number) {
  const contour = polygon.map((p) => new THREE.Vector2(p.x, p.y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const position: number[] = [];
  const uv: number[] = [];
  for (const tri of tris) {
    for (const idx of tri) {
      const v = contour[idx]!;
      position.push(v.x, y, v.y);
      uv.push(v.x, v.y);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function Floor3D({
  floor,
  y,
  selected,
}: {
  floor: FloorRegion;
  y: number;
  selected: boolean;
}) {
  const geometry = useMemo(
    () => floorGeometry(floor.polygon, y),
    [floor.polygon, y],
  );
  // UVs are in metres; repeat so one tile spans PATTERN_TILE_METERS (same density
  // as walls). Built via the shared factory so floors and walls branch identically.
  const r = 1 / PATTERN_TILE_METERS;
  const material = useThreeMaterial(
    floor.material,
    { repeat: [r, r], offset: [0, 0], side: THREE.DoubleSide, roughness: 0.95 },
    { selected },
  );
  return (
    <mesh geometry={geometry}>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// Floor regions sit just above the ground plane and render in all view modes.
export function Floors3D() {
  const level = useStore(selectCurrentLevel);
  const selection = useStore((s) => s.selection);
  const y = level.elevation + 0.005;
  return (
    <group>
      {level.floors.map((f) => (
        <Floor3D
          key={f.id}
          floor={f}
          y={y}
          selected={selection?.kind === "floor" && selection.id === f.id}
        />
      ))}
    </group>
  );
}
