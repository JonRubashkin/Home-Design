import { useStore } from "../store/store";
import { SiteSizeForm } from "./SiteSizeForm";

// Modal for the "Resize area" toolbar button. Re-pick a preset or enter a custom
// width × depth; confirming updates Design.site (undoable). Because the boundary
// is soft, this never moves or deletes anything — items left outside a shrunk
// border stay exactly where they are.
export function ResizeAreaDialog({ onClose }: { onClose: () => void }) {
  const site = useStore((s) => s.design.site);
  const setSite = useStore((s) => s.setSite);

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
        aria-label="Resize work area"
      >
        <h2 className="modal-title">Resize work area</h2>
        <p className="modal-hint">
          The boundary is a soft guide — resizing keeps every wall and item
          exactly where it is.
        </p>
        <SiteSizeForm
          initial={site}
          confirmLabel="Apply size"
          onConfirm={(s) => {
            setSite(s);
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
