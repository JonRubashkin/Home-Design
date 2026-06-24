// Help panel (the "?" button in the top bar). A concise, skimmable list of tools
// and keyboard shortcuts — NOT a guided tour.
//
// ⚠️ HAND-MAINTAINED LIST ⚠️
// The SHORTCUT_GROUPS below are written by hand and are NOT derived from the
// keymap/toolbar. When you add, remove, or change a tool shortcut (see
// src/hooks/useGlobalShortcuts.ts and src/components/Toolbar.tsx) or an
// editing/rotation/copy-paste binding, UPDATE THIS LIST too, or the Help panel
// will silently drift out of sync. (CLAUDE.md / README note this as well.)

import { STORAGE_DISCLOSURE } from "../lib/storageDisclosure";
import {
  APP_NAME,
  APP_VERSION,
  AUTHOR_NAME,
  AUTHOR_URL,
  FEEDBACK_LINK,
  SHOW_FEEDBACK,
  feedbackHref,
  isEmail,
} from "../lib/credits";

interface Shortcut {
  keys: string;
  label: string;
}
interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Tools",
    items: [
      { keys: "V", label: "Select" },
      { keys: "W", label: "Wall / Room (sub-mode in the panel)" },
      { keys: "N", label: "Window" },
      { keys: "D", label: "Door" },
      { keys: "F", label: "Floor" },
      { keys: "P", label: "Paint" },
      { keys: "G", label: "Fill Room" },
      { keys: "S", label: "Stairs" },
      { keys: "O", label: "Roof" },
      { keys: "U", label: "Furniture" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: "Ctrl+Z", label: "Undo" },
      { keys: "Ctrl+Shift+Z / Ctrl+Y", label: "Redo" },
      { keys: "Ctrl+C", label: "Copy selection" },
      { keys: "Ctrl+V", label: "Paste" },
      { keys: "Delete / Backspace", label: "Delete selection" },
    ],
  },
  {
    title: "Drawing & placement",
    items: [
      { keys: "R / Shift+R", label: "Rotate (furniture, stairs, roof)" },
      { keys: "Shift", label: "Constrain a wall to 0 / 45 / 90°" },
      { keys: "Enter / double-click", label: "End a wall chain" },
      { keys: "Esc", label: "Cancel the current action" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: "Space-drag / middle-drag", label: "Pan the plan" },
      { keys: "Scroll", label: "Zoom (cursor-centered)" },
      { keys: "Drag", label: "Orbit the 3D preview" },
    ],
  },
];

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card help-card"
        role="dialog"
        aria-modal="true"
        aria-label="Help"
      >
        <h2 className="modal-title">Help &amp; shortcuts</h2>
        <div className="help-groups">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="help-group">
              <h3 className="help-group-title">{group.title}</h3>
              <ul className="help-list">
                {group.items.map((item) => (
                  <li key={item.keys + item.label} className="help-row">
                    <kbd className="help-keys">{item.keys}</kbd>
                    <span className="help-label">{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <section className="help-about">
          <h3 className="help-group-title">About</h3>
          <p className="help-about-line">{APP_NAME}</p>
          <p className="help-about-line help-about-muted">
            Made by{" "}
            {AUTHOR_URL ? (
              <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
                {AUTHOR_NAME}
              </a>
            ) : (
              AUTHOR_NAME
            )}
          </p>
          <p className="help-about-line help-about-muted">{APP_VERSION}</p>
          {SHOW_FEEDBACK && FEEDBACK_LINK && (
            <p className="help-about-line">
              <a
                href={feedbackHref(FEEDBACK_LINK)}
                {...(isEmail(FEEDBACK_LINK)
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer" })}
              >
                Send feedback
              </a>
            </p>
          )}
        </section>
        <p className="help-footer-note">{STORAGE_DISCLOSURE}</p>
        <div className="site-form-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
