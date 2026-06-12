import type { Design } from "../model/types";

const STORAGE_KEY = "home-design:design:v1";

export const CURRENT_SCHEMA_VERSION = 1;

export type ValidationResult =
  | { ok: true; design: Design }
  | { ok: false; error: string };

const PATTERNS = ["checker", "planks", "tile", "stripes"];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isVec2 = (v: unknown): boolean => isObj(v) && isNum(v.x) && isNum(v.y);

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
          !isNum(win.sillHeight)
        )
          return "A window is malformed.";
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
  if (typeof version !== "number") {
    return { ok: false, error: "Missing or invalid schemaVersion." };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This design was made with a newer version (schema v${version}). Please update the app to open it.`,
    };
  }
  if (version !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported schema version v${version}.` };
  }
  const err = structuralError(data);
  if (err) return { ok: false, error: err };
  return { ok: true, design: data as unknown as Design };
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
