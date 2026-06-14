import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { MaterialRef, Staircase } from "../../model/types";
import { computeStair } from "../../geometry/stair";
import { STAIR_TREAD_DEPTH } from "../../model/defaults";
import { planToWorld } from "../../geometry/mapping";
import { useThreeMaterial } from "../../materials/threeMaterial";

const DEG = Math.PI / 180;

function StepMesh({
  size,
  position,
  material,
  selected,
  hovered,
  warned,
}: {
  size: [number, number, number];
  position: [number, number, number];
  material: MaterialRef;
  selected: boolean;
  hovered: boolean;
  warned: boolean;
}) {
  const mat = useThreeMaterial(material, {}, { selected, hovered, warned });
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// A straight staircase: a solid box per step rising from the lower level's
// elevation toward the floor above. Steps run along local +z (the ascent/up
// direction), matching the plan up-arrow. Pickable like furniture.
export function Staircase3D({
  stair,
  elevation,
  storeyHeight,
  selected,
  hovered = false,
  warned = false,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  stair: Staircase;
  elevation: number;
  storeyHeight: number;
  selected: boolean;
  hovered?: boolean;
  warned?: boolean;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const g = useMemo(
    () => computeStair(stair, storeyHeight),
    [stair, storeyHeight],
  );
  const [wx, , wz] = planToWorld(stair.position, 0);

  return (
    <group
      userData={{ itemId: stair.id }}
      position={[wx, elevation, wz]}
      rotation={[0, -stair.rotation * DEG, 0]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      {Array.from({ length: g.steps }, (_, i) => {
        const h = (i + 1) * g.riser; // solid block up to this step's top
        const z = -g.runLength / 2 + (i + 0.5) * STAIR_TREAD_DEPTH;
        return (
          <StepMesh
            key={i}
            size={[stair.width, h, STAIR_TREAD_DEPTH]}
            position={[0, h / 2, z]}
            material={stair.material}
            selected={selected}
            hovered={hovered}
            warned={warned}
          />
        );
      })}
    </group>
  );
}
