import { useStore } from "../store/store";

// Global roof visibility toggle in the Floors dropdown (Phase 5.2). Per-roof
// editing now happens by selecting the roof object in the plan (Select tool) and
// using the properties panel — there is no per-section list here anymore.
export function RoofPanel() {
  const hideRoofs = useStore((s) => s.hideRoofs);
  const setHideRoofs = useStore((s) => s.setHideRoofs);

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
      <p className="roof-empty">
        Use the Roof tool to drag a roof, then select it to edit.
      </p>
    </section>
  );
}
