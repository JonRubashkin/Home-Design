import type { ReactNode } from "react";
import type { MaterialRef } from "../model/types";

export type Category =
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "office"
  | "utility";

// Local space for builders & glyphs: x = width (right), y/up in 3D, z = depth
// with +z the item's FRONT. The 2D glyph uses (x = width, y = depth, +y front).
export type Primitive =
  | { kind: "box"; size: [number, number, number] }
  | { kind: "roundedBox"; size: [number, number, number]; radius: number }
  | {
      kind: "cylinder";
      radiusTop: number;
      radiusBottom: number;
      height: number;
    };

export interface Part {
  slot: string;
  primitive: Primitive;
  position: [number, number, number]; // local center (y measured up from floor)
  rotation?: [number, number, number]; // radians
}

export interface Slot {
  name: string;
  default: MaterialRef;
}

export type ScaleMode = "none" | "uniform" | "axes";

// Multiplier ranges per axis (x = width, y = height, z = depth). Omit an axis
// to lock it at 1.
export interface ScaleAxes {
  x?: [number, number];
  y?: [number, number];
  z?: [number, number];
}

export interface CatalogScaling {
  mode: ScaleMode;
  uniform?: [number, number]; // for "uniform"
  axes?: ScaleAxes; // for "axes"
}

export interface CatalogEntry {
  id: string;
  name: string;
  category: Category;
  footprint: { width: number; depth: number };
  height: number;
  wallHugger: boolean;
  flat?: boolean; // rug-like: above floors, below other furniture
  // Stacking (Phase 2c+): `surfaceTop` (local meters, scaled by y at runtime) is
  // the flat top where small items rest — set it to make the item a support
  // surface (counter, table, dresser…). `stackable` marks a small item that
  // automatically climbs onto a surface it's centered over (microwave, lamp…).
  surfaceTop?: number;
  stackable?: boolean;
  // Collision (Phase 3c.2): true for bulky floor-standing items you'd never
  // overlap; false for flat/surface/decor items meant to sit on or under others
  // (rugs, lamps, plants, microwaves, mirrors…). Footprint-only, same level.
  collidable: boolean;
  scaling: CatalogScaling;
  slots: Slot[]; // order matters; slots[0] is the primary slot
  build: () => Part[]; // 3D parts in local space (y up from floor)
  glyph: (w: number, d: number) => ReactNode; // distinguishing 2D plan marks
}

