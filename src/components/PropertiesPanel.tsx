import { useEffect, useState, type ReactNode } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import type { WallSide } from "../store/store";
import { wallLength, wallDirection } from "../geometry/wall";
import { snapToGrid } from "../geometry/snap";
import { add, scale } from "../geometry/vec";
import { validateWindow, clampWindowT } from "../geometry/windows";
import { validateDoor } from "../geometry/doors";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATALOG_ITEMS,
  getCatalogEntry,
  effectiveDimensions,
  dimensionToMultiplier,
  resolveVariantId,
  type CatalogEntry,
} from "../catalog";
import type { Vec3 } from "../model/types";
import { MaterialPicker } from "./material/MaterialPicker";
import { MaterialChip } from "./material/MaterialChip";
import { FurnitureThumb } from "./FurnitureSymbol";

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

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const EMPTY_TIPS = (
  <div className="properties-empty">
    <p>Nothing selected.</p>
    <ul>
      <li>
        <kbd>W</kbd> walls · <kbd>N</kbd> windows · <kbd>D</kbd> doors ·{" "}
        <kbd>F</kbd> floors · <kbd>P</kbd> paint · <kbd>U</kbd> furniture.
      </li>
      <li>
        <kbd>V</kbd> to select anything; drag to move. <kbd>R</kbd> / Shift+
        <kbd>R</kbd> rotate a selected item in 15° steps.
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

// Wall tool panel: choose the sub-mode — Draw (chain walls) or Room (drag a
// rectangle of four joined walls). The two share one toolbar button.
function WallToolPanel() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const mode: "wall" | "room" = activeTool === "room" ? "room" : "wall";
  return (
    <aside className="properties" aria-label="Wall tool">
      <h2 className="properties-title">Walls</h2>
      <ToggleField
        label="Mode"
        value={mode}
        options={[
          { value: "wall", label: "Draw" },
          { value: "room", label: "Room" },
        ]}
        onChange={(v) => setActiveTool(v)}
      />
      <p className="properties-hint">
        {mode === "room"
          ? "Drag a rectangle to create four joined walls."
          : "Click to start a wall and keep clicking to chain; Enter or double-click finishes. Hold Shift for 0/45/90°."}
      </p>
    </aside>
  );
}

// Fill Room tool panel: choose what to fill (floor / walls / both) with the
// current material, then click inside an enclosed room.
function FillRoomPanel() {
  const currentMaterial = useStore((s) => s.currentMaterial);
  const setCurrentMaterial = useStore((s) => s.setCurrentMaterial);
  const fillTarget = useStore((s) => s.fillTarget);
  const setFillTarget = useStore((s) => s.setFillTarget);
  return (
    <aside className="properties" aria-label="Fill room">
      <h2 className="properties-title">Fill room</h2>
      <p className="properties-hint">
        Click inside a fully enclosed room to fill its floor and/or paint its
        interior wall faces with the current material.
      </p>
      <ToggleField
        label="Fill"
        value={fillTarget}
        options={[
          { value: "both", label: "Both" },
          { value: "floor", label: "Floor" },
          { value: "walls", label: "Walls" },
        ]}
        onChange={setFillTarget}
      />
      <h3 className="properties-subhead">Material</h3>
      <MaterialPicker value={currentMaterial} onChange={setCurrentMaterial} />
    </aside>
  );
}

type EditTarget =
  | { kind: "wallSide"; wallId: string; side: WallSide }
  | { kind: "doorMat"; wallId: string; id: string }
  | { kind: "mountMat"; wallId: string; id: string; slot: string }
  | { kind: "lightMat"; id: string; slot: string }
  | { kind: "furnSlot"; id: string; slot: string }
  | { kind: "stairMat"; id: string }
  | { kind: "roofMat"; id: string }
  | { kind: "floor"; id: string };

const ROOF_TYPES: { type: "flat" | "gabled" | "hipped" | "pitched"; label: string }[] = [
  { type: "flat", label: "Flat" },
  { type: "gabled", label: "Gabled" },
  { type: "hipped", label: "Hipped" },
  { type: "pitched", label: "Shed" },
];

