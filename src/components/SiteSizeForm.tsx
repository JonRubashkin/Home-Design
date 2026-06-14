import { useState } from "react";
import type { Site } from "../model/types";
import {
  SITE_PRESETS,
  areaToSquare,
  clampSide,
  SITE_MIN,
  SITE_MAX,
} from "../model/site";
import { formatMeters } from "../lib/format";

// Shared work-area size chooser: three square presets (by area) plus a custom
// width × depth. Used by the welcome screen and the "Resize area" dialog. Enter
// confirms. `onConfirm` receives the clamped site; sizes are never enforced
// later, this just seeds/updates `Design.site`.
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
    initial ? String(round2(initial.width)) : "10",
  );
  const [depth, setDepth] = useState<string>(
    initial ? String(round2(initial.depth)) : "10",
  );

  const applyPreset = (area: number) => {
    const s = areaToSquare(area);
    setWidth(String(round2(s.width)));
    setDepth(String(round2(s.depth)));
  };

  const current: Site = {
    width: clampSide(Number(width)),
    depth: clampSide(Number(depth)),
  };

  // Mark the preset whose square matches the current entry (within 1 cm).
  const activePreset = SITE_PRESETS.find((p) => {
    const side = Math.sqrt(p.area);
    return (
      Math.abs(side - current.width) < 0.01 &&
      Math.abs(side - current.depth) < 0.01
    );
  })?.id;

  const confirm = () => onConfirm(current);

  return (
    <form
      className="site-form"
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
                {formatMeters(s.width)} × {formatMeters(s.depth)}
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
        <button type="submit" className="primary-button">
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
