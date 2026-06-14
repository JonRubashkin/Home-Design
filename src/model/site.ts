import type { Site } from "./types";

// The work-area ("site") size model. Presets are SQUARES derived from a target
// floor area (m²); a custom size is entered as width × depth in meters directly.
// The site is a SOFT boundary — never enforced — so growing or shrinking it only
// changes these numbers; nothing is clamped, moved, or deleted.

export interface SitePreset {
  id: "small" | "medium" | "large";
  label: string;
  area: number; // m²
}

export const SITE_PRESETS: SitePreset[] = [
  { id: "small", label: "Small", area: 100 }, // 10 × 10 m
  { id: "medium", label: "Medium", area: 300 }, // ≈17.32 × 17.32 m
  { id: "large", label: "Large", area: 1000 }, // ≈31.62 × 31.62 m
];

// New/large default so migrated designs never have content outside the site.
export const DEFAULT_SITE_AREA = 1000;

// Sensible bounds for a custom side length (meters).
export const SITE_MIN = 2;
export const SITE_MAX = 200;

// A square site with the given area (m²): each side = sqrt(area).
export function areaToSquare(m2: number): Site {
  const side = Math.sqrt(Math.max(0, m2));
  return { width: side, depth: side };
}

export const DEFAULT_SITE: Site = areaToSquare(DEFAULT_SITE_AREA);

// Clamp a custom side length into the allowed range.
export function clampSide(meters: number): number {
  if (!isFinite(meters)) return SITE_MIN;
  return Math.max(SITE_MIN, Math.min(SITE_MAX, meters));
}

// Round a length to the nearest 0.1 m — the finest granularity the size chooser
// allows, so dimensions never carry more than one decimal place.
export function roundToTenth(meters: number): number {
  return Math.round(meters * 10) / 10;
}
