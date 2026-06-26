import { useState } from "react";
import type { Site } from "../model/types";
import {
  SITE_PRESETS,
  areaToSquare,
  clampSide,
  roundToTenth,
  SITE_MIN,
  SITE_MAX,
} from "../model/site";

// Shared work-area size chooser: three square presets (by area) plus a custom
// width × depth. Used by the welcome screen and the "Resize area" dialog. Enter
// confirms. Sizes are kept to a single decimal (nearest 0.1 m) so the number
// inputs never hold a step-invalid value. `onConfirm` receives the clamped,
// rounded site; sizes are never enforced later, this just seeds/updates
// `Design.site`.
export function SiteSizeForm({
  initial,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  initial?: Site;
  confirmLabel: string;
  onConfirm: (site: Site) => void;
  onCancel?: () => void;
}) {
  const [width, setWidth] = useState<string>(
    initial ? String(roundToTenth(initial.width)) : "10",
  );
  const [depth, setDepth] = useState<string>(
    initial ? String(roundToTenth(initial.depth)) : "10",
  );

  const applyPreset = (area: number) => {
    const s = areaToSquare(area);
    setWidth(String(roundToTenth(s.width)));
    setDepth(String(roundToTenth(s.depth)));
  };

  // Snap a field to one decimal when the user leaves it.
  const snap = (raw: string, set: (v: string) => void) => {
    const n = Number(raw);
    if (Number.isFinite(n)) set(String(roundToTenth(clampSide(n))));
  };

  const current: Site = {
    width: clampSide(roundToTenth(Number(width))),
    depth: clampSide(roundToTenth(Number(depth))),
  };

  // Mark the preset whose (rounded) square matches the current entry.
  const activePreset = SITE_PRESETS.find((p) => {
    const side = roundToTenth(Math.sqrt(p.area));
    return (
      Math.abs(side - current.width) < 0.05 &&
      Math.abs(side - current.depth) < 0.05
    );
  })?.id;

  const confirm = () => onConfirm(current);

  return (
    <form
      className="site-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        confirm();
      }}
    >
      <div className="site-presets">
        {SITE_PRESETS.map((p) => {
          const s = areaToSquare(p.area);
          return (
            <button
              key={p.id}
              type="button"
              className={`site-preset${activePreset === p.id ? " active" : ""}`}
              aria-pressed={activePreset === p.id}
              onClick={() => applyPreset(p.area)}
            >
              <span className="site-preset-name">{p.label}</span>
              <span className="site-preset-area">{p.area} m²</span>
              <span className="site-preset-dims">
                {roundToTenth(s.width).toFixed(1)} ×{" "}
                {roundToTenth(s.depth).toFixed(1)} m
              </span>
            </button>
          );
        })}
      </div>

      <div className="site-custom">
        <span className="site-custom-label">Custom</span>
        <label className="field">
          <span className="field-label">Width</span>
          <span className="field-input">
            <input
              type="number"
              min={SITE_MIN}
              max={SITE_MAX}
              step={0.1}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              onBlur={(e) => snap(e.target.value, setWidth)}
            />
            <span className="field-unit">m</span>
          </span>
        </label>
        <label className="field">
          <span className="field-label">Depth</span>
          <span className="field-input">
            <input
              type="number"
              min={SITE_MIN}
              max={SITE_MAX}
              step={0.1}
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              onBlur={(e) => snap(e.target.value, setDepth)}
            />
            <span className="field-unit">m</span>
          </span>
        </label>
      </div>

      <div className="site-form-actions">
        {onCancel && (
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="primary-button"
          data-testid="site-confirm"
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}
