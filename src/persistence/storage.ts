import type { Design } from "../model/types";

const STORAGE_KEY = "home-design:design:v1";

export const CURRENT_SCHEMA_VERSION = 1;

export type ValidationResult =
  | { ok: true; design: Design }
  | { ok: false; error: string };

// Validate an untrusted parsed object as a schema-v1 Design. We refuse unknown
// future versions rather than corrupting data (per CLAUDE.md).
export function validateDesign(data: unknown): ValidationResult {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "File is not a valid design (expected an object)." };
  }
  const obj = data as Record<string, unknown>;
  const version = obj.schemaVersion;

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
    return {
      ok: false,
      error: `Unsupported schema version v${version}.`,
    };
  }
  if (!Array.isArray(obj.levels) || obj.levels.length === 0) {
    return { ok: false, error: "Design has no levels." };
  }
  if (typeof obj.name !== "string") {
    return { ok: false, error: "Design is missing a name." };
  }
  // Shape is sound enough for v1; trust the rest of the structure.
  return { ok: true, design: data as Design };
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
