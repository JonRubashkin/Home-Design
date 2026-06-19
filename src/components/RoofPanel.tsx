import { useMemo, useState } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import type { RoofSection } from "../model/types";
import { detectMasses } from "../geometry/roofMass";
import { pointInPolygon } from "../geometry/polygon";
import { MaterialChip } from "./material/MaterialChip";
import { MaterialPicker } from "./material/MaterialPicker";

const ROOF_TYPES: { type: RoofSection["type"]; label: string }[] = [
  { type: "flat", label: "Flat" },
  { type: "gabled", label: "Gabled" },
  { type: "hipped", label: "Hipped" },
  { type: "pitched", label: "Shed" },
];

// Per-level, multi-section roof controls in the Floors dropdown (Phase 5.1). One
// row per detected wall mass on the active level; un-roofed masses get an "Add
// roof" affordance. A global hide-roofs toggle applies on top. All edits are
// undoable store actions.
export function RoofPanel() {
  const level = useStore(selectCurrentLevel);
  const setRoofSection = useStore((s) => s.setRoofSection);
  const addRoofSection = useStore((s) => s.addRoofSection);
  const removeRoofSection = useStore((s) => s.removeRoofSection);
  const hideRoofs = useStore((s) => s.hideRoofs);
  const setHideRoofs = useStore((s) => s.setHideRoofs);

  const masses = useMemo(() => detectMasses(level.walls), [level.walls]);
  // Masses with no section yet (e.g. just drawn, or the user removed its roof).
  const bareMasses = masses.filter(
    (m) => !level.roofs.some((r) => pointInPolygon(r.anchor, m.footprint)),
  );

  return (
    <section className="roof-panel">
      <h3 className="roof-panel-title">Roofs</h3>

      <label className="roof-visible">
        <input
          type="checkbox"
          checked={!hideRoofs}
          onChange={(e) => setHideRoofs(!e.target.checked)}
        />
        Show roofs
      </label>

      {level.roofs.length === 0 && bareMasses.length === 0 && (
        <p className="roof-empty">Draw walls to add a roof.</p>
      )}

      {level.roofs.map((section, i) => (
        <RoofSectionRow
          key={section.id}
          index={i}
          section={section}
          onChange={(patch) => setRoofSection(level.id, section.id, patch)}
          onRemove={() => removeRoofSection(level.id, section.id)}
        />
      ))}

      {bareMasses.map((m, i) => (
        <button
          key={`bare-${i}`}
          type="button"
          className="levels-add"
          title="Add a roof over this part of the building"
          onClick={() => addRoofSection(level.id, m.anchor)}
        >
          + Add roof {level.roofs.length + i + 1}
        </button>
      ))}
    </section>
  );
}

function RoofSectionRow({
  index,
  section,
  onChange,
  onRemove,
}: {
  index: number;
  section: RoofSection;
  onChange: (patch: Partial<Omit<RoofSection, "id" | "anchor">>) => void;
  onRemove: () => void;
}) {
  const [editMaterial, setEditMaterial] = useState(false);

  return (
    <div className="roof-section">
      <div className="roof-section-head">
        <strong>Roof {index + 1}</strong>
        <button
          type="button"
          className="link-button reset-link"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>

      <div className="seg roof-types" role="group" aria-label="Roof type">
        {ROOF_TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className={`seg-button${section.type === type ? " active" : ""}`}
            aria-pressed={section.type === type}
            onClick={() => onChange({ type })}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="roof-slider">
        <span>Pitch {Math.round(section.pitch)}°</span>
        <input
          type="range"
          min={5}
          max={60}
          step={1}
          value={section.pitch}
          disabled={section.type === "flat"}
          onChange={(e) => onChange({ pitch: Number(e.target.value) })}
        />
      </label>

      <label className="roof-slider">
        <span>Overhang {section.overhang.toFixed(2)} m</span>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={section.overhang}
          onChange={(e) => onChange({ overhang: Number(e.target.value) })}
        />
      </label>

      <label className="roof-visible">
        <input
          type="checkbox"
          checked={section.visible}
          onChange={(e) => onChange({ visible: e.target.checked })}
        />
        Show this roof
      </label>

      <div className="chip-row">
        <MaterialChip
          material={section.material}
          label="Material"
          active={editMaterial}
          onClick={() => setEditMaterial((v) => !v)}
        />
      </div>
      {editMaterial && (
        <MaterialPicker
          value={section.material}
          onChange={(m) => onChange({ material: m })}
        />
      )}
    </div>
  );
}
