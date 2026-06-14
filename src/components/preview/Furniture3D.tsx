import { useEffect, useMemo, useState, type RefObject } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { Level } from "../../model/types";
import { useStore } from "../../store/store";
import { getCatalogEntry, effectiveDimensions } from "../../catalog";
import {
  computeStackBaseLifts,
  collidingIds,
  type StackItem,
  type CollisionItem,
} from "../../geometry/furniture";
import { FurniturePiece } from "./FurniturePiece";
import { FLAT_ITEM_LIFT, ITEM_LIFT, STACK_LIFT } from "./stacking";
import { resolveItemId, isClick } from "./picking";

// Furniture renders in all three wall view modes (wall modes never hide it).
// Small "stackable" items centered over a surface item (a counter, table…)
// automatically rest on that surface's top instead of being buried inside it.
//
// Phase 3a: furniture is the only pickable geometry in 3D. Hovering highlights
// an item and shows a pointer cursor; a clean click (not an orbit drag) selects
// it through the SAME selection state the plan uses. `pointerDownRef` carries
// the pointer-down position so we can tell a click from a drag (deselect on
// empty space is handled by the Canvas's onPointerMissed in Preview3D).
export function Furniture3D({
  level,
  elevation,
  pointerDownRef,
}: {
  level: Level;
  elevation: number;
  pointerDownRef: RefObject<{ x: number; y: number } | null>;
}) {
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const setCurrentLevel = useStore((s) => s.setCurrentLevel);
  const currentLevelId = useStore((s) => s.currentLevelId);
  const collisionMode = useStore((s) => s.collisionMode);
  const furniture = level.furniture;

  // Collision warning set (red tint) — same SAT check as the 2D plan.
  const warnedSet = useMemo(() => {
    if (collisionMode === "off") return new Set<string>();
    const items: CollisionItem[] = furniture.flatMap((item) => {
      const entry = getCatalogEntry(item.catalogId);
      if (!entry) return [];
      const d = effectiveDimensions(entry, item.scale);
      return [
        {
          id: item.id,
          collidable: entry.collidable,
          footprint: {
            center: item.position,
            rotation: item.rotation,
            footprint: { width: d.width, depth: d.depth },
          },
        },
      ];
    });
    return collidingIds(items);
  }, [furniture, collisionMode]);

  const gl = useThree((s) => s.gl);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Drop hover (and its cursor) when the hovered item disappears.
  useEffect(() => {
    if (hoveredId && !furniture.some((f) => f.id === hoveredId))
      setHoveredId(null);
  }, [furniture, hoveredId]);

  // Pointer cursor while hovering a pickable item.
  useEffect(() => {
    const el = gl.domElement;
    el.style.cursor = hoveredId ? "pointer" : "";
    return () => {
      el.style.cursor = "";
    };
  }, [gl, hoveredId]);

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

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.buttons !== 0) return; // mid-orbit drag — don't hover
    setHoveredId(resolveItemId(e.object));
  };
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = resolveItemId(e.object);
    setHoveredId((h) => (h === id ? null : h));
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Ignore the "click" that ends a camera-orbit drag.
    if (!isClick(pointerDownRef.current, { x: e.clientX, y: e.clientY })) return;
    const id = resolveItemId(e.object);
    if (!id) return;
    // Selecting an item on a non-active level switches editing to that level so
    // the plan and properties panel act on it (documented behavior).
    if (level.id !== currentLevelId) setCurrentLevel(level.id);
    setSelection({ kind: "furniture", id });
  };

  return (
    <group>
      {furniture.map((item) => (
        <FurniturePiece
          key={item.id}
          item={item}
          elevation={elevation}
          baseLift={baseLifts.get(item.id)}
          selected={selection?.kind === "furniture" && selection.id === item.id}
          hovered={hoveredId === item.id}
          warned={warnedSet.has(item.id)}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
      ))}
    </group>
  );
}
