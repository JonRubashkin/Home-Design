import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { FurnitureItem, MaterialRef } from "../../model/types";
import { getCatalogEntry, type CatalogEntry, type Part } from "../../catalog";
import { planToWorld } from "../../geometry/mapping";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { FLAT_ITEM_LIFT, ITEM_LIFT } from "./stacking";

const DEG = Math.PI / 180;

function PartMesh({
  part,
  material,
  selected,
  hovered,
  doubleSided,
}: {
  part: Part;
  material: MaterialRef;
  selected: boolean;
  hovered: boolean;
  // Flat items (rugs/mats) render double-sided so their thin faces never get
  // backface-culled and vanish when the camera orbits to a low / overhead angle.
  doubleSided: boolean;
}) {
  const mat = useThreeMaterial(
    material,
    doubleSided ? { side: THREE.DoubleSide } : {},
    { selected, hovered },
  );
  const p = part.primitive;
  const common = {
    position: part.position,
    rotation: part.rotation ?? ([0, 0, 0] as [number, number, number]),
  };
  if (p.kind === "cylinder") {
    return (
      <mesh {...common}>
        <cylinderGeometry args={[p.radiusTop, p.radiusBottom, p.height, 20]} />
        <primitive object={mat} attach="material" />
      </mesh>
    );
  }
  if (p.kind === "roundedBox") {
    return (
      <RoundedBox args={p.size} radius={p.radius} smoothness={3} {...common}>
        <primitive object={mat} attach="material" />
      </RoundedBox>
    );
  }
  return (
    <mesh {...common}>
      <boxGeometry args={p.size} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// One furniture instance: a group at the footprint center, rotated about Y to
// match the plan rotation, with each catalog part rendered via the shared
// material factory (so patterns work for free). Renders in all view modes.
export function FurniturePiece({
  item,
  elevation,
  baseLift,
  selected,
  hovered = false,
  entryOverride,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  item: FurnitureItem;
  elevation: number;
  // World-Y above the floor at which this item's base rests (from the stacking
  // resolver). Omitted by direct callers (e.g. the catalog QA view), which fall
  // back to the plain per-layer lift.
  baseLift?: number;
  selected: boolean;
  hovered?: boolean;
  entryOverride?: CatalogEntry;
  // Picking handlers (3D selection). Omitted by the catalog QA view.
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const entry = entryOverride ?? getCatalogEntry(item.catalogId);
  const parts = useMemo(() => entry?.build() ?? [], [entry]);
  if (!entry) return null;

  const [wx, , wz] = planToWorld(item.position, 0);
  // Flat items (rugs) sit just above floor regions; everything else sits just
  // above the flat layer, so stacked/overlapping items never share a Y. A
  // resolved baseLift (item resting on a surface) overrides the default.
  const lift = baseLift ?? (entry.flat ? FLAT_ITEM_LIFT : ITEM_LIFT);
  const y = elevation + lift;
  const resolve = (slot: string): MaterialRef =>
    item.materials[slot] ?? entry.slots.find((s) => s.name === slot)!.default;

  return (
    <group
      userData={{ itemId: item.id }}
      position={[wx, y, wz]}
      rotation={[0, -item.rotation * DEG, 0]}
      scale={[item.scale.x, item.scale.y, item.scale.z]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      {parts.map((part, i) => (
        <PartMesh
          key={i}
          part={part}
          material={resolve(part.slot)}
          selected={selected}
          hovered={hovered}
          doubleSided={entry.flat ?? false}
        />
      ))}
    </group>
  );
}
