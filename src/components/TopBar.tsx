import { useState } from "react";
import { useStore } from "../store/store";
import { LayoutToggle } from "./LayoutToggle";
import { SettingsDialog } from "./SettingsDialog";
import { ResizeAreaDialog } from "./ResizeAreaDialog";
import { DesignLibraryModal } from "./DesignLibrary";
import { ExportMenu } from "./ExportMenu";
import { DesignFileMenu } from "./DesignFileMenu";
import { HelpPanel } from "./HelpPanel";
import { NewDesignDialog } from "./NewDesignDialog";
import { OverflowBar, type OverflowBarItem } from "./OverflowBar";

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

  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const onNew = () => {
    // The current design is already autosaved to its library record; New just
    // opens the size chooser (pre-filled with the current site) for a fresh one,
    // so no data is lost.
    setNewOpen(true);
  };

  // Top-bar controls in display order, each with an overflow priority (lower =
  // kept visible longer; the highest numbers collapse into the "⋯" menu first):
  // Undo/Redo > New > My Designs > Design JSON > Export image > Settings > Help >
  // Resize area. Icon-only buttons carry a labelled menuNode for the dropdown;
  // the two own-popover controls are flagged `submenu` so clicking them doesn't
  // close the overflow menu.
  const items: OverflowBarItem[] = [
    {
      key: "undo",
      priority: 1,
      node: (
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
      ),
    },
    {
      key: "redo",
      priority: 2,
      node: (
        <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
      ),
    },
    {
      key: "settings",
      priority: 7,
      node: (
        <button
          type="button"
          className="topbar-icon-button"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          {GearIcon}
        </button>
      ),
      menuNode: (
        <button type="button" onClick={() => setSettingsOpen(true)} title="Settings">
          {GearIcon}
          <span>Settings</span>
        </button>
      ),
    },
    {
      key: "help",
      priority: 8,
      node: (
        <button
          type="button"
          className="topbar-icon-button"
          onClick={() => setHelpOpen(true)}
          title="Help & keyboard shortcuts"
          aria-label="Help"
        >
          ?
        </button>
      ),
      menuNode: (
        <button type="button" onClick={() => setHelpOpen(true)} title="Help & keyboard shortcuts">
          Help &amp; shortcuts
        </button>
      ),
    },
    { key: "export", priority: 6, node: <ExportMenu />, submenu: true },
    {
      key: "mydesigns",
      priority: 4,
      node: (
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          title="Switch between your saved designs"
        >
          My Designs
        </button>
      ),
    },
    {
      key: "resize",
      priority: 9,
      node: (
        <button type="button" onClick={() => setResizeOpen(true)} title="Resize the work area">
          Resize area
        </button>
      ),
    },
    {
      key: "new",
      priority: 3,
      node: (
        <button type="button" onClick={onNew} title="New design">
          New
        </button>
      ),
    },
    {
      key: "designjson",
      priority: 5,
      node: <DesignFileMenu onError={setError} />,
      submenu: true,
    },
  ];

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <strong>Home Design</strong>
        <span className="topbar-docname">{design.name}</span>
      </div>

      <LayoutToggle />

      <OverflowBar className="topbar-actions" items={items} menuLabel="More actions" />

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

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {resizeOpen && <ResizeAreaDialog onClose={() => setResizeOpen(false)} />}
      {newOpen && <NewDesignDialog onClose={() => setNewOpen(false)} />}
      {libraryOpen && (
        <DesignLibraryModal
          onClose={() => setLibraryOpen(false)}
          onRequestNew={() => setNewOpen(true)}
        />
      )}
    </header>
  );
}
