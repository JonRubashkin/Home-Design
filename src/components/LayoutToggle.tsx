import { useStore } from "../store/store";
import type { Layout } from "../persistence/viewPrefs";

const LAYOUTS: { layout: Layout; label: string; title: string }[] = [
  { layout: "plan", label: "Plan", title: "2D plan only" },
  { layout: "split", label: "Split", title: "Plan and 3D side by side" },
  { layout: "3d", label: "3D", title: "3D preview only" },
];

export function LayoutToggle() {
  const layout = useStore((s) => s.layout);
  const setLayout = useStore((s) => s.setLayout);

  return (
    <div className="seg" role="group" aria-label="Layout">
      {LAYOUTS.map(({ layout: value, label, title }) => (
        <button
          key={value}
          type="button"
          className={`seg-button${layout === value ? " active" : ""}`}
          aria-pressed={layout === value}
          title={title}
          onClick={() => setLayout(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
