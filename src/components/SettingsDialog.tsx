import { useStore } from "../store/store";
import type { CollisionMode } from "../persistence/viewPrefs";

const COLLISION_OPTIONS: {
  mode: CollisionMode;
  label: string;
  desc: string;
}[] = [
  { mode: "off", label: "Off", desc: "No collision checks." },
  { mode: "soft", label: "Soft", desc: "Warns but lets you overlap." },
  { mode: "hard", label: "Hard", desc: "Prevents overlapping." },
];

// App settings (gear in the toolbar). Structured so future settings slot in as
// new sections. First setting: furniture collision mode (a persisted UI pref).
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const collisionMode = useStore((s) => s.collisionMode);
  const setCollisionMode = useStore((s) => s.setCollisionMode);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <h2 className="modal-title">Settings</h2>

        <section className="settings-section">
          <h3 className="settings-heading">Furniture collision</h3>
          <p className="modal-hint">
            How bulky items react when their footprints overlap (same level only;
            rugs, lamps, and other surface/decor items never collide).
          </p>
          <div className="settings-options" role="radiogroup" aria-label="Collision mode">
            {COLLISION_OPTIONS.map((o) => (
              <button
                key={o.mode}
                type="button"
                role="radio"
                aria-checked={collisionMode === o.mode}
                className={`settings-option${collisionMode === o.mode ? " active" : ""}`}
                onClick={() => setCollisionMode(o.mode)}
              >
                <span className="settings-option-label">{o.label}</span>
                <span className="settings-option-desc">{o.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="site-form-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
