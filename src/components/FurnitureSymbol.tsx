import type { MaterialRef } from "../model/types";
import type { CatalogEntry } from "../catalog";
import { representativeColor } from "../materials/textures";

// The 2D plan symbol for a furniture item: footprint outline (filled with the
// primary slot's color) + the catalog glyph, in local centered coords, placed
// and rotated. Used both in the plan and (un-transformed) in palette thumbnails.
export function FurnitureSymbolShape({
  entry,
  position,
  rotation,
  materials,
  className,
}: {
  entry: CatalogEntry;
  position: { x: number; y: number };
  rotation: number;
  materials: Record<string, MaterialRef>;
  className: string;
}) {
  const w = entry.footprint.width;
  const d = entry.footprint.depth;
  const primary = entry.slots[0]!;
  const fill = representativeColor(materials[primary.name] ?? primary.default);
  return (
    <g
      className={className}
      transform={`translate(${position.x} ${position.y}) rotate(${rotation})`}
    >
      <rect
        className="furn-outline"
        x={-w / 2}
        y={-d / 2}
        width={w}
        height={d}
        fill={fill}
        vectorEffect="non-scaling-stroke"
      />
      <g className="furn-glyph">{entry.glyph(w, d)}</g>
    </g>
  );
}

// A small standalone thumbnail of a catalog item's plan symbol for the palette.
export function FurnitureThumb({
  entry,
  size = 46,
}: {
  entry: CatalogEntry;
  size?: number;
}) {
  const pad = 0.18;
  const vbW = entry.footprint.width + pad * 2;
  const vbH = entry.footprint.depth + pad * 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-vbW / 2} ${-vbH / 2} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="furn-thumb"
    >
      <FurnitureSymbolShape
        entry={entry}
        position={{ x: 0, y: 0 }}
        rotation={0}
        materials={{}}
        className="furn"
      />
    </svg>
  );
}
