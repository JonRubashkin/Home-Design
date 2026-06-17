import type { Bounds } from "./planview";

// Roof geometry generated from the top level's footprint bounding rectangle
// (Phase 5e). A single rectangular roof over the bbox is correct for this phase;
// multi-section / L-shaped roofs are explicitly deferred (a non-rectangular
// footprint still gets one roof over its bounding rectangle).

export type RoofType = "flat" | "gabled" | "hipped" | "pitched";

// One planar polygon of the roof in WORLD space (x, y up, z). The renderer
// fan-triangulates each part and renders it double-sided.
export interface RoofPart {
  vertices: [number, number, number][];
}

export interface RoofResult {
  parts: RoofPart[];
  ridgeY: number; // peak world-Y (eave height for flat) — handy for framing
}

const DEG = Math.PI / 180;

// Build the roof parts. `bbox` is the footprint in plan coords (x→world x,
// y→world z); `baseY` is the eave height (top of the top level's walls). The bbox
// is expanded outward by `overhang` for the eaves. `pitch` (degrees) is ignored
// for a flat roof.
export function computeRoof(
  bbox: Bounds,
  type: RoofType,
  pitch: number,
  overhang: number,
  baseY: number,
): RoofResult {
  const x0 = bbox.minX - overhang;
  const x1 = bbox.maxX + overhang;
  const z0 = bbox.minY - overhang;
  const z1 = bbox.maxY + overhang;
  const width = x1 - x0; // X extent
  const depth = z1 - z0; // Z extent
  const t = Math.tan(Math.max(0, pitch) * DEG);

  if (type === "flat") {
    return {
      ridgeY: baseY,
      parts: [
        quad([x0, baseY, z0], [x1, baseY, z0], [x1, baseY, z1], [x0, baseY, z1]),
      ],
    };
  }

  if (type === "pitched") {
    // Single slope (shed) rising along +Z, eave-to-eave.
    const highY = baseY + depth * t;
    return {
      ridgeY: highY,
      parts: [
        // Sloped panel.
        quad([x0, baseY, z0], [x1, baseY, z0], [x1, highY, z1], [x0, highY, z1]),
        // Vertical gable on the high (z1) side.
        quad([x0, baseY, z1], [x0, highY, z1], [x1, highY, z1], [x1, baseY, z1]),
        // Triangular gable ends.
        tri([x0, baseY, z0], [x0, highY, z1], [x0, baseY, z1]),
        tri([x1, baseY, z0], [x1, baseY, z1], [x1, highY, z1]),
      ],
    };
  }

  // Gabled / hipped: ridge runs along the LONGER axis.
  const alongX = width >= depth;
  const halfSpan = (alongX ? depth : width) / 2;
  const ridgeY = baseY + halfSpan * t;

  if (type === "gabled") {
    if (alongX) {
      const zm = (z0 + z1) / 2;
      const R0: V = [x0, ridgeY, zm];
      const R1: V = [x1, ridgeY, zm];
      return {
        ridgeY,
        parts: [
          quad([x0, baseY, z0], [x1, baseY, z0], R1, R0), // slope to z0
          quad(R0, R1, [x1, baseY, z1], [x0, baseY, z1]), // slope to z1
          tri([x0, baseY, z0], R0, [x0, baseY, z1]), // gable at x0
          tri([x1, baseY, z0], [x1, baseY, z1], R1), // gable at x1
        ],
      };
    }
    const xm = (x0 + x1) / 2;
    const R0: V = [xm, ridgeY, z0];
    const R1: V = [xm, ridgeY, z1];
    return {
      ridgeY,
      parts: [
        quad([x0, baseY, z0], R0, R1, [x0, baseY, z1]), // slope to x0
        quad(R0, [x1, baseY, z0], [x1, baseY, z1], R1), // slope to x1
        tri([x0, baseY, z0], [x1, baseY, z0], R0), // gable at z0
        tri([x0, baseY, z1], R1, [x1, baseY, z1]), // gable at z1
      ],
    };
  }

  // Hipped: central ridge, inset by the half-span, with four slopes (two
  // trapezoids + two triangular hip ends).
  if (alongX) {
    const zm = (z0 + z1) / 2;
    const rx0 = x0 + halfSpan;
    const rx1 = x1 - halfSpan;
    const R0: V = [rx0, ridgeY, zm];
    const R1: V = [rx1, ridgeY, zm];
    return {
      ridgeY,
      parts: [
        quad([x0, baseY, z0], [x1, baseY, z0], R1, R0), // long slope to z0
        quad(R0, R1, [x1, baseY, z1], [x0, baseY, z1]), // long slope to z1
        tri([x0, baseY, z0], R0, [x0, baseY, z1]), // hip end at x0
        tri([x1, baseY, z0], [x1, baseY, z1], R1), // hip end at x1
      ],
    };
  }
  const xm = (x0 + x1) / 2;
  const rz0 = z0 + halfSpan;
  const rz1 = z1 - halfSpan;
  const R0: V = [xm, ridgeY, rz0];
  const R1: V = [xm, ridgeY, rz1];
  return {
    ridgeY,
    parts: [
      quad([x0, baseY, z0], R0, R1, [x0, baseY, z1]), // long slope to x0
      quad(R0, [x1, baseY, z0], [x1, baseY, z1], R1), // long slope to x1
      tri([x0, baseY, z0], [x1, baseY, z0], R0), // hip end at z0
      tri([x0, baseY, z1], R1, [x1, baseY, z1]), // hip end at z1
    ],
  };
}

type V = [number, number, number];
const quad = (a: V, b: V, c: V, d: V): RoofPart => ({ vertices: [a, b, c, d] });
const tri = (a: V, b: V, c: V): RoofPart => ({ vertices: [a, b, c] });
