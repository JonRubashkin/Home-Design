import { useStore, type Tool } from "../store/store";

interface ToolDef {
  tool: Tool;
  label: string;
  shortcut: string;
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

const TOOLS: ToolDef[] = [
  { tool: "select", label: "Select", shortcut: "V", icon: SelectIcon },
  { tool: "wall", label: "Wall", shortcut: "W", icon: WallIcon },
];

export function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);

  return (
    <nav className="toolbar" aria-label="Tools">
      {TOOLS.map(({ tool, label, shortcut, icon }) => (
        <button
          key={tool}
          type="button"
          className={`tool-button${activeTool === tool ? " active" : ""}`}
          aria-pressed={activeTool === tool}
          title={`${label} (${shortcut})`}
          onClick={() => setActiveTool(tool)}
        >
          <span className="tool-icon">{icon}</span>
          <span className="tool-label">{label}</span>
          <span className="tool-shortcut">{shortcut}</span>
        </button>
      ))}
    </nav>
  );
}
