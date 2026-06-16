import { useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import type { MaterialRef, PatternId } from "../../model/types";
import { PATTERN_IDS } from "../../materials/patterns";
import { MaterialThumb } from "./MaterialThumb";

// ~16 interior-friendly presets: whites, warm neutrals, wood, stone/greys,
// muted blues and greens, and a few bold accents.
const SWATCHES = [
  "#ffffff",
  "#f5f1e8",
  "#e8e4dc",
  "#d9cdb8",
  "#c9a87a",
  "#b9966b",
  "#8a6d4b",
  "#6b7280",
  "#9aa0a6",
  "#cfd3d8",
  "#6c8ebf",
  "#3b5b87",
  "#7aa17f",
  "#3f6b46",
  "#c2453f",
  "#e0b84c",
];

const DEFAULT_PATTERN_COLORS: Record<PatternId, { a: string; b: string }> = {
  checker: { a: "#ffffff", b: "#2b3a55" },
  planks: { a: "#b9966b", b: "#7a5a35" },
  tile: { a: "#e8e8e8", b: "#9aa0a6" },
  stripes: { a: "#3b5b87", b: "#ffffff" },
  // Landscape surfaces for outdoor floor regions (lawn, pond/river, path).
  grass: { a: "#4f7a3a", b: "#6f9a4e" },
  water: { a: "#2f6f9e", b: "#5fa8d6" },
  gravel: { a: "#8d8a84", b: "#bdb9b1" },
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  value: MaterialRef;
  onChange: (material: MaterialRef) => void;
}

export function MaterialPicker({ value, onChange }: Props) {
  // Remembered colors for the solid wheel and each pattern's A/B. The active
  // selection always reads from `value`; these hold edits for the rest.
  const [solid, setSolid] = useState(
    value.kind === "solid" ? value.color : "#cccccc",
  );
  const [patternColors, setPatternColors] = useState(DEFAULT_PATTERN_COLORS);

  const colorsFor = (pid: PatternId) =>
    value.kind === "pattern" && value.pattern === pid
      ? { a: value.colorA, b: value.colorB }
      : patternColors[pid];

  const chooseSolid = (color: string) => {
    setSolid(color);
    onChange({ kind: "solid", color });
  };

  const choosePattern = (pid: PatternId) => {
    const c = colorsFor(pid);
    onChange({ kind: "pattern", pattern: pid, colorA: c.a, colorB: c.b });
  };

  const editPatternColor = (pid: PatternId, side: "a" | "b", color: string) => {
    const next = { ...colorsFor(pid), [side]: color };
    setPatternColors((prev) => ({ ...prev, [pid]: next }));
    if (value.kind === "pattern" && value.pattern === pid) {
      onChange({
        kind: "pattern",
        pattern: pid,
        colorA: next.a,
        colorB: next.b,
      });
    }
  };

  return (
    <div className="matpicker">
      <section className="matpicker-section">
        <h3 className="matpicker-heading">Swatches</h3>
        <div className="swatch-grid">
          {SWATCHES.map((color) => {
            const active = value.kind === "solid" && value.color === color;
            return (
              <button
                key={color}
                type="button"
                className={`swatch${active ? " active" : ""}`}
                style={{ background: color }}
                title={color}
                aria-label={color}
                aria-pressed={active}
                onClick={() => chooseSolid(color)}
              />
            );
          })}
        </div>
      </section>

      <section className="matpicker-section">
        <h3 className="matpicker-heading">Solid color</h3>
        <HexColorPicker color={solid} onChange={chooseSolid} />
        <div className="hex-row">
          <span className="hex-hash">#</span>
          <HexColorInput color={solid} onChange={chooseSolid} />
        </div>
      </section>

      <section className="matpicker-section">
        <h3 className="matpicker-heading">Patterns</h3>
        <div className="pattern-list">
          {PATTERN_IDS.map((pid) => {
            const c = colorsFor(pid);
            const ref: MaterialRef = {
              kind: "pattern",
              pattern: pid,
              colorA: c.a,
              colorB: c.b,
            };
            const active = value.kind === "pattern" && value.pattern === pid;
            return (
              <div
                key={pid}
                className={`pattern-row${active ? " active" : ""}`}
              >
                <button
                  type="button"
                  className="pattern-thumb"
                  onClick={() => choosePattern(pid)}
                  aria-pressed={active}
                  title={`Use ${titleCase(pid)}`}
                >
                  <MaterialThumb material={ref} size={40} />
                </button>
                <span className="pattern-name">{titleCase(pid)}</span>
                <label className="pattern-color" title="Color A">
                  <input
                    type="color"
                    value={c.a}
                    onChange={(e) => editPatternColor(pid, "a", e.target.value)}
                  />
                </label>
                <label className="pattern-color" title="Color B">
                  <input
                    type="color"
                    value={c.b}
                    onChange={(e) => editPatternColor(pid, "b", e.target.value)}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
