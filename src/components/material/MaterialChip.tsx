import type { MaterialRef } from "../../model/types";
import { materialLabel } from "../../materials/key";
import { MaterialThumb } from "./MaterialThumb";

// A labelled, clickable material preview used in the properties panel. Hovering
// can highlight the corresponding surface in the plan.
export function MaterialChip({
  material,
  label,
  active,
  onClick,
  onHoverChange,
}: {
  material: MaterialRef;
  label: string;
  active?: boolean;
  onClick: () => void;
  onHoverChange?: (hovering: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`mat-chip${active ? " active" : ""}`}
      onClick={onClick}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onBlur={() => onHoverChange?.(false)}
    >
      <MaterialThumb material={material} size={22} />
      <span className="mat-chip-text">
        <span className="mat-chip-label">{label}</span>
        <span className="mat-chip-value">{materialLabel(material)}</span>
      </span>
    </button>
  );
}
