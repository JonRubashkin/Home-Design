import { useEffect, useState } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import type { WallSide } from "../store/store";
import { wallLength, wallDirection } from "../geometry/wall";
import { snapToGrid } from "../geometry/snap";
import { add, scale } from "../geometry/vec";
import { validateWindow, clampWindowT } from "../geometry/windows";
import { validateDoor } from "../geometry/doors";
import { MaterialPicker } from "./material/MaterialPicker";
import { MaterialChip } from "./material/MaterialChip";

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

const EMPTY_TIPS = (
  <div className="properties-empty">
    <p>Nothing selected.</p>
    <ul>
      <li>
        <kbd>W</kbd> draw walls · <kbd>N</kbd> add windows · <kbd>F</kbd> draw
        floors · <kbd>P</kbd> paint wall sides.
      </li>
      <li>
        <kbd>V</kbd> to select. Click a wall, window, or floor to edit it; drag
        walls, their ends, or windows to move them.
      </li>
      <li>
        Hold <kbd>Shift</kbd> while drawing to snap to 0/45/90°.
      </li>
      <li>
        <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+
        <kbd>Z</kbd> redo, <kbd>Delete</kbd> removes the selection.
      </li>
    </ul>
  </div>
);

// When the paint or floor tool is active, dock the shared material picker.
function ToolMaterialPanel({ tool }: { tool: "paint" | "floor" }) {
  const currentMaterial = useStore((s) => s.currentMaterial);
  const setCurrentMaterial = useStore((s) => s.setCurrentMaterial);
  return (
    <aside className="properties" aria-label="Material">
      <h2 className="properties-title">
        {tool === "paint" ? "Paint" : "Floor"}
      </h2>
      <p className="properties-hint">
        {tool === "paint"
          ? "Pick a material, then click a wall side in the plan to paint it."
          : "Pick a material, then click in the plan to outline a floor."}
      </p>
      <MaterialPicker value={currentMaterial} onChange={setCurrentMaterial} />
    </aside>
  );
}

type EditTarget =
  | { kind: "wallSide"; wallId: string; side: WallSide }
  | { kind: "doorMat"; wallId: string; id: string }
  | { kind: "floor"; id: string };

