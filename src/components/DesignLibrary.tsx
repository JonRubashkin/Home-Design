import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { validateDesign } from "../persistence/storage";
import {
  deleteDesignRecord,
  duplicateDesignRecord,
  getDesignRecord,
  listDesigns,
  renameDesignRecord,
  type DesignRecord,
} from "../storage/library";

// Open a stored record into the editor, running schema migrations on the way in.
async function openRecordById(id: string): Promise<void> {
  const record = await getDesignRecord(id);
  if (!record) return;
  const result = validateDesign(record.design);
  const design = result.ok ? result.design : record.design;
  useStore.getState().openRecord(record.id, design);
}

function formatModified(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

// The shared "My Designs" list with New / Open / Duplicate / Rename / Delete.
// Used on the welcome screen (mode "welcome") and from the in-app menu (mode
// "app", where the currently-open design can't be deleted out from under you).
export function DesignLibrary({
  records,
  reload,
  onNew,
  onAfterOpen,
  mode,
}: {
  records: DesignRecord[];
  reload: () => void;
  onNew: () => void;
  onAfterOpen?: () => void;
  mode: "welcome" | "app";
}) {
  const openDesignId = useStore((s) => s.openDesignId);
  const renameDesign = useStore((s) => s.renameDesign);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const open = async (id: string) => {
    await openRecordById(id);
    onAfterOpen?.();
  };

  const duplicate = async (id: string) => {
    await duplicateDesignRecord(id);
    reload();
  };

  const remove = async (record: DesignRecord) => {
    if (!window.confirm(`Delete "${record.name}"? This can't be undone.`)) return;
    await deleteDesignRecord(record.id);
    reload();
  };

  const startRename = (record: DesignRecord) => {
    setRenamingId(record.id);
    setDraftName(record.name);
  };

  const commitRename = async (id: string) => {
    const name = draftName.trim() || "Untitled design";
    if (mode === "app" && id === openDesignId) {
      // The open design is owned by the store; rename there so autosave persists.
      renameDesign(name);
    } else {
      await renameDesignRecord(id, name);
    }
    setRenamingId(null);
    reload();
  };

  return (
    <div className="library">
      <div className="library-head">
        <h2 className="library-title">My Designs</h2>
        <button type="button" className="primary-button" onClick={onNew}>
          + New design
        </button>
      </div>

      {records.length === 0 ? (
        <p className="library-empty">No saved designs yet.</p>
      ) : (
        <ul className="library-list">
          {records.map((r) => {
            const isOpen = mode === "app" && r.id === openDesignId;
            return (
              <li key={r.id} className={`library-row${isOpen ? " open" : ""}`}>
                <button
                  type="button"
                  className="library-thumb"
                  title="Open this design"
                  onClick={() => open(r.id)}
                >
                  {r.thumbnail ? (
                    <img src={r.thumbnail} alt="" />
                  ) : (
                    <span className="library-thumb-empty" aria-hidden="true" />
                  )}
                </button>
                <div className="library-meta">
                  {renamingId === r.id ? (
                    <input
                      className="library-rename"
                      value={draftName}
                      autoFocus
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => commitRename(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(r.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="library-name"
                      onClick={() => open(r.id)}
                    >
                      {r.name}
                      {isOpen && <span className="library-badge">open</span>}
                    </button>
                  )}
                  <span className="library-date">
                    {formatModified(r.modifiedAt)}
                  </span>
                </div>
                <div className="library-actions">
                  <button type="button" onClick={() => open(r.id)}>
                    Open
                  </button>
                  <button type="button" onClick={() => duplicate(r.id)}>
                    Duplicate
                  </button>
                  <button type="button" onClick={() => startRename(r)}>
                    Rename
                  </button>
                  <button
                    type="button"
                    className="danger-link"
                    disabled={isOpen}
                    title={
                      isOpen
                        ? "Can't delete the design you're editing"
                        : "Delete this design"
                    }
                    onClick={() => remove(r)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// A modal wrapper used from inside the app (switch designs / Save As).
export function DesignLibraryModal({
  onClose,
  onRequestNew,
}: {
  onClose: () => void;
  onRequestNew: () => void;
}) {
  const [records, setRecords] = useState<DesignRecord[]>([]);
  const saveAs = useStore((s) => s.saveAs);
  const designName = useStore((s) => s.design.name);

  const reload = () => {
    void listDesigns().then(setRecords);
  };
  useEffect(reload, []);

  // New design opens the size chooser (pre-filled with the current site) rather
  // than creating a fixed-size design immediately — handled by the parent so the
  // chooser replaces this modal.
  const onNew = () => {
    onClose();
    onRequestNew();
  };

  const onSaveAs = () => {
    const name = window.prompt("Save a copy as:", `${designName} (copy)`);
    if (name == null) return;
    saveAs(name.trim() || `${designName} (copy)`);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card library-modal"
        role="dialog"
        aria-modal="true"
        aria-label="My Designs"
      >
        <DesignLibrary
          records={records}
          reload={reload}
          onNew={onNew}
          onAfterOpen={onClose}
          mode="app"
        />
        <div className="site-form-actions">
          <button type="button" className="ghost-button" onClick={onSaveAs}>
            Save as copy…
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
