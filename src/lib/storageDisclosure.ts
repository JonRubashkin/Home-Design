// Single source for the browser-storage disclosure line. Designs live ONLY in the
// current browser on the current domain (IndexedDB) — no cloud sync. Shown on the
// Welcome screen (above the My Designs list) and in the Help panel so users know to
// Export JSON if they need a backup or to move work between browsers/devices.
export const STORAGE_DISCLOSURE =
  "Designs are saved in this browser. Use Export to back up or move them.";

// Calm, muted helper line on the welcome screen noting the app is desktop-oriented
// (mouse + keyboard). Informational only — nothing is hard-blocked on small/touch
// screens. Single-sourced here so the wording can't drift.
export const DESKTOP_RECOMMENDATION = "Best used on a desktop or laptop.";
