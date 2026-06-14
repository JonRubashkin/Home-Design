import type { MaterialRef, PatternId } from "../model/types";
import { DEFAULT_MATERIAL } from "../model/defaults";

// UI view preferences — persisted separately from the Design document (these are
// not part of the design and never enter undo history).

export type ViewMode = "full" | "cutaway" | "stubs";
export type CutawayStyle = "invisible" | "ghost";
export type Layout = "plan" | "3d" | "split";

export interface ViewPrefs {
  viewMode: ViewMode;
  cutawayStyle: CutawayStyle;
  layout: Layout;
  currentMaterial: MaterialRef;
  // Multi-level UI prefs.
  activeLevelOnly: boolean; // 3D: render only the active level
  showUnderlay: boolean; // 2D: ghost the level below the active one
  activeLevelId: string | null; // restore the active level across reloads
}

export const DEFAULT_VIEW_PREFS: ViewPrefs = {
  viewMode: "full",
  cutawayStyle: "ghost",
  layout: "split",
  currentMaterial: DEFAULT_MATERIAL,
  activeLevelOnly: false,
  showUnderlay: true,
  activeLevelId: null,
};

const STORAGE_KEY = "home-design:viewprefs:v1";

const VIEW_MODES: ViewMode[] = ["full", "cutaway", "stubs"];
const CUTAWAY_STYLES: CutawayStyle[] = ["invisible", "ghost"];
const LAYOUTS: Layout[] = ["plan", "3d", "split"];
const PATTERNS: PatternId[] = ["checker", "planks", "tile", "stripes"];

// Accept only well-formed material refs (untrusted localStorage input).
function parseMaterial(value: unknown): MaterialRef {
  if (typeof value !== "object" || value === null) return DEFAULT_MATERIAL;
  const m = value as Record<string, unknown>;
  if (m.kind === "solid" && typeof m.color === "string") {
    return { kind: "solid", color: m.color };
  }
  if (
    m.kind === "pattern" &&
    PATTERNS.includes(m.pattern as PatternId) &&
    typeof m.colorA === "string" &&
    typeof m.colorB === "string"
  ) {
    return {
      kind: "pattern",
      pattern: m.pattern as PatternId,
      colorA: m.colorA,
      colorB: m.colorB,
    };
  }
  return DEFAULT_MATERIAL;
}

// Load saved prefs, falling back to defaults for any missing/invalid field.
export function loadViewPrefs(): ViewPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIEW_PREFS };
    const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
    return {
      viewMode: VIEW_MODES.includes(parsed.viewMode as ViewMode)
        ? (parsed.viewMode as ViewMode)
        : DEFAULT_VIEW_PREFS.viewMode,
      cutawayStyle: CUTAWAY_STYLES.includes(parsed.cutawayStyle as CutawayStyle)
        ? (parsed.cutawayStyle as CutawayStyle)
        : DEFAULT_VIEW_PREFS.cutawayStyle,
      layout: LAYOUTS.includes(parsed.layout as Layout)
        ? (parsed.layout as Layout)
        : DEFAULT_VIEW_PREFS.layout,
      currentMaterial: parseMaterial(parsed.currentMaterial),
      activeLevelOnly:
        typeof parsed.activeLevelOnly === "boolean"
          ? parsed.activeLevelOnly
          : DEFAULT_VIEW_PREFS.activeLevelOnly,
      showUnderlay:
        typeof parsed.showUnderlay === "boolean"
          ? parsed.showUnderlay
          : DEFAULT_VIEW_PREFS.showUnderlay,
      activeLevelId:
        typeof parsed.activeLevelId === "string" ? parsed.activeLevelId : null,
    };
  } catch {
    return { ...DEFAULT_VIEW_PREFS };
  }
}

export function saveViewPrefs(prefs: ViewPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore (private mode / quota)
  }
}
