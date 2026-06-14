import { useStore } from "../store/store";
import { formatMeters } from "../lib/format";

// Vertical level list docked over the workspace, ground floor at the BOTTOM and
// upper floors stacked above (matching physical stacking). Click a row to make it
// the active (editable) level; rename inline; delete (with confirm); add a floor
// on top. All structural changes are undoable store actions.
export function LevelsPanel() {
  const levels = useStore((s) => s.design.levels);
  const currentLevelId = useStore((s) => s.currentLevelId);
  const setCurrentLevel = useStore((s) => s.setCurrentLevel);
  const addLevelAbove = useStore((s) => s.addLevelAbove);
  const deleteLevel = useStore((s) => s.deleteLevel);
  const renameLevel = useStore((s) => s.renameLevel);

  const canDelete = levels.length > 1;

  return (
    <aside className="levels" aria-label="Levels">
      <button
        type="button"
        className="levels-add"
        title="Add an empty floor on top"
        onClick={addLevelAbove}
      >
        + Add floor above
      </button>
      <ul className="levels-list">
        {/* Render top floor first so the ground floor sits at the bottom. */}
        {levels
          .map((level, i) => ({ level, i }))
          .reverse()
          .map(({ level, i }) => {
            const active = level.id === currentLevelId;
            return (
              <li
                key={level.id}
                className={`level-row${active ? " active" : ""}`}
                onPointerDown={() => setCurrentLevel(level.id)}
              >
                <span className="level-indicator" aria-hidden="true" />
                <input
                  className="level-name"
                  value={level.name}
                  aria-label={`Level ${i + 1} name`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => renameLevel(level.id, e.target.value)}
                />
                <span className="level-elev" title="Floor elevation">
                  {formatMeters(level.elevation)}
                </span>
                <button
                  type="button"
                  className="level-delete"
                  title="Delete this floor"
                  disabled={!canDelete}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete "${level.name}" and everything on it?`,
                      )
                    )
                      deleteLevel(level.id);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
      </ul>
    </aside>
  );
}
