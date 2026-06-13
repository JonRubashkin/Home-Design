import type { Design } from "./types";

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
