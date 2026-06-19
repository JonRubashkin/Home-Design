import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { exportDesignToFile, parseImportedDesign } from "../persistence/io";

// Unified design-file control for the top bar (mirrors ExportMenu). A single
// button opens a small popover to **Import** or **Export** the design as JSON.
// Import errors are surfaced through `onError` so the top bar shows them in its
// existing error banner.
export function DesignFileMenu({
  onError,
}: {
  onError: (message: string | null) => void;
}) {
  const design = useStore((s) => s.design);
  const setDesign = useStore((s) => s.setDesign);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Close on outside click / Escape (same behavior as ExportMenu).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onImportClick = () => {
    onError(null);
    setOpen(false);
    fileInput.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      setDesign(parseImportedDesign(text));
      onError(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not import file.");
    }
  };

  const onExport = () => {
    exportDesignToFile(design);
    setOpen(false);
  };

  return (
    <div className="export-menu" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Import or export the design as JSON"
        onClick={() => setOpen((v) => !v)}
      >
        Design JSON ▾
      </button>
      {open && (
        <div className="export-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            title="Import a design from a JSON file"
            onClick={onImportClick}
          >
            Import JSON…
          </button>
          <button
            type="button"
            role="menuitem"
            title="Export the current design as a JSON file"
            onClick={onExport}
          >
            Export JSON
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={onFileChosen}
      />
    </div>
  );
}
