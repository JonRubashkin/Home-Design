import { type RefObject } from "react";
import { useStore } from "../../store/store";
import { Walls3D } from "./Walls3D";
import { Floors3D } from "./Floors3D";
import { Furniture3D } from "./Furniture3D";

// The whole stacked building: every level rendered at its computed elevation, or
// just the active level when "Active level only" is on. Each level's floor slabs,
// walls, and furniture sit at that level's elevation. Upper-level slabs are
// marked so Cutaway/Stubs can suppress them and reveal the storey below.
export function Building3D({
  pointerDownRef,
}: {
  pointerDownRef: RefObject<{ x: number; y: number } | null>;
}) {
  const levels = useStore((s) => s.design.levels);
  const currentLevelId = useStore((s) => s.currentLevelId);
  const activeLevelOnly = useStore((s) => s.activeLevelOnly);

  const groundId = levels[0]?.id;
  const rendered = activeLevelOnly
    ? levels.filter((l) => l.id === currentLevelId)
    : levels;

  return (
    <group>
      {rendered.map((level) => {
        // A slab is "upper" (suppressible) only when it could hide a storey
        // below — i.e. it's not the ground level and we're stacking >1 level.
        const isUpperSlab = !activeLevelOnly && level.id !== groundId;
        return (
          <group key={level.id}>
            <Floors3D
              level={level}
              elevation={level.elevation}
              isUpperSlab={isUpperSlab}
            />
            <Walls3D level={level} elevation={level.elevation} />
            <Furniture3D
              level={level}
              elevation={level.elevation}
              pointerDownRef={pointerDownRef}
            />
          </group>
        );
      })}
    </group>
  );
}
