import { useStore } from "../../store/store";
import type { ViewMode } from "../../persistence/viewPrefs";

const MODE_LABELS: { mode: ViewMode; label: string; title: string }[] = [
  { mode: "full", label: "Full", title: "Show all walls" },
  {
    mode: "cutaway",
    label: "Cutaway",
    title: "Hide walls between the camera and the interior",
  },
  { mode: "stubs", label: "Stubs", title: "Show walls at 10% height" },
];

export function ViewModeBar({ onFit }: { onFit: () => void }) {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const cutawayStyle = useStore((s) => s.cutawayStyle);
  const setCutawayStyle = useStore((s) => s.setCutawayStyle);

  return (
    <div className="viewbar">
      <div className="seg" role="group" aria-label="Wall view mode">
        {MODE_LABELS.map(({ mode, label, title }) => (
          <button
            key={mode}
            type="button"
            className={`seg-button${viewMode === mode ? " active" : ""}`}
            aria-pressed={viewMode === mode}
            title={title}
            onClick={() => setViewMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      {viewMode === "cutaway" && (
        <div className="seg" role="group" aria-label="Cutaway style">
          <button
            type="button"
            className={`seg-button${cutawayStyle === "invisible" ? " active" : ""}`}
            aria-pressed={cutawayStyle === "invisible"}
            title="Don't render suppressed walls"
            onClick={() => setCutawayStyle("invisible")}
          >
            Invisible
          </button>
          <button
            type="button"
            className={`seg-button${cutawayStyle === "ghost" ? " active" : ""}`}
            aria-pressed={cutawayStyle === "ghost"}
            title="Render suppressed walls faintly"
            onClick={() => setCutawayStyle("ghost")}
          >
            Ghost
          </button>
        </div>
      )}

      <button
        type="button"
        className="viewbar-fit"
        title="Frame the whole design"
        onClick={onFit}
      >
        Fit view
      </button>
    </div>
  );
}
