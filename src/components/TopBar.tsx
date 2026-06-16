import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { exportDesignToFile, parseImportedDesign } from "../persistence/io";
import { LayoutToggle } from "./LayoutToggle";
import { SettingsDialog } from "./SettingsDialog";
import { ResizeAreaDialog } from "./ResizeAreaDialog";

const GearIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path
      d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export function TopBar() {
  const design = useStore((s) => s.design);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const newDesign = useStore((s) => s.newDesign);
  const setDesign = useStore((s) => s.setDesign);

  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);

  const onImportClick = () => {
    setError(null);
    fileInput.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      setDesign(parseImportedDesign(text));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import file.");
    }
  };

  const onNew = () => {
    if (window.confirm("Start a new design? Unsaved changes will be lost.")) {
      newDesign();
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <strong>Home Design</strong>
        <span className="topbar-docname">{design.name}</span>
      </div>

      <LayoutToggle />

      <div className="topbar-actions">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button
          type="button"
          className="topbar-icon-button"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          {GearIcon}
        </button>
        <span className="topbar-divider" />
        <button
          type="button"
          onClick={() => setResizeOpen(true)}
          title="Resize the work area"
        >
          Resize area
        </button>
        <button type="button" onClick={onNew} title="New design">
          New
        </button>
        <button
          type="button"
          onClick={onImportClick}
          title="Import a design JSON"
        >
          Import
        </button>
        <button
          type="button"
          onClick={() => exportDesignToFile(design)}
          title="Export the design as JSON"
        >
          Export
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onFileChosen}
        />
      </div>

      {error && (
        <div className="topbar-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {resizeOpen && <ResizeAreaDialog onClose={() => setResizeOpen(false)} />}
    </header>
  );
}
