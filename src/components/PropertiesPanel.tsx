import { useEffect, useState } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import { wallLength, wallDirection } from "../geometry/wall";
import { snapToGrid } from "../geometry/snap";
import { add, scale } from "../geometry/vec";

// A numeric field that holds a local string while editing and commits on blur
// or Enter, so each edit is a single undo step (not one per keystroke).
function NumberField({
  label,
  value,
  min,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value.toFixed(2));

  useEffect(() => {
    setDraft(value.toFixed(2));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed >= min) onCommit(parsed);
    else setDraft(value.toFixed(2)); // revert invalid input
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <span className="field-unit">m</span>
      </span>
    </label>
  );
}

export function PropertiesPanel() {
  const selection = useStore((s) => s.selection);
  const level = useStore(selectCurrentLevel);
  const updateWall = useStore((s) => s.updateWall);
  const deleteWall = useStore((s) => s.deleteWall);

  const wall = selection
    ? level.walls.find((w) => w.id === selection.id)
    : undefined;

  if (!wall) {
    return (
      <aside className="properties" aria-label="Properties">
        <h2 className="properties-title">Properties</h2>
        <div className="properties-empty">
          <p>Nothing selected.</p>
          <ul>
            <li>
              Press <kbd>W</kbd> and click to draw walls. Click again to chain;
              press <kbd>Enter</kbd> or double-click to finish.
            </li>
            <li>
              Press <kbd>V</kbd> to select. Click a wall to edit it, drag its
              ends or body to move it.
            </li>
            <li>
              Hold <kbd>Shift</kbd> while drawing to snap to 0/45/90°.
            </li>
            <li>
              <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Ctrl</kbd>+
              <kbd>Shift</kbd>+<kbd>Z</kbd> redo.
            </li>
          </ul>
        </div>
      </aside>
    );
  }

  const length = wallLength(wall);

  const setLength = (newLength: number) => {
    const dir = wallDirection(wall);
    if (dir.x === 0 && dir.y === 0) return; // zero-length wall has no direction
    const newEnd = snapToGrid(add(wall.start, scale(dir, newLength)));
    updateWall(wall.id, { end: newEnd });
  };

  return (
    <aside className="properties" aria-label="Properties">
      <h2 className="properties-title">Wall</h2>
      <div className="properties-fields">
        <NumberField
          label="Length"
          value={length}
          min={0.1}
          step={0.1}
          onCommit={setLength}
        />
        <NumberField
          label="Thickness"
          value={wall.thickness}
          min={0.02}
          step={0.01}
          onCommit={(v) => updateWall(wall.id, { thickness: v })}
        />
        <NumberField
          label="Height"
          value={wall.height}
          min={0.1}
          step={0.1}
          onCommit={(v) => updateWall(wall.id, { height: v })}
        />
      </div>
      <button
        type="button"
        className="danger-button"
        onClick={() => deleteWall(wall.id)}
      >
        Delete wall
      </button>
    </aside>
  );
}
