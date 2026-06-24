import { useStore } from "../store/store";
import { SiteSizeForm } from "./SiteSizeForm";

// Modal for "New design" from inside the app (top bar New, My Designs → New).
// The size chooser is PRE-FILLED with the current design's site so a new design
// defaults to the size you're already working at — still fully editable before
// confirming. (First-run "new" from the welcome screen keeps its own default and
// doesn't use this dialog.) Confirming creates a fresh blank design at the chosen
// size via startNewDesign.
export function NewDesignDialog({ onClose }: { onClose: () => void }) {
  const site = useStore((s) => s.design.site);
  const startNewDesign = useStore((s) => s.startNewDesign);

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
        aria-label="New design"
      >
        <h2 className="modal-title">New design</h2>
        <p className="modal-hint">
          Pick the work area for your new design — it defaults to your current
          size and you can change it later.
        </p>
        <SiteSizeForm
          initial={site}
          confirmLabel="Create design"
          onConfirm={(s) => {
            startNewDesign(s);
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
