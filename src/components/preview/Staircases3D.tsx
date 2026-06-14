import { useState, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Level } from "../../model/types";
import { useStore } from "../../store/store";
import { FLOOR_SLAB_THICKNESS } from "../../model/defaults";
import { Staircase3D } from "./Staircase3D";
import { resolveItemId, isClick } from "./picking";

// One level's staircases, rendered and pickable (like furniture). Hovering tints
// the stair; a clean click selects it through the shared selection state and
// switches the active level if needed. `warnedSet` (collision) is computed once
// in Building3D so stairs and furniture share the same overlap check.
export function Staircases3D({
  level,
  elevation,
  warnedSet,
  pointerDownRef,
}: {
  level: Level;
  elevation: number;
  warnedSet: Set<string>;
  pointerDownRef: RefObject<{ x: number; y: number } | null>;
}) {
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const setCurrentLevel = useStore((s) => s.setCurrentLevel);
  const currentLevelId = useStore((s) => s.currentLevelId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const storeyHeight = level.wallHeight + FLOOR_SLAB_THICKNESS;

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.buttons !== 0) return;
    setHoveredId(resolveItemId(e.object));
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = resolveItemId(e.object);
    setHoveredId((h) => (h === id ? null : h));
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isClick(pointerDownRef.current, { x: e.clientX, y: e.clientY })) return;
    const id = resolveItemId(e.object);
    if (!id) return;
    if (level.id !== currentLevelId) setCurrentLevel(level.id);
    setSelection({ kind: "staircase", id });
  };

  return (
    <group>
      {level.staircases.map((stair) => (
        <Staircase3D
          key={stair.id}
          stair={stair}
          elevation={elevation}
          storeyHeight={storeyHeight}
          selected={
            selection?.kind === "staircase" && selection.id === stair.id
          }
          hovered={hoveredId === stair.id}
          warned={warnedSet.has(stair.id)}
          onPointerOver={onOver}
          onPointerOut={onOut}
          onClick={onClick}
        />
      ))}
    </group>
  );
}
