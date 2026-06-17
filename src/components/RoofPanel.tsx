import { useState } from "react";
import { useStore } from "../store/store";
import type { Roof } from "../model/types";
import { MaterialChip } from "./material/MaterialChip";
import { MaterialPicker } from "./material/MaterialPicker";

const ROOF_TYPES: { type: Roof["type"]; label: string }[] = [
  { type: "flat", label: "Flat" },
  { type: "gabled", label: "Gabled" },
  { type: "hipped", label: "Hipped" },
  { type: "pitched", label: "Shed" },
];

// Roof controls in the Floors dropdown (roofs are building structure). All edits
// are undoable store actions. The roof spans the top level's footprint.
export function RoofPanel() {
  const roof = useStore((s) => s.design.roof);
  const setRoof = useStore((s) => s.setRoof);
  const updateRoof = useStore((s) => s.updateRoof);
  const [editMaterial, setEditMaterial] = useState(false);

  return (
    <section className="roof-panel">
      <h3 className="roof-panel-title">Roof</h3>

      {!roof ? (
        <button
          type="button"
          className="levels-add"
          title="Add a roof over the top level"
          onClick={() => updateRoof({})}
        >
          + Add roof
        </button>
      ) : (
        <>
          <div className="seg roof-types" role="group" aria-label="Roof type">
            {ROOF_TYPES.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                className={`seg-button${roof.type === type ? " active" : ""}`}
                aria-pressed={roof.type === type}
                onClick={() => updateRoof({ type })}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="roof-slider">
            <span>Pitch {Math.round(roof.pitch)}°</span>
            <input
              type="range"
              min={5}
              max={60}
              step={1}
              value={roof.pitch}
              disabled={roof.type === "flat"}
              onChange={(e) => updateRoof({ pitch: Number(e.target.value) })}
            />
          </label>

          <label className="roof-slider">
            <span>Overhang {roof.overhang.toFixed(2)} m</span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={roof.overhang}
              onChange={(e) => updateRoof({ overhang: Number(e.target.value) })}
            />
          </label>

          <label className="roof-visible">
            <input
              type="checkbox"
              checked={roof.visible}
              onChange={(e) => updateRoof({ visible: e.target.checked })}
            />
            Show roof
          </label>

          <div className="chip-row">
            <MaterialChip
              material={roof.material}
              label="Material"
              active={editMaterial}
              onClick={() => setEditMaterial((v) => !v)}
            />
          </div>
          {editMaterial && (
            <MaterialPicker
              value={roof.material}
              onChange={(m) => updateRoof({ material: m })}
            />
          )}

          <button
            type="button"
            className="link-button reset-link"
            onClick={() => setRoof(null)}
          >
            Remove roof
          </button>
        </>
      )}
    </section>
  );
}
