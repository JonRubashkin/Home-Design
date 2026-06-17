import type { MaterialRef, Vec3 } from "../model/types";
import type { CatalogEntry } from "../catalog";
import { UNIT_SCALE, resolveVariantId } from "../catalog";
import { representativeColor } from "../materials/textures";

// The 2D plan symbol for a furniture item: footprint outline (filled with the
// primary slot's color) + the catalog glyph, in local centered coords, placed,
// rotated, and scaled (x = width, z = depth). The glyph is drawn in unscaled
// local coords so its strokes stay crisp; the surrounding scale transform sizes
// it. Used both in the plan and (un-transformed) in palette thumbnails.
export function FurnitureSymbolShape({
  entry,
  position,
  rotation,
  scale = UNIT_SCALE,
  variant,
  materials,
  className,
}: {
  entry: CatalogEntry;
  position: { x: number; y: number };
  rotation: number;
  scale?: Vec3;
  variant?: string;
  materials: Record<string, MaterialRef>;
  className: string;
}) {
  const w = entry.footprint.width;
  const d = entry.footprint.depth;
  const primary = entry.slots[0]!;
  const fill = representativeColor(materials[primary.name] ?? primary.default);
  const variantId = resolveVariantId(entry, variant);
  return (
    <g
      className={className}
      transform={`translate(${position.x} ${position.y}) rotate(${rotation}) scale(${scale.x} ${scale.z})`}
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
      <g className="furn-glyph">{entry.glyph(w, d, variantId)}</g>
    </g>
  );
}

// A small standalone thumbnail of a catalog item's plan symbol for the palette.
export function FurnitureThumb({
  entry,
  variant,
  size = 46,
}: {
  entry: CatalogEntry;
  variant?: string;
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
        variant={variant}
        materials={{}}
        className="furn"
      />
    </svg>
  );
}
