import type { Design } from "./types";
import { DEFAULT_SITE } from "./site";

// Ordered schema migrations. `migrations[i]` upgrades a design from version
// (i + 1) to (i + 2). Applied in sequence on import/load so older saved designs
// open without manual conversion. To add v2->v3, append another function here.
type RawDesign = Record<string, unknown>;
type Migration = (design: RawDesign) => RawDesign;

const migrations: Migration[] = [
  // v1 -> v2: doors. Every wall gains an empty `doors` array.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      const walls = (level.walls as RawDesign[] | undefined) ?? [];
      for (const wall of walls) {
        if (!Array.isArray(wall.doors)) wall.doors = [];
      }
    }
    design.schemaVersion = 2;
    return design;
  },
  // v2 -> v3: furniture. Every level gains an empty `furniture` array.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      if (!Array.isArray(level.furniture)) level.furniture = [];
    }
    design.schemaVersion = 3;
    return design;
  },
  // v3 -> v4: per-item furniture scaling. Every item gains a unit scale.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      const furniture = (level.furniture as RawDesign[] | undefined) ?? [];
      for (const item of furniture) {
        if (
          typeof item.scale !== "object" ||
          item.scale === null ||
          Array.isArray(item.scale)
        ) {
          item.scale = { x: 1, y: 1, z: 1 };
        }
      }
    }
    design.schemaVersion = 4;
    return design;
  },
  // v4 -> v5: work area. The design gains a default (large) site so nothing
  // already drawn falls outside it.
  (design) => {
    if (
      typeof design.site !== "object" ||
      design.site === null ||
      Array.isArray(design.site)
    ) {
      design.site = { ...DEFAULT_SITE };
    }
    design.schemaVersion = 5;
    return design;
  },
  // v5 -> v6: staircases. Every level gains an empty `staircases` array.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      if (!Array.isArray(level.staircases)) level.staircases = [];
    }
    design.schemaVersion = 6;
    return design;
  },
  // v6 -> v7: tree/shrub variants. Pre-4c trees and hedges become the default
  // variant matching their old look. The shrub footprint shrank from 1.5x0.5 to
  // a 0.8 square, so existing hedges get their length (x scale) widened to keep
  // their real-world width. Values are frozen here so this migration is stable.
  (design) => {
    const HEDGE_WIDTH_FACTOR = 1.5 / 0.8; // old footprint width / new
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      const furniture = (level.furniture as RawDesign[] | undefined) ?? [];
      for (const item of furniture) {
        if (item.catalogId === "tree" && item.variant === undefined) {
          item.variant = "broadleaf";
        } else if (item.catalogId === "hedge" && item.variant === undefined) {
          item.variant = "spreading";
          const scale = item.scale as RawDesign | undefined;
          if (scale && typeof scale.x === "number") {
            // Preserve the old width; clamp to the new x range [0.4, 4.0].
            const x = scale.x * HEDGE_WIDTH_FACTOR;
            scale.x = Math.max(0.4, Math.min(4.0, x));
          }
        }
      }
    }
    design.schemaVersion = 7;
    return design;
  },
  // v7 -> v8: wall-mounted items. Every wall gains an empty `mounts` array.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      const walls = (level.walls as RawDesign[] | undefined) ?? [];
      for (const wall of walls) {
        if (!Array.isArray(wall.mounts)) wall.mounts = [];
      }
    }
    design.schemaVersion = 8;
    return design;
  },
  // v8 -> v9: roofs. The design gains a `roof` field (null = no roof) so existing
  // designs open unchanged with no roof.
  (design) => {
    if (design.roof === undefined) design.roof = null;
    design.schemaVersion = 9;
    return design;
  },
  // v9 -> v10: ceiling lights. Every level gains an empty `ceilingLights` array.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      if (!Array.isArray(level.ceilingLights)) level.ceilingLights = [];
    }
    design.schemaVersion = 10;
    return design;
  },
  // v10 -> v11: per-level, multi-section roofs (Phase 5.1). The single
  // `Design.roof` is replaced by `Level.roofs: RoofSection[]`. Every level gains
  // an empty `roofs` array; an existing top-level roof becomes one section over
  // the top level, anchored at its wall-footprint centroid (site centroid if it
  // has no walls). The old `Design.roof` is then dropped.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      if (!Array.isArray(level.roofs)) level.roofs = [];
    }
    const oldRoof = design.roof;
    const top = levels[levels.length - 1];
    if (oldRoof && typeof oldRoof === "object" && top) {
      const roof = oldRoof as RawDesign;
      top.roofs = [
        {
          id: `roof_${Math.random().toString(36).slice(2, 10)}`,
          anchor: topFootprintCentroid(top, design),
          type: roof.type,
          pitch: roof.pitch,
          overhang: roof.overhang,
          visible: roof.visible,
          material: roof.material,
        },
      ];
    }
    delete design.roof;
    design.schemaVersion = 11;
    return design;
  },
  // v11 -> v12: manual roof tool (Phase 5.2). The automatic, per-mass roof system
  // is replaced by manually placed roof rectangles. The old auto-generated
  // `RoofSection[]` had a different shape (anchor-based, no rectangle) and was the
  // unsatisfactory auto output, so we clear every level's roofs to `[]`; the user
  // re-places roofs with the new Roof tool. Every level still has a `roofs` array
  // (added in v11) — we just empty it.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      level.roofs = [];
    }
    design.schemaVersion = 12;
    return design;
  },
  // v12 -> v13: door styles (Phase 6 Part A). Every existing door gains
  // `style: "single"` — exactly today's single swinging leaf.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      const walls = (level.walls as RawDesign[] | undefined) ?? [];
      for (const wall of walls) {
        const doors = (wall.doors as RawDesign[] | undefined) ?? [];
        for (const door of doors) {
          if (door.style === undefined) door.style = "single";
        }
      }
    }
    design.schemaVersion = 13;
    return design;
  },
  // v13 -> v14: window styles (Phase 6 Part B). Every existing window gains
  // `style: "plain"` — today's single-pane look.
  (design) => {
    const levels = (design.levels as RawDesign[] | undefined) ?? [];
    for (const level of levels) {
      const walls = (level.walls as RawDesign[] | undefined) ?? [];
      for (const wall of walls) {
        const windows = (wall.windows as RawDesign[] | undefined) ?? [];
        for (const win of windows) {
          if (win.style === undefined) win.style = "plain";
        }
      }
    }
    design.schemaVersion = 14;
    return design;
  },
];

