import { useRef, useState } from "react";
import { useStore } from "../store/store";
import { exportDesignToFile, parseImportedDesign } from "../persistence/io";
import { LayoutToggle } from "./LayoutToggle";

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
        <span className="topbar-divider" />
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
    </header>
  );
}
