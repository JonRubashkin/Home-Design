import type { Site, Vec2 } from "../model/types";

// Pure helpers for the 2D plan "Fit view": axis-aligned bounds math and the
// pan/scale that frames a bounds rectangle in a viewport with a margin. The 2D
// editor mirrors the 3D Fit view with these.

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PlanView {
  pan: Vec2;
  scale: number;
}

export function boundsOfPoints(points: Vec2[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

// The site occupies plan coords [0, width] x [0, depth] (origin at the corner).
export function siteBounds(site: Site): Bounds {
  return { minX: 0, minY: 0, maxX: site.width, maxY: site.depth };
}

export interface FitOptions {
  margin?: number; // fraction of the viewport kept as padding (per side)
  minScale?: number;
  maxScale?: number;
}

// Compute the pan/scale that centers `bounds` in a `size` viewport, leaving a
// margin on every side. Scale is clamped so fitting can't zoom past the editor's
// limits. Mirrors the 3D CameraController's framing.
export function fitView(
  bounds: Bounds,
  size: { width: number; height: number },
  opts: FitOptions = {},
): PlanView {
  const margin = opts.margin ?? 0.08;
  const minScale = opts.minScale ?? 4;
  const maxScale = opts.maxScale ?? 600;

  const w = Math.max(bounds.maxX - bounds.minX, 0.001);
  const h = Math.max(bounds.maxY - bounds.minY, 0.001);
  const usable = Math.max(0.01, 1 - 2 * margin);

  let scale = Math.min((size.width * usable) / w, (size.height * usable) / h);
  scale = Math.max(minScale, Math.min(maxScale, scale));

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    pan: { x: size.width / 2 - cx * scale, y: size.height / 2 - cy * scale },
  };
}
