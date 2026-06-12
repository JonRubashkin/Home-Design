import type { MaterialRef } from "../../model/types";
import { patternDataUrl } from "../../materials/textures";

// A small visual preview of a material: a solid swatch or a tiled pattern.
export function MaterialThumb({
  material,
  size = 24,
}: {
  material: MaterialRef;
  size?: number;
}) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 4,
    border: "1px solid rgba(0,0,0,0.25)",
    display: "inline-block",
    flex: "none",
  };
  if (material.kind === "solid") {
    style.background = material.color;
  } else {
    style.backgroundImage = `url(${patternDataUrl(material)})`;
    style.backgroundSize = `${size}px ${size}px`;
  }
  return <span style={style} aria-hidden="true" />;
}
