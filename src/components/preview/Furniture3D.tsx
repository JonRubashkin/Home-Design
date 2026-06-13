import { useMemo } from "react";
import { selectCurrentLevel, useStore } from "../../store/store";
import { getCatalogEntry, effectiveDimensions } from "../../catalog";
import {
  computeStackBaseLifts,
  type StackItem,
} from "../../geometry/furniture";
import { FurniturePiece } from "./FurniturePiece";
import { FLAT_ITEM_LIFT, ITEM_LIFT, STACK_LIFT } from "./stacking";

// Furniture renders in all three wall view modes (wall modes never hide it).
// Small "stackable" items centered over a surface item (a counter, table…)
// automatically rest on that surface's top instead of being buried inside it.
export function Furniture3D() {
  const level = useStore(selectCurrentLevel);
  const selection = useStore((s) => s.selection);
  const furniture = level.furniture;

  // Resolve each item's base lift above the floor (floor / flat / on a surface).
  const baseLifts = useMemo(() => {
    const stackItems: StackItem[] = furniture.flatMap((item) => {
      const entry = getCatalogEntry(item.catalogId);
      if (!entry) return [];
      const dims = effectiveDimensions(entry, item.scale);
      return [
        {
          id: item.id,
          center: item.position,
          rotation: item.rotation,
          footprint: { width: dims.width, depth: dims.depth },
          flat: entry.flat ?? false,
          stackable: entry.stackable ?? false,
          surfaceTop:
            entry.surfaceTop != null ? entry.surfaceTop * item.scale.y : null,
        },
      ];
    });
    return computeStackBaseLifts(stackItems, {
      floor: ITEM_LIFT,
      flat: FLAT_ITEM_LIFT,
      stack: STACK_LIFT,
    });
  }, [furniture]);

  return (
    <group>
      {furniture.map((item) => (
        <FurniturePiece
          key={item.id}
          item={item}
          elevation={level.elevation}
          baseLift={baseLifts.get(item.id)}
          selected={selection?.kind === "furniture" && selection.id === item.id}
        />
      ))}
    </group>
  );
}
