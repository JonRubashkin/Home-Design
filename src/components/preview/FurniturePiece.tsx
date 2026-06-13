import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import type { FurnitureItem, MaterialRef } from "../../model/types";
import { getCatalogEntry, type CatalogEntry, type Part } from "../../catalog";
import { planToWorld } from "../../geometry/mapping";
import { useThreeMaterial } from "../../materials/threeMaterial";

const DEG = Math.PI / 180;

function PartMesh({
  part,
  material,
  selected,
}: {
  part: Part;
  material: MaterialRef;
  selected: boolean;
}) {
  const mat = useThreeMaterial(material, {}, { selected });
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
  selected,
  entryOverride,
}: {
  item: FurnitureItem;
  elevation: number;
  selected: boolean;
  entryOverride?: CatalogEntry;
}) {
  const entry = entryOverride ?? getCatalogEntry(item.catalogId);
  const parts = useMemo(() => entry?.build() ?? [], [entry]);
  if (!entry) return null;

  const [wx, , wz] = planToWorld(item.position, 0);
  const y = elevation + (entry.flat ? 0.007 : 0.01);
  const resolve = (slot: string): MaterialRef =>
    item.materials[slot] ?? entry.slots.find((s) => s.name === slot)!.default;

  return (
    <group
      position={[wx, y, wz]}
      rotation={[0, -item.rotation * DEG, 0]}
      scale={[item.scale.x, item.scale.y, item.scale.z]}
    >
      {parts.map((part, i) => (
        <PartMesh
          key={i}
          part={part}
          material={resolve(part.slot)}
          selected={selected}
        />
      ))}
    </group>
  );
}
