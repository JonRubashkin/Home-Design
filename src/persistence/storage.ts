import type { Design } from "../model/types";
import { LATEST_SCHEMA_VERSION, migrateToLatest } from "../model/migrations";
import { PATTERN_IDS } from "../materials/patterns";

const STORAGE_KEY = "home-design:design:v1";

export const CURRENT_SCHEMA_VERSION = LATEST_SCHEMA_VERSION;

export type ValidationResult =
  | { ok: true; design: Design }
  | { ok: false; error: string };

// Derived from the single source of truth so new pattern ids never get rejected
// by the importer (grass/water/gravel included automatically).
const PATTERNS: string[] = PATTERN_IDS;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isVec2 = (v: unknown): boolean => isObj(v) && isNum(v.x) && isNum(v.y);
const isVec3 = (v: unknown): boolean =>
  isObj(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);

function isMaterial(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (v.kind === "solid") return isStr(v.color);
  if (v.kind === "pattern")
    return (
      PATTERNS.includes(v.pattern as string) &&
      isStr(v.colorA) &&
      isStr(v.colorB)
    );
  return false;
}

// Returns an error string, or null if the structure is a valid schema-v1 design.
function structuralError(obj: Record<string, unknown>): string | null {
  if (!Array.isArray(obj.levels) || obj.levels.length === 0)
    return "Design has no levels.";
  if (!isStr(obj.name)) return "Design is missing a name.";
  if (!isObj(obj.site) || !isNum(obj.site.width) || !isNum(obj.site.depth))
    return "Design is missing its site.";

  const ROOF_TYPES = ["flat", "gabled", "hipped", "pitched"];

  for (const level of obj.levels) {
    if (!isObj(level)) return "A level is malformed.";
    if (!Array.isArray(level.walls)) return "A level is missing its walls.";
    if (!Array.isArray(level.floors)) return "A level is missing its floors.";

    for (const wall of level.walls) {
      if (!isObj(wall)) return "A wall is malformed.";
      if (!isVec2(wall.start) || !isVec2(wall.end))
        return "A wall has invalid endpoints.";
      if (!isNum(wall.height) || !isNum(wall.thickness))
        return "A wall has invalid dimensions.";
      if (!isMaterial(wall.paintA) || !isMaterial(wall.paintB))
        return "A wall has an invalid paint material.";
      if (!Array.isArray(wall.windows)) return "A wall is missing its windows.";
      for (const win of wall.windows) {
        if (
          !isObj(win) ||
          !isNum(win.t) ||
          !isNum(win.width) ||
          !isNum(win.height) ||
          !isNum(win.sillHeight) ||
          (win.style !== "plain" &&
            win.style !== "grid" &&
            win.style !== "divided" &&
            win.style !== "picture")
        )
          return "A window is malformed.";
      }
      if (!Array.isArray(wall.doors)) return "A wall is missing its doors.";
      for (const door of wall.doors) {
        if (
          !isObj(door) ||
          !isNum(door.t) ||
          !isNum(door.width) ||
          !isNum(door.height) ||
          (door.style !== "single" &&
            door.style !== "double" &&
            door.style !== "sliding") ||
          (door.hinge !== "start" && door.hinge !== "end") ||
          (door.swing !== "A" && door.swing !== "B") ||
          !isMaterial(door.material)
        )
          return "A door is malformed.";
      }
      if (!Array.isArray(wall.mounts)) return "A wall is missing its mounts.";
      for (const mount of wall.mounts) {
        if (
          !isObj(mount) ||
          !isStr(mount.catalogId) ||
          !isNum(mount.t) ||
          !isNum(mount.heightUpWall) ||
          (mount.face !== "A" && mount.face !== "B") ||
          !isVec3(mount.scale) ||
          !isObj(mount.materials)
        )
          return "A wall mount is malformed.";
      }
    }

    for (const floor of level.floors) {
      if (!isObj(floor)) return "A floor is malformed.";
      if (!Array.isArray(floor.polygon) || floor.polygon.length < 3)
        return "A floor needs at least three points.";
      if (!floor.polygon.every(isVec2)) return "A floor has invalid points.";
      if (!isMaterial(floor.material))
        return "A floor has an invalid material.";
    }

    if (!Array.isArray(level.staircases))
      return "A level is missing its staircases.";
    for (const stair of level.staircases) {
      if (
        !isObj(stair) ||
        !isVec2(stair.position) ||
        !isNum(stair.rotation) ||
        !isNum(stair.width) ||
        !isMaterial(stair.material)
      )
        return "A staircase is malformed.";
    }

    if (!Array.isArray(level.roofs)) return "A level is missing its roofs.";
    for (const roof of level.roofs) {
      if (
        !isObj(roof) ||
        !isVec2(roof.position) ||
        !isNum(roof.width) ||
        !isNum(roof.depth) ||
        !isNum(roof.rotation) ||
        !ROOF_TYPES.includes(roof.type as string) ||
        !isNum(roof.pitch) ||
        !isNum(roof.overhang) ||
        typeof roof.visible !== "boolean" ||
        !isMaterial(roof.material)
      )
        return "A roof is malformed.";
    }

    if (!Array.isArray(level.ceilingLights))
      return "A level is missing its ceiling lights.";
    for (const light of level.ceilingLights) {
      if (
        !isObj(light) ||
        !isStr(light.catalogId) ||
        !isVec2(light.position) ||
        !isNum(light.drop) ||
        !isVec3(light.scale) ||
        !isObj(light.materials)
      )
        return "A ceiling light is malformed.";
    }

    if (!Array.isArray(level.furniture))
      return "A level is missing its furniture.";
    for (const item of level.furniture) {
      if (
        !isObj(item) ||
        !isStr(item.catalogId) ||
        !isVec2(item.position) ||
        !isNum(item.rotation) ||
        !isVec3(item.scale) ||
        (item.variant !== undefined && !isStr(item.variant)) ||
        !isObj(item.materials)
      )
        return "A furniture item is malformed.";
    }
  }
  return null;
}

// Validate an untrusted parsed object as a schema-v1 Design. We refuse unknown
// future versions rather than corrupting data (per CLAUDE.md).
export function validateDesign(data: unknown): ValidationResult {
  if (!isObj(data)) {
    return {
      ok: false,
      error: "File is not a valid design (expected an object).",
    };
  }
  const version = data.schemaVersion;
  if (typeof version !== "number" || version < 1) {
    return { ok: false, error: "Missing or invalid schemaVersion." };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This design was made with a newer version (schema v${version}). Please update the app to open it.`,
    };
  }
  // Upgrade older designs to the current schema, then validate the result.
  const migrated = migrateToLatest(data) as unknown as Record<string, unknown>;
  const err = structuralError(migrated);
  if (err) return { ok: false, error: err };
  return { ok: true, design: migrated as unknown as Design };
}

export function saveDesign(design: Design): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
  } catch {
    // localStorage may be unavailable (private mode, quota). Non-fatal.
  }
}

// Load and validate the autosaved design, or null if absent/invalid.
export function loadDesign(): Design | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = validateDesign(parsed);
    return result.ok ? result.design : null;
  } catch {
    return null;
  }
}

export function clearSavedDesign(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
