import { useMemo, type RefObject } from "react";
import type { Level, Vec2 } from "../../model/types";
import { useStore } from "../../store/store";
import { getCatalogEntry, effectiveDimensions, collisionExtent } from "../../catalog";
import {
  collidingMovableIds,
  wallFootprint,
  type CollisionItem,
} from "../../geometry/furniture";
import { computeStair } from "../../geometry/stair";
import { FLOOR_SLAB_THICKNESS } from "../../model/defaults";
import { Walls3D } from "./Walls3D";
import { CornerPosts3D } from "./CornerPosts3D";
import { Floors3D } from "./Floors3D";
import { Roof3D } from "./Roof3D";
import { Furniture3D } from "./Furniture3D";
import { Staircases3D } from "./Staircases3D";

// Collidable footprints on a level (collidable furniture + all staircases), then
// the ids overlapping another item, a wall, or a stairwell opening (the floor
// hole from `below`'s staircases) — shared by furniture and stairs.
function warnedIdsFor(level: Level, below: Level | undefined): Set<string> {
  const items: CollisionItem[] = [];
  for (const item of level.furniture) {
    const entry = getCatalogEntry(item.catalogId);
    if (!entry) continue;
    const d = effectiveDimensions(entry, item.scale);
    const ext = collisionExtent(entry, item.scale);
    items.push({
      id: item.id,
      collidable: entry.collidable,
      footprint: {
        center: item.position,
        rotation: item.rotation,
        footprint: { width: d.width, depth: d.depth },
      },
      vertical: { base: 0, height: ext.height },
      tuck: { legClearance: ext.legClearance, tuckHeight: ext.tuckHeight },
    });
  }
  const storey = level.wallHeight + FLOOR_SLAB_THICKNESS;
  for (const stair of level.staircases) {
    const g = computeStair(stair, storey);
    items.push({
      id: stair.id,
      collidable: true,
      footprint: {
        center: stair.position,
        rotation: stair.rotation,
        footprint: { width: stair.width, depth: g.runLength },
      },
      vertical: { base: 0, height: storey },
    });
  }
  const barriers = [
    ...level.walls.map(wallFootprint),
    ...(below
      ? below.staircases.map((s) => {
          const g = computeStair(s, below.wallHeight + FLOOR_SLAB_THICKNESS);
          return {
            center: s.position,
            rotation: s.rotation,
            footprint: { width: s.width, depth: g.runLength },
          };
        })
      : []),
  ];
  return collidingMovableIds(items, barriers);
}

// Stairwell opening rectangles a level's staircases cut from the floor ABOVE.
function openingsOf(level: Level): Vec2[][] {
  const storey = level.wallHeight + FLOOR_SLAB_THICKNESS;
  return level.staircases.map((s) => computeStair(s, storey).opening);
}

// The whole stacked building: every level at its computed elevation (or just the
// active level). Floor slabs of a level get holes cut for the staircases on the
// level BELOW, so upper floors open over the stairs.
export function Building3D({
  pointerDownRef,
}: {
  pointerDownRef: RefObject<{ x: number; y: number } | null>;
}) {
  const levels = useStore((s) => s.design.levels);
  const currentLevelId = useStore((s) => s.currentLevelId);
  const activeLevelOnly = useStore((s) => s.activeLevelOnly);
  const collisionMode = useStore((s) => s.collisionMode);

  const groundId = levels[0]?.id;
  const rendered = activeLevelOnly
    ? levels.filter((l) => l.id === currentLevelId)
    : levels;

  const warnedByLevel = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (collisionMode !== "off")
      levels.forEach((l, i) => m.set(l.id, warnedIdsFor(l, levels[i - 1])));
    return m;
  }, [levels, collisionMode]);

  return (
    <group>
      {rendered.map((level) => {
        const isUpperSlab = !activeLevelOnly && level.id !== groundId;
        // Holes cut from this level's floor = openings of the level directly
        // below it (use the full levels array index, not the rendered one).
        const fullIdx = levels.findIndex((l) => l.id === level.id);
        const below = fullIdx > 0 ? levels[fullIdx - 1] : undefined;
        const openings = below ? openingsOf(below) : [];
        const warned = warnedByLevel.get(level.id) ?? new Set<string>();
        return (
          <group key={level.id}>
            <Floors3D
              level={level}
              elevation={level.elevation}
              isUpperSlab={isUpperSlab}
              openings={openings}
            />
            <Walls3D
              level={level}
              elevation={level.elevation}
              skirt={isUpperSlab ? FLOOR_SLAB_THICKNESS : 0}
            />
            <CornerPosts3D
              level={level}
              elevation={level.elevation}
              skirt={isUpperSlab ? FLOOR_SLAB_THICKNESS : 0}
            />
            <Staircases3D
              level={level}
              elevation={level.elevation}
              warnedSet={warned}
              pointerDownRef={pointerDownRef}
            />
            <Furniture3D
              level={level}
              elevation={level.elevation}
              warnedSet={warned}
              pointerDownRef={pointerDownRef}
            />
          </group>
        );
      })}
      {/* One roof over the whole top level (suppresses in Cutaway/Stubs). */}
      <Roof3D />
    </group>
  );
}
