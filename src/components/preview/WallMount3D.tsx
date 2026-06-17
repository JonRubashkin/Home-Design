import { useMemo } from "react";
import type { MaterialRef, Wall, WallMount } from "../../model/types";
import { getCatalogEntry, effectiveDimensions } from "../../catalog";
import { wallMountWorld } from "../../geometry/wallMount";
import { PartMesh } from "./FurniturePiece";

// One wall-mounted item: a group on the chosen wall face, offset out along the
// wall normal, with its vertical center at `elevation + heightUpWall`, oriented
// to face away from the wall and scaled by the mount's per-axis scale. Rendered
// as a child of Wall3D so it inherits the wall's cutaway/ghost suppression and is
// hidden in stub mode (it sits above the stub height, like windows). Materials
// come through the shared helper so patterns work for free.
export function WallMount3D({
  wall,
  mount,
  elevation,
  selected,
  ghost,
}: {
  wall: Wall;
  mount: WallMount;
  elevation: number;
  selected: boolean;
  ghost: boolean;
}) {
  const entry = getCatalogEntry(mount.catalogId);
  const parts = useMemo(() => (entry ? entry.build() : []), [entry]);
  if (!entry || entry.mount !== "wall") return null;

  const dims = effectiveDimensions(entry, mount.scale);
  const { position, rotationY } = wallMountWorld(wall, mount, dims, elevation);
  const resolve = (slot: string): MaterialRef =>
    mount.materials[slot] ?? entry.slots.find((s) => s.name === slot)!.default;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[mount.scale.x, mount.scale.y, mount.scale.z]}
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
          ghost={ghost}
        />
      ))}
    </group>
  );
}
