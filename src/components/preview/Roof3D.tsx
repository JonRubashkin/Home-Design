import { useMemo } from "react";
import * as THREE from "three";
import type { Level, MaterialRef, RoofSection } from "../../model/types";
import { useStore } from "../../store/store";
import { computeRoof, type RoofPart } from "../../geometry/roof";
import { detectMasses, type RoofMass } from "../../geometry/roofMass";
import { decomposeRectangles } from "../../geometry/roofMass";
import { pointInPolygon } from "../../geometry/polygon";
import { siteBounds } from "../../geometry/planview";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { ROOF_LIFT } from "./stacking";
import { FLOOR_SLAB_THICKNESS } from "../../model/defaults";

// Build a BufferGeometry for one planar roof polygon: fan-triangulate the
// vertices, with planar UVs (projected on X/Z) so patterns tile.
function partGeometry(part: RoofPart): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const uv: number[] = [];
  for (const [x, y, z] of part.vertices) {
    pos.push(x, y, z);
    uv.push(x / PATTERN_TILE_METERS, z / PATTERN_TILE_METERS);
  }
  const index: number[] = [];
  for (let i = 1; i < part.vertices.length - 1; i++) index.push(0, i, i + 1);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function RoofFace({
  part,
  material,
  ghost,
}: {
  part: RoofPart;
  material: MaterialRef;
  ghost: boolean;
}) {
  const geometry = useMemo(() => partGeometry(part), [part]);
  const r = 1 / PATTERN_TILE_METERS;
  const mat = useThreeMaterial(
    material,
    { repeat: [r, r], side: THREE.DoubleSide, roughness: 0.9 },
    { ghost },
  );
  return (
    <mesh geometry={geometry} renderOrder={ghost ? 2 : 0}>
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// One roof section over its wall mass: decompose the mass footprint into
// rectangles and build a roof piece per rectangle, sharing the section's single
// type/pitch/overhang (so an L/T/U gets matching pieces meeting at ridges).
function RoofSectionMesh({
  section,
  masses,
  baseY,
  emptyMassesFallback,
  ghost,
}: {
  section: RoofSection;
  masses: RoofMass[];
  baseY: number;
  emptyMassesFallback: ReturnType<typeof siteBounds> | null;
  ghost: boolean;
}) {
  const parts = useMemo(() => {
    if (!section.visible) return [];
    const mass = masses.find((m) => pointInPolygon(section.anchor, m.footprint));
    // No matching mass: only a wall-less level (e.g. a migrated roof) falls back
    // to the site rectangle; otherwise the section is orphaned and draws nothing.
    const rects = mass
      ? decomposeRectangles(mass.footprint)
      : emptyMassesFallback
        ? [emptyMassesFallback]
        : [];
    const all: RoofPart[] = [];
    for (const rect of rects) {
      const r = computeRoof(
        rect,
        section.type,
        section.pitch,
        section.overhang,
        baseY,
        FLOOR_SLAB_THICKNESS,
      );
      all.push(...r.parts);
    }
    return all;
  }, [section, masses, baseY, emptyMassesFallback]);

  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((part, i) => (
        <RoofFace key={i} part={part} material={section.material} ghost={ghost} />
      ))}
    </>
  );
}

// Every roof section over one level, seated a hair above the wall tops (so a flat
// slab never z-fights the wall-top plane). Each section suppresses in
// Cutaway/Stubs like an upper slab (Invisible/Ghost) so the iso interior stays
// visible; solid in Full; kept solid in active-level-only. The global hide-roofs
// toggle and each section's own `visible` flag also apply.
export function LevelRoofs3D({ level, baseY }: { level: Level; baseY: number }) {
  const viewMode = useStore((s) => s.viewMode);
  const cutawayStyle = useStore((s) => s.cutawayStyle);
  const activeLevelOnly = useStore((s) => s.activeLevelOnly);
  const hideRoofs = useStore((s) => s.hideRoofs);
  const site = useStore((s) => s.design.site);

  const masses = useMemo(() => detectMasses(level.walls), [level.walls]);
  const emptyFallback = masses.length === 0 ? siteBounds(site) : null;

  if (hideRoofs || level.roofs.length === 0) return null;

  const suppress =
    !activeLevelOnly && (viewMode === "cutaway" || viewMode === "stubs");
  if (suppress && cutawayStyle === "invisible") return null;
  const ghost = suppress && cutawayStyle === "ghost";

  return (
    <group>
      {level.roofs.map((section) => (
        <RoofSectionMesh
          key={section.id}
          section={section}
          masses={masses}
          baseY={baseY + ROOF_LIFT}
          emptyMassesFallback={emptyFallback}
          ghost={ghost}
        />
      ))}
    </group>
  );
}