// Centroid of a level's wall endpoints (the old single roof spanned the wall
// bbox); falls back to the site centre when the level has no walls. Used only by
// the v10->v11 migration to anchor a migrated roof inside its footprint.
function topFootprintCentroid(level: RawDesign, design: RawDesign): {
  x: number;
  y: number;
} {
  const walls = (level.walls as RawDesign[] | undefined) ?? [];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const wall of walls) {
    for (const key of ["start", "end"] as const) {
      const p = wall[key] as { x?: number; y?: number } | undefined;
      if (p && typeof p.x === "number" && typeof p.y === "number") {
        sx += p.x;
        sy += p.y;
        n++;
      }
    }
  }
  if (n > 0) return { x: sx / n, y: sy / n };
  const site = design.site as { width?: number; depth?: number } | undefined;
  return { x: (site?.width ?? 0) / 2, y: (site?.depth ?? 0) / 2 };
}

// The newest schema version this build understands.
export const LATEST_SCHEMA_VERSION = migrations.length + 1;

// Apply every migration from the design's current version up to the latest.
// Assumes the version is a known one (1..LATEST); callers reject future versions.
export function migrateToLatest(design: RawDesign): Design {
  let current = design;
  let version =
    typeof current.schemaVersion === "number" ? current.schemaVersion : 1;
  while (version < LATEST_SCHEMA_VERSION) {
    const migration = migrations[version - 1];
    if (!migration) break;
    current = migration(current);
    version =
      typeof current.schemaVersion === "number"
        ? current.schemaVersion
        : version + 1;
  }
  return current as unknown as Design;
}
