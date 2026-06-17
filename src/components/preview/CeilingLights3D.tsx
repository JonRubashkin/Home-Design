import { useMemo } from "react";
import type { CeilingLight, Level, MaterialRef } from "../../model/types";
import { useStore } from "../../store/store";
import { getCatalogEntry, effectiveDimensions } from "../../catalog";
import { planToWorld } from "../../geometry/mapping";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { PartMesh } from "./FurniturePiece";

// One ceiling light. `build()` parts rise y-up from 0 (bulb) to `height`
// (canopy); the fixture is positioned so its canopy sits at `ceilingY - drop`,
// and a thin cord cylinder bridges the gap up to the ceiling. Materials resolve
// through the shared helper (PartMesh). Excluded from collision; plan-selectable.
function CeilingLight3D({
  light,
  ceilingY,
  selected,
}: {
  light: CeilingLight;
  ceilingY: number;
  selected: boolean;
}) {
  const entry = getCatalogEntry(light.catalogId);
  const parts = useMemo(() => (entry ? entry.build() : []), [entry]);
  const dims = entry ? effectiveDimensions(entry, light.scale) : null;
  const cordRef: MaterialRef = entry
    ? (light.materials[entry.slots[0]!.name] ?? entry.slots[0]!.default)
    : { kind: "solid", color: "#cdd1d6" };
  const cordMat = useThreeMaterial(cordRef, {}, { selected });
  if (!entry || entry.mount !== "ceiling" || !dims) return null;

  const [wx, , wz] = planToWorld(light.position, 0);
  const topY = ceilingY - light.drop; // fixture canopy
  const groupY = topY - dims.height; // fixture base (build is y-up from 0)
  const resolve = (slot: string): MaterialRef =>
    light.materials[slot] ?? entry.slots.find((s) => s.name === slot)!.default;

  return (
    <group>
      {light.drop > 0.001 && (
        <mesh position={[wx, ceilingY - light.drop / 2, wz]}>
          <cylinderGeometry args={[0.012, 0.012, light.drop, 8]} />
          <primitive object={cordMat} attach="material" />
        </mesh>
      )}
      <group
        position={[wx, groupY, wz]}
        scale={[light.scale.x, light.scale.y, light.scale.z]}
      >
        {parts.map((part, i) => (
          <PartMesh
            key={i}
            part={part}
            material={resolve(part.slot)}
            selected={selected}
            hovered={false}
            warned={false}
            doubleSided={false}
          />
        ))}
      </group>
    </group>
  );
}

// All ceiling lights on a level. They hang from this level's ceiling (its slab /
// roof above) at `ceilingY = elevation + wallHeight`. Hidden in Stubs (they sit
// above the stub height, like windows); shown in Full and Cutaway (in Cutaway the
// ceiling/roof above is suppressed, so the lights become visible — correct).
export function CeilingLights3D({
  level,
  ceilingY,
}: {
  level: Level;
  ceilingY: number;
}) {
  const selection = useStore((s) => s.selection);
  const viewMode = useStore((s) => s.viewMode);
  if (viewMode === "stubs") return null;

  return (
    <group>
      {level.ceilingLights.map((light) => (
        <CeilingLight3D
          key={light.id}
          light={light}
          ceilingY={ceilingY}
          selected={
            selection?.kind === "ceilingLight" && selection.id === light.id
          }
        />
      ))}
    </group>
  );
}