// A two-option segmented toggle for door hinge / swing.
function ToggleField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="toggle-row">
      <span className="field-label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`seg-button${value === o.value ? " active" : ""}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const activeTool = useStore((s) => s.activeTool);
  const selection = useStore((s) => s.selection);
  const level = useStore(selectCurrentLevel);
  const updateWall = useStore((s) => s.updateWall);
  const deleteWall = useStore((s) => s.deleteWall);
  const updateWindow = useStore((s) => s.updateWindow);
  const deleteWindow = useStore((s) => s.deleteWindow);
  const updateDoor = useStore((s) => s.updateDoor);
  const deleteDoor = useStore((s) => s.deleteDoor);
  const setDoorMaterial = useStore((s) => s.setDoorMaterial);
  const paintWallSide = useStore((s) => s.paintWallSide);
  const setFloorMaterial = useStore((s) => s.setFloorMaterial);
  const deleteFloor = useStore((s) => s.deleteFloor);
  const setSideHighlight = useStore((s) => s.setSideHighlight);

  const [edit, setEdit] = useState<EditTarget | null>(null);
  const selectionKey = selection ? JSON.stringify(selection) : "none";
  useEffect(() => {
    setEdit(null);
    return () => setSideHighlight(null);
  }, [selectionKey, activeTool, setSideHighlight]);

  if (activeTool === "paint" || activeTool === "floor") {
    return <ToolMaterialPanel tool={activeTool} />;
  }

  // --- wall selected ---
  if (selection?.kind === "wall") {
    const wall = level.walls.find((w) => w.id === selection.id);
    if (!wall) return <aside className="properties">{EMPTY_TIPS}</aside>;

    const setLength = (newLength: number) => {
      const dir = wallDirection(wall);
      if (dir.x === 0 && dir.y === 0) return;
      updateWall(wall.id, {
        end: snapToGrid(add(wall.start, scale(dir, newLength))),
      });
    };

    if (edit?.kind === "wallSide") {
      const material = edit.side === "A" ? wall.paintA : wall.paintB;
      return (
        <aside className="properties" aria-label="Paint side">
          <PickerHeader
            title={`Side ${edit.side}`}
            onDone={() => setEdit(null)}
          />
          <MaterialPicker
            value={material}
            onChange={(m) => paintWallSide(wall.id, edit.side, m)}
          />
        </aside>
      );
    }

    return (
      <aside className="properties" aria-label="Wall">
        <h2 className="properties-title">Wall</h2>
        <div className="properties-fields">
          <NumberField
            label="Length"
            value={wallLength(wall)}
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
        <h3 className="properties-subhead">Paint</h3>
        <div className="chip-row">
          <MaterialChip
            material={wall.paintA}
            label="Side A"
            onClick={() =>
              setEdit({ kind: "wallSide", wallId: wall.id, side: "A" })
            }
            onHoverChange={(h) =>
              setSideHighlight(h ? { wallId: wall.id, side: "A" } : null)
            }
          />
          <MaterialChip
            material={wall.paintB}
            label="Side B"
            onClick={() =>
              setEdit({ kind: "wallSide", wallId: wall.id, side: "B" })
            }
            onHoverChange={(h) =>
              setSideHighlight(h ? { wallId: wall.id, side: "B" } : null)
            }
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

  // --- window selected ---
  if (selection?.kind === "window") {
    const wall = level.walls.find((w) => w.id === selection.wallId);
    const win = wall?.windows.find((x) => x.id === selection.id);
    if (!wall || !win)
      return <aside className="properties">{EMPTY_TIPS}</aside>;
    const L = wallLength(wall);

    // Apply a window edit only if it stays valid; otherwise let the field revert.
    const tryUpdate = (patch: Partial<typeof win>) => {
      const candidate = { ...win, ...patch };
      if (validateWindow(wall, candidate, win.id).ok) {
        updateWindow(wall.id, win.id, patch);
      }
    };

    return (
      <aside className="properties" aria-label="Window">
        <h2 className="properties-title">Window</h2>
        <div className="properties-fields">
          <NumberField
            label="Width"
            value={win.width}
            min={0.1}
            step={0.1}
            onCommit={(v) => tryUpdate({ width: v })}
          />
          <NumberField
            label="Height"
            value={win.height}
            min={0.1}
            step={0.1}
            onCommit={(v) => tryUpdate({ height: v })}
          />
          <NumberField
            label="Sill height"
            value={win.sillHeight}
            min={0}
            step={0.1}
            onCommit={(v) => tryUpdate({ sillHeight: v })}
          />
          <NumberField
            label="Position"
            value={win.t * L}
            min={0}
            step={0.1}
            onCommit={(meters) => {
              const t = clampWindowT(wall, win.width, meters / L);
              tryUpdate({ t });
            }}
          />
        </div>
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteWindow(wall.id, win.id)}
        >
          Delete window
        </button>
      </aside>
    );
  }

  // --- door selected ---
  if (selection?.kind === "door") {
    const wall = level.walls.find((w) => w.id === selection.wallId);
    const door = wall?.doors.find((x) => x.id === selection.id);
    if (!wall || !door)
      return <aside className="properties">{EMPTY_TIPS}</aside>;
    const L = wallLength(wall);

    const tryUpdate = (patch: Partial<typeof door>) => {
      if (validateDoor(wall, { ...door, ...patch }, door.id).ok)
        updateDoor(wall.id, door.id, patch);
    };

    if (edit?.kind === "doorMat") {
      return (
        <aside className="properties" aria-label="Door material">
          <PickerHeader title="Door material" onDone={() => setEdit(null)} />
          <MaterialPicker
            value={door.material}
            onChange={(m) => setDoorMaterial(wall.id, door.id, m)}
          />
        </aside>
      );
    }

    return (
      <aside className="properties" aria-label="Door">
        <h2 className="properties-title">Door</h2>
        <div className="properties-fields">
          <NumberField
            label="Width"
            value={door.width}
            min={0.1}
            step={0.1}
            onCommit={(v) => tryUpdate({ width: v })}
          />
          <NumberField
            label="Height"
            value={door.height}
            min={0.1}
            step={0.1}
            onCommit={(v) => tryUpdate({ height: v })}
          />
          <NumberField
            label="Position"
            value={door.t * L}
            min={0}
            step={0.1}
            onCommit={(meters) =>
              tryUpdate({ t: clampWindowT(wall, door.width, meters / L) })
            }
          />
        </div>
        <ToggleField
          label="Hinge"
          value={door.hinge}
          options={[
            { value: "start", label: "Start" },
            { value: "end", label: "End" },
          ]}
          onChange={(v) => updateDoor(wall.id, door.id, { hinge: v })}
        />
        <ToggleField
          label="Opens toward"
          value={door.swing}
          options={[
            { value: "A", label: "Side A" },
            { value: "B", label: "Side B" },
          ]}
          onChange={(v) => updateDoor(wall.id, door.id, { swing: v })}
        />
        <h3 className="properties-subhead">Material</h3>
        <div className="chip-row">
          <MaterialChip
            material={door.material}
            label="Door"
            onClick={() =>
              setEdit({ kind: "doorMat", wallId: wall.id, id: door.id })
            }
          />
        </div>
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteDoor(wall.id, door.id)}
        >
          Delete door
        </button>
      </aside>
    );
  }

  // --- floor selected ---
  if (selection?.kind === "floor") {
    const floor = level.floors.find((f) => f.id === selection.id);
    if (!floor) return <aside className="properties">{EMPTY_TIPS}</aside>;

    if (edit?.kind === "floor") {
      return (
        <aside className="properties" aria-label="Floor material">
          <PickerHeader title="Floor material" onDone={() => setEdit(null)} />
          <MaterialPicker
            value={floor.material}
            onChange={(m) => setFloorMaterial(floor.id, m)}
          />
        </aside>
      );
    }

    return (
      <aside className="properties" aria-label="Floor">
        <h2 className="properties-title">Floor</h2>
        <h3 className="properties-subhead">Material</h3>
        <div className="chip-row">
          <MaterialChip
            material={floor.material}
            label="Floor"
            onClick={() => setEdit({ kind: "floor", id: floor.id })}
          />
        </div>
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteFloor(floor.id)}
        >
          Delete floor
        </button>
      </aside>
    );
  }

  return (
    <aside className="properties" aria-label="Properties">
      {EMPTY_TIPS}
    </aside>
  );
}

function PickerHeader({
  title,
  onDone,
}: {
  title: string;
  onDone: () => void;
}) {
  return (
    <div className="picker-header">
      <button type="button" className="link-button" onClick={onDone}>
        ← Back
      </button>
      <h2 className="properties-title">{title}</h2>
    </div>
  );
}
