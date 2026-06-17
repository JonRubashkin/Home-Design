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
];

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
