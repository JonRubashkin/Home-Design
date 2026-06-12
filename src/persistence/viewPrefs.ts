// UI view preferences — persisted separately from the Design document (these are
// not part of the design and never enter undo history).

export type ViewMode = "full" | "cutaway" | "stubs";
export type CutawayStyle = "invisible" | "ghost";
export type Layout = "plan" | "3d" | "split";

export interface ViewPrefs {
  viewMode: ViewMode;
  cutawayStyle: CutawayStyle;
  layout: Layout;
}

export const DEFAULT_VIEW_PREFS: ViewPrefs = {
  viewMode: "full",
  cutawayStyle: "ghost",
  layout: "split",
};

const STORAGE_KEY = "home-design:viewprefs:v1";

const VIEW_MODES: ViewMode[] = ["full", "cutaway", "stubs"];
const CUTAWAY_STYLES: CutawayStyle[] = ["invisible", "ghost"];
const LAYOUTS: Layout[] = ["plan", "3d", "split"];

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
