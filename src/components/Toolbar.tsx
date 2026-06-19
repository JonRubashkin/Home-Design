import { useStore, type Tool } from "../store/store";

interface ToolDef {
  tool: Tool;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
}

const SelectIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M5 3l14 7-6 1.5L10 18z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

const WallIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="3" y="6" width="18" height="5" rx="1" fill="currentColor" />
    <rect x="3" y="13" width="18" height="5" rx="1" fill="currentColor" />
  </svg>
);

const WindowIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect
      x="4"
      y="4"
      width="16"
      height="16"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const DoorIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect
      x="5"
      y="3"
      width="11"
      height="18"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M16 3a10 10 0 0 1 4 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeDasharray="2 2"
    />
    <circle cx="12.5" cy="12" r="1.1" fill="currentColor" />
  </svg>
);

const FloorIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M3 8l9-4 9 4-9 4z" fill="currentColor" opacity="0.55" />
    <path
      d="M3 8l9 4 9-4v8l-9 4-9-4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const PaintIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="5" y="3" width="12" height="8" rx="1.5" fill="currentColor" />
    <path
      d="M17 7h2.5a1.5 1.5 0 0 1 1.5 1.5V12a2 2 0 0 1-2 2h-6v3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect x="10.5" y="16" width="3" height="5" rx="1" fill="currentColor" />
  </svg>
);

const FillIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M5 11 11 5l7 7-6 6z"
      fill="currentColor"
      opacity="0.55"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M11 5 9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M19 16c0 1.6 1.2 2.6 1.2 2.6S21 17.6 21 16a1.1 1.1 0 0 0-2 0z" fill="currentColor" />
  </svg>
);

const StairIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M4 20h4v-4h4v-4h4V8h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

const RoofIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M3 12 12 5l9 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path
      d="M5 11v7h14v-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const FurnitureIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect x="3" y="11" width="18" height="6" rx="1.5" fill="currentColor" />
    <path d="M5 17v2M19 17v2" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

// The Wall button covers both wall sub-modes (Draw walls / Room); the sub-mode
// is chosen in the properties panel. Floor sits just below Stair.
const TOOLS: ToolDef[] = [
  { tool: "select", label: "Select", shortcut: "V", icon: SelectIcon },
  { tool: "wall", label: "Wall", shortcut: "W", icon: WallIcon },
  { tool: "window", label: "Window", shortcut: "N", icon: WindowIcon },
  { tool: "door", label: "Door", shortcut: "D", icon: DoorIcon },
  { tool: "stair", label: "Stair", shortcut: "S", icon: StairIcon },
  { tool: "roof", label: "Roof", shortcut: "O", icon: RoofIcon },
  { tool: "floor", label: "Floor", shortcut: "F", icon: FloorIcon },
  { tool: "paint", label: "Paint", shortcut: "P", icon: PaintIcon },
  { tool: "fill", label: "Fill", shortcut: "G", icon: FillIcon },
  { tool: "furniture", label: "Furniture", shortcut: "U", icon: FurnitureIcon },
];

export function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);

  return (
    <nav className="toolbar" aria-label="Tools">
      {TOOLS.map(({ tool, label, shortcut, icon }) => {
        // The Wall button stays active for both "wall" (draw) and "room" modes.
        const active =
          activeTool === tool || (tool === "wall" && activeTool === "room");
        const onClick = () => {
          if (tool === "wall") {
            if (activeTool !== "wall" && activeTool !== "room")
              setActiveTool("wall");
          } else setActiveTool(tool);
        };
        return (
          <button
            key={tool}
            type="button"
            className={`tool-button${active ? " active" : ""}`}
            aria-pressed={active}
            title={shortcut ? `${label} (${shortcut})` : label}
            onClick={onClick}
          >
            <span className="tool-icon">{icon}</span>
            <span className="tool-label">{label}</span>
            {shortcut && <span className="tool-shortcut">{shortcut}</span>}
          </button>
        );
      })}
    </nav>
  );
}
