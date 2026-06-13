import type { ReactNode } from "react";
import type { MaterialRef } from "../model/types";

export type Category = "living" | "bedroom" | "kitchen" | "bathroom";

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

export interface CatalogEntry {
  id: string;
  name: string;
  category: Category;
  footprint: { width: number; depth: number };
  height: number;
  wallHugger: boolean;
  flat?: boolean; // rug-like: above floors, below other furniture
  slots: Slot[]; // order matters; slots[0] is the primary slot
  build: () => Part[]; // 3D parts in local space (y up from floor)
  glyph: (w: number, d: number) => ReactNode; // distinguishing 2D plan marks
}