// One placeable palette button: a catalog entry, optionally narrowed to a single
// shape variant. Variant-bearing entries (trees, shrubs) expand to one button
// per variant so any variant can be placed directly from the palette.
interface PaletteButton {
  entry: CatalogEntry;
  variant?: string;
  key: string;
  label: string;
}

function paletteButtons(entry: CatalogEntry): PaletteButton[] {
  if (!entry.variants || entry.variants.length === 0) {
    return [{ entry, key: entry.id, label: entry.name }];
  }
  return entry.variants.map((v) => ({
    entry,
    variant: v.id,
    key: `${entry.id}:${v.id}`,
    label: `${entry.name} — ${v.name}`,
  }));
}

// The Furniture tool's right-panel palette: catalog items in collapsible
// category groups behaving as an accordion (one group open at a time). The open
// group is a persisted UI pref restored when the tool reopens; default is all
// collapsed. Empty categories are skipped so new items land in the right group
// automatically (groups derive from the catalog `category` field).
function FurniturePalette() {
  const placingCatalogId = useStore((s) => s.placingCatalogId);
  const placingVariant = useStore((s) => s.placingVariant);
  const setPlacingCatalogId = useStore((s) => s.setPlacingCatalogId);
  const openCategory = useStore((s) => s.openPaletteCategory);
  const setOpenPaletteCategory = useStore((s) => s.setOpenPaletteCategory);

  // Only categories that have at least one catalog item show a header.
  const groups = CATEGORIES.filter((cat) =>
    CATALOG_ITEMS.some((e) => e.category === cat),
  );

  return (
    <aside className="properties" aria-label="Furniture catalog">
      <h2 className="properties-title">Furniture</h2>
      <p className="properties-hint">
        Open a category, pick an item, then click in the plan to place it.{" "}
        <kbd>R</kbd> rotates; wall-huggers snap to nearby walls.
      </p>
      <div className="palette">
        {groups.map((cat) => {
          const open = openCategory === cat;
          return (
            <section key={cat} className="palette-group">
              <button
                type="button"
                className={`palette-group-header${open ? " open" : ""}`}
                aria-expanded={open}
                onClick={() => setOpenPaletteCategory(open ? null : cat)}
              >
                <span className="palette-group-caret" aria-hidden="true">
                  {open ? "▾" : "▸"}
                </span>
                {CATEGORY_LABELS[cat]}
              </button>
              {open && (
                <div className="palette-grid">
                  {CATALOG_ITEMS.filter((e) => e.category === cat)
                    .flatMap(paletteButtons)
                    .map(({ entry, variant, key, label }) => {
                      const active =
                        placingCatalogId === entry.id &&
                        (placingVariant ?? undefined) === variant;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`palette-item${active ? " active" : ""}`}
                          title={label}
                          onClick={() =>
                            setPlacingCatalogId(
                              active ? null : entry.id,
                              variant ?? null,
                            )
                          }
                        >
                          <FurnitureThumb entry={entry} variant={variant} />
                          <span className="palette-name">{label}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

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

// A single dimension control that edits one axis of an item in real-world
// meters: a slider plus an editable number field, kept in sync. Both report
// the resulting size in meters (not the raw multiplier). The slider range is
// the catalog policy (base dimension × min/max multiplier). Typed values are
// converted back to a multiplier and pushed through onChange (which clamps via
// the store's clampScale); the field then snaps to the clamped result because
// it is driven by the live `meters` prop whenever it isn't being edited.
function DimensionSlider({
  label,
  meters,
  base,
  range,
  onChange,
}: {
  label: string;
  meters: number;
  base: number;
  range: [number, number];
  onChange: (multiplier: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const min = base * range[0];
  const max = base * range[1];
  const commit = (raw: string) => {
    const v = Number(raw);
    if (Number.isFinite(v)) onChange(dimensionToMultiplier(v, base));
    setDraft(null); // fall back to the (clamped) live value
  };
  return (
    <label className="field scale-field">
      <span className="field-label">{label}</span>
      <span className="field-input scale-input">
        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={meters}
          onChange={(e) => onChange(dimensionToMultiplier(Number(e.target.value), base))}
        />
        <span className="scale-number">
          <input
            type="number"
            min={min}
            max={max}
            step={0.05}
            value={draft ?? meters.toFixed(2)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commit((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <span className="field-unit">m</span>
        </span>
      </span>
    </label>
  );
}

// Size controls matching the item's scaling policy: a single slider for
// "uniform", one slider per free axis (Width/Depth/Height) for "axes", or a
// fixed-size note for "none". A Reset button restores the catalog size.
function FurnitureScaleControls({
  entry,
  scale,
  onScale,
  onReset,
}: {
  entry: CatalogEntry;
  scale: Vec3;
  onScale: (s: Vec3) => void;
  onReset: () => void;
}) {
  const { scaling } = entry;
  const dims = effectiveDimensions(entry, scale);
  const atDefault = scale.x === 1 && scale.y === 1 && scale.z === 1;

  let body: ReactNode;
  if (scaling.mode === "none") {
    body = <p className="properties-hint">This item is a fixed size.</p>;
  } else if (scaling.mode === "uniform") {
    const range = scaling.uniform ?? [1, 1];
    // Uniform: one control driven by width; all axes scale together.
    body = (
      <DimensionSlider
        label="Size"
        meters={dims.width}
        base={entry.footprint.width}
        range={range}
        onChange={(m) => onScale({ x: m, y: m, z: m })}
      />
    );
  } else {
    const ax = scaling.axes ?? {};
    body = (
      <>
        {ax.x && (
          <DimensionSlider
            label="Width"
            meters={dims.width}
            base={entry.footprint.width}
            range={ax.x}
            onChange={(m) => onScale({ ...scale, x: m })}
          />
        )}
        {ax.z && (
          <DimensionSlider
            label="Depth"
            meters={dims.depth}
            base={entry.footprint.depth}
            range={ax.z}
            onChange={(m) => onScale({ ...scale, z: m })}
          />
        )}
        {ax.y && (
          <DimensionSlider
            label="Height"
            meters={dims.height}
            base={entry.height}
            range={ax.y}
            onChange={(m) => onScale({ ...scale, y: m })}
          />
        )}
      </>
    );
  }

  return (
    <>
      <h3 className="properties-subhead">Size</h3>
      <div className="properties-fields">{body}</div>
      {scaling.mode !== "none" && (
        <button
          type="button"
          className="link-button reset-link"
          onClick={onReset}
          disabled={atDefault}
        >
          Reset size
        </button>
      )}
    </>
  );
}

export function PropertiesPanel() {
  const activeTool = useStore((s) => s.activeTool);
  const selection = useStore((s) => s.selection);
  const level = useStore(selectCurrentLevel);
  const updateWall = useStore((s) => s.updateWall);
  const deleteWall = useStore((s) => s.deleteWall);
  const copyWallsToAbove = useStore((s) => s.copyWallsToAbove);
  const updateWindow = useStore((s) => s.updateWindow);
  const deleteWindow = useStore((s) => s.deleteWindow);
  const updateDoor = useStore((s) => s.updateDoor);
  const deleteDoor = useStore((s) => s.deleteDoor);
  const setDoorMaterial = useStore((s) => s.setDoorMaterial);
  const updateWallMount = useStore((s) => s.updateWallMount);
  const setWallMountMaterial = useStore((s) => s.setWallMountMaterial);
  const setWallMountScale = useStore((s) => s.setWallMountScale);
  const deleteWallMount = useStore((s) => s.deleteWallMount);
  const paintWallSide = useStore((s) => s.paintWallSide);
  const setFloorMaterial = useStore((s) => s.setFloorMaterial);
  const deleteFloor = useStore((s) => s.deleteFloor);
  const updateFurniture = useStore((s) => s.updateFurniture);
  const setFurnitureMaterial = useStore((s) => s.setFurnitureMaterial);
  const resetFurnitureMaterials = useStore((s) => s.resetFurnitureMaterials);
  const setFurnitureScale = useStore((s) => s.setFurnitureScale);
  const resetFurnitureScale = useStore((s) => s.resetFurnitureScale);
  const deleteFurniture = useStore((s) => s.deleteFurniture);
  const updateStaircase = useStore((s) => s.updateStaircase);
  const deleteStaircase = useStore((s) => s.deleteStaircase);
  const updateRoof = useStore((s) => s.updateRoof);
  const deleteRoof = useStore((s) => s.deleteRoof);
  const moveRoofToLevel = useStore((s) => s.moveRoofToLevel);
  const levels = useStore((s) => s.design.levels);
  const currentLevelId = useStore((s) => s.currentLevelId);
  const updateCeilingLight = useStore((s) => s.updateCeilingLight);
  const setCeilingLightMaterial = useStore((s) => s.setCeilingLightMaterial);
  const setCeilingLightScale = useStore((s) => s.setCeilingLightScale);
  const deleteCeilingLight = useStore((s) => s.deleteCeilingLight);
  const setSideHighlight = useStore((s) => s.setSideHighlight);

  const [edit, setEdit] = useState<EditTarget | null>(null);
  const selectionKey = selection ? JSON.stringify(selection) : "none";
  useEffect(() => {
    setEdit(null);
    return () => setSideHighlight(null);
  }, [selectionKey, activeTool, setSideHighlight]);

  if (activeTool === "furniture") {
    return <FurniturePalette />;
  }

  if (activeTool === "paint" || activeTool === "floor") {
    return <ToolMaterialPanel tool={activeTool} />;
  }

  if (activeTool === "wall" || activeTool === "room") {
    return <WallToolPanel />;
  }

  if (activeTool === "fill") {
    return <FillRoomPanel />;
  }

  // --- furniture selected ---
  if (selection?.kind === "furniture") {
    const item = level.furniture.find((f) => f.id === selection.id);
    const entry = item ? getCatalogEntry(item.catalogId) : undefined;
    if (!item || !entry)
      return <aside className="properties">{EMPTY_TIPS}</aside>;

    if (edit?.kind === "furnSlot") {
      const slot = edit.slot;
      const slotDef = entry.slots.find((s) => s.name === slot)!;
      const value = item.materials[slot] ?? slotDef.default;
      return (
        <aside className="properties" aria-label="Furniture material">
          <PickerHeader title={titleCase(slot)} onDone={() => setEdit(null)} />
          <MaterialPicker
            value={value}
            onChange={(m) => setFurnitureMaterial(item.id, slot, m)}
          />
        </aside>
      );
    }

    return (
      <aside className="properties" aria-label="Furniture">
        <h2 className="properties-title">{entry.name}</h2>
        <div className="properties-fields">
          <NumberField
            label="X"
            value={item.position.x}
            min={-1e6}
            step={0.1}
            onCommit={(v) =>
              updateFurniture(item.id, {
                position: { x: v, y: item.position.y },
              })
            }
          />
          <NumberField
            label="Y"
            value={item.position.y}
            min={-1e6}
            step={0.1}
            onCommit={(v) =>
              updateFurniture(item.id, {
                position: { x: item.position.x, y: v },
              })
            }
          />
          <label className="field">
            <span className="field-label">Rotation</span>
            <span className="field-input">
              <input
                type="number"
                step={15}
                value={Math.round(item.rotation)}
                onChange={(e) => {
                  const deg = Number(e.target.value);
                  if (Number.isFinite(deg)) {
                    const snapped =
                      (((Math.round(deg / 15) * 15) % 360) + 360) % 360;
                    updateFurniture(item.id, { rotation: snapped });
                  }
                }}
              />
              <span className="field-unit">°</span>
            </span>
          </label>
        </div>
        {entry.variants && entry.variants.length > 1 && (
          <>
            <h3 className="properties-subhead">Variant</h3>
            <div className="chip-row chip-wrap">
              {entry.variants.map((v) => {
                const current = resolveVariantId(entry, item.variant);
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`seg-button${current === v.id ? " active" : ""}`}
                    onClick={() => updateFurniture(item.id, { variant: v.id })}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <FurnitureScaleControls
          entry={entry}
          scale={item.scale}
          onScale={(s) => setFurnitureScale(item.id, s)}
          onReset={() => resetFurnitureScale(item.id)}
        />
        <h3 className="properties-subhead">Materials</h3>
        <div className="chip-row chip-wrap">
          {entry.slots.map((s) => (
            <MaterialChip
              key={s.name}
              material={item.materials[s.name] ?? s.default}
              label={titleCase(s.name)}
              onClick={() =>
                setEdit({ kind: "furnSlot", id: item.id, slot: s.name })
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="link-button reset-link"
          onClick={() => resetFurnitureMaterials(item.id)}
        >
          Reset to default materials
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteFurniture(item.id)}
        >
          Delete item
        </button>
      </aside>
    );
  }

  // --- staircase selected ---
  if (selection?.kind === "staircase") {
    const stair = level.staircases.find((s) => s.id === selection.id);
    if (!stair) return <aside className="properties">{EMPTY_TIPS}</aside>;

    if (edit?.kind === "stairMat") {
      return (
        <aside className="properties" aria-label="Staircase material">
          <PickerHeader title="Stair material" onDone={() => setEdit(null)} />
          <MaterialPicker
            value={stair.material}
            onChange={(m) => updateStaircase(stair.id, { material: m })}
          />
        </aside>
      );
    }

    return (
      <aside className="properties" aria-label="Staircase">
        <h2 className="properties-title">Staircase</h2>
        <p className="properties-hint">Ascends to the floor above.</p>
        <div className="properties-fields">
          <NumberField
            label="Width"
            value={stair.width}
            min={0.5}
            step={0.1}
            onCommit={(v) => updateStaircase(stair.id, { width: v })}
          />
          <label className="field">
            <span className="field-label">Rotation</span>
            <span className="field-input">
              <input
                type="number"
                step={15}
                value={Math.round(stair.rotation)}
                onChange={(e) => {
                  const deg = Number(e.target.value);
                  if (Number.isFinite(deg)) {
                    const snapped =
                      (((Math.round(deg / 15) * 15) % 360) + 360) % 360;
                    updateStaircase(stair.id, { rotation: snapped });
                  }
                }}
              />
              <span className="field-unit">°</span>
            </span>
          </label>
          <NumberField
            label="X"
            value={stair.position.x}
            min={-1e6}
            step={0.1}
            onCommit={(v) =>
              updateStaircase(stair.id, {
                position: { x: v, y: stair.position.y },
              })
            }
          />
          <NumberField
            label="Y"
            value={stair.position.y}
            min={-1e6}
            step={0.1}
            onCommit={(v) =>
              updateStaircase(stair.id, {
                position: { x: stair.position.x, y: v },
              })
            }
          />
        </div>
        <h3 className="properties-subhead">Material</h3>
        <div className="chip-row">
          <MaterialChip
            material={stair.material}
            label="Steps"
            onClick={() => setEdit({ kind: "stairMat", id: stair.id })}
          />
        </div>
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteStaircase(stair.id)}
        >
          Delete staircase
        </button>
      </aside>
    );
  }

  // --- ceiling light selected ---
  if (selection?.kind === "ceilingLight") {
    const light = level.ceilingLights.find((l) => l.id === selection.id);
    const entry = light ? getCatalogEntry(light.catalogId) : undefined;
    if (!light || !entry)
      return <aside className="properties">{EMPTY_TIPS}</aside>;

    if (edit?.kind === "lightMat") {
      const slot = edit.slot;
      const slotDef = entry.slots.find((s) => s.name === slot)!;
      const value = light.materials[slot] ?? slotDef.default;
      return (
        <aside className="properties" aria-label="Ceiling light material">
          <PickerHeader title={titleCase(slot)} onDone={() => setEdit(null)} />
          <MaterialPicker
            value={value}
            onChange={(m) => setCeilingLightMaterial(light.id, slot, m)}
          />
        </aside>
      );
    }

    return (
      <aside className="properties" aria-label="Ceiling light">
        <h2 className="properties-title">{entry.name}</h2>
        <p className="properties-hint">Hangs from this level's ceiling.</p>
        <div className="properties-fields">
          <NumberField
            label="X"
            value={light.position.x}
            min={-1e6}
            step={0.1}
            onCommit={(v) =>
              updateCeilingLight(light.id, {
                position: { x: v, y: light.position.y },
              })
            }
          />
          <NumberField
            label="Y"
            value={light.position.y}
            min={-1e6}
            step={0.1}
            onCommit={(v) =>
              updateCeilingLight(light.id, {
                position: { x: light.position.x, y: v },
              })
            }
          />
          <NumberField
            label="Drop"
            value={light.drop}
            min={0}
            step={0.1}
            onCommit={(v) => updateCeilingLight(light.id, { drop: v })}
          />
        </div>
        <FurnitureScaleControls
          entry={entry}
          scale={light.scale}
          onScale={(s) => setCeilingLightScale(light.id, s)}
          onReset={() => setCeilingLightScale(light.id, { x: 1, y: 1, z: 1 })}
        />
        <h3 className="properties-subhead">Materials</h3>
        <div className="chip-row chip-wrap">
          {entry.slots.map((s) => (
            <MaterialChip
              key={s.name}
              material={light.materials[s.name] ?? s.default}
              label={titleCase(s.name)}
              onClick={() =>
                setEdit({ kind: "lightMat", id: light.id, slot: s.name })
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteCeilingLight(light.id)}
        >
          Delete light
        </button>
      </aside>
    );
  }

  // --- roof selected ---
  if (selection?.kind === "roof") {
    const roof = level.roofs.find((r) => r.id === selection.id);
    if (!roof) return <aside className="properties">{EMPTY_TIPS}</aside>;

    if (edit?.kind === "roofMat") {
      return (
        <aside className="properties" aria-label="Roof material">
          <PickerHeader title="Roof material" onDone={() => setEdit(null)} />
          <MaterialPicker
            value={roof.material}
            onChange={(m) => updateRoof(roof.id, { material: m })}
          />
        </aside>
      );
    }

    return (
      <aside className="properties" aria-label="Roof">
        <h2 className="properties-title">Roof</h2>
        <div className="properties-fields">
          <NumberField
            label="Width"
            value={roof.width}
            min={0.1}
            step={0.1}
            onCommit={(v) => updateRoof(roof.id, { width: v })}
          />
          <NumberField
            label="Depth"
            value={roof.depth}
            min={0.1}
            step={0.1}
            onCommit={(v) => updateRoof(roof.id, { depth: v })}
          />
          <label className="field">
            <span className="field-label">Rotation</span>
            <span className="field-input">
              <input
                type="number"
                step={15}
                value={Math.round(roof.rotation)}
                onChange={(e) => {
                  const deg = Number(e.target.value);
                  if (Number.isFinite(deg)) {
                    const snapped =
                      (((Math.round(deg / 15) * 15) % 360) + 360) % 360;
                    updateRoof(roof.id, { rotation: snapped });
                  }
                }}
              />
              <span className="field-unit">°</span>
            </span>
          </label>
        </div>

        <h3 className="properties-subhead">Type</h3>
        <div className="seg roof-types" role="group" aria-label="Roof type">
          {ROOF_TYPES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className={`seg-button${roof.type === type ? " active" : ""}`}
              aria-pressed={roof.type === type}
              onClick={() => updateRoof(roof.id, { type })}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="roof-slider">
          <span>Pitch {Math.round(roof.pitch)}°</span>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={roof.pitch}
            disabled={roof.type === "flat"}
            onChange={(e) => updateRoof(roof.id, { pitch: Number(e.target.value) })}
          />
        </label>

        <label className="roof-slider">
          <span>Overhang {roof.overhang.toFixed(2)} m</span>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={roof.overhang}
            onChange={(e) =>
              updateRoof(roof.id, { overhang: Number(e.target.value) })
            }
          />
        </label>

        <label className="roof-visible">
          <input
            type="checkbox"
            checked={roof.visible}
            onChange={(e) => updateRoof(roof.id, { visible: e.target.checked })}
          />
          Show this roof
        </label>

        <h3 className="properties-subhead">Material</h3>
        <div className="chip-row">
          <MaterialChip
            material={roof.material}
            label="Roof"
            onClick={() => setEdit({ kind: "roofMat", id: roof.id })}
          />
        </div>
        {levels.length > 1 && (
          <>
            <h3 className="properties-subhead">Floor</h3>
            <label className="field">
              <span className="field-label">On floor</span>
              <span className="field-input">
                <select
                  className="field-select"
                  value={currentLevelId}
                  onChange={(e) => moveRoofToLevel(roof.id, e.target.value)}
                >
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </>
        )}
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteRoof(roof.id)}
        >
          Delete roof
        </button>
      </aside>
    );
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
          className="link-button reset-link"
          onClick={() => copyWallsToAbove([wall.id])}
        >
          Copy wall to floor above
        </button>
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
          label="Style"
          value={door.style}
          options={[
            { value: "single", label: "Single" },
            { value: "double", label: "Double" },
            { value: "sliding", label: "Sliding" },
          ]}
          onChange={(v) => updateDoor(wall.id, door.id, { style: v })}
        />
        {/* Hinge & swing only apply to swinging doors (single/double). */}
        {door.style !== "sliding" && (
          <>
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
          </>
        )}
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

  // --- wall mount selected ---
  if (selection?.kind === "wallMount") {
    const wall = level.walls.find((w) => w.id === selection.wallId);
    const mount = wall?.mounts.find((m) => m.id === selection.id);
    const entry = mount ? getCatalogEntry(mount.catalogId) : undefined;
    if (!wall || !mount || !entry)
      return <aside className="properties">{EMPTY_TIPS}</aside>;
    const L = wallLength(wall);

    if (edit?.kind === "mountMat") {
      const slot = edit.slot;
      const slotDef = entry.slots.find((s) => s.name === slot)!;
      const value = mount.materials[slot] ?? slotDef.default;
      return (
        <aside className="properties" aria-label="Wall mount material">
          <PickerHeader title={titleCase(slot)} onDone={() => setEdit(null)} />
          <MaterialPicker
            value={value}
            onChange={(m) => setWallMountMaterial(wall.id, mount.id, slot, m)}
          />
        </aside>
      );
    }

    // Keep the center strictly inside the wall ends.
    const setAlong = (meters: number) => {
      const t = L > 0 ? Math.min(0.999, Math.max(0.001, meters / L)) : 0.5;
      updateWallMount(wall.id, mount.id, { t });
    };

    return (
      <aside className="properties" aria-label="Wall mount">
        <h2 className="properties-title">{entry.name}</h2>
        <p className="properties-hint">Mounted on the wall; moves with it.</p>
        <div className="properties-fields">
          <NumberField
            label="Position"
            value={mount.t * L}
            min={0}
            step={0.1}
            onCommit={setAlong}
          />
          <NumberField
            label="Height"
            value={mount.heightUpWall}
            min={0}
            step={0.1}
            onCommit={(v) =>
              updateWallMount(wall.id, mount.id, { heightUpWall: v })
            }
          />
        </div>
        <ToggleField
          label="Face"
          value={mount.face}
          options={[
            { value: "A", label: "Side A" },
            { value: "B", label: "Side B" },
          ]}
          onChange={(v) => updateWallMount(wall.id, mount.id, { face: v })}
        />
        <FurnitureScaleControls
          entry={entry}
          scale={mount.scale}
          onScale={(s) => setWallMountScale(wall.id, mount.id, s)}
          onReset={() =>
            setWallMountScale(wall.id, mount.id, { x: 1, y: 1, z: 1 })
          }
        />
        <h3 className="properties-subhead">Materials</h3>
        <div className="chip-row chip-wrap">
          {entry.slots.map((s) => (
            <MaterialChip
              key={s.name}
              material={mount.materials[s.name] ?? s.default}
              label={titleCase(s.name)}
              onClick={() =>
                setEdit({
                  kind: "mountMat",
                  wallId: wall.id,
                  id: mount.id,
                  slot: s.name,
                })
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="danger-button"
          onClick={() => deleteWallMount(wall.id, mount.id)}
        >
          Delete item
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
