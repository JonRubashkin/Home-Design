import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { PlanEditor } from "./components/PlanEditor";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Preview3D } from "./components/preview/Preview3D";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useAutosave } from "./hooks/useAutosave";
import { useStore } from "./store/store";

export default function App() {
  useGlobalShortcuts();
  useAutosave();

  const layout = useStore((s) => s.layout);
  const showPlan = layout !== "3d";
  const showPreview = layout !== "plan";
  // The 2D editing chrome (toolbar + properties) is only useful when the plan
  // is visible.
  const showEditingChrome = showPlan;

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        {showEditingChrome && <Toolbar />}
        <div className="panes">
          {showPlan && <PlanEditor />}
          {showPreview && <Preview3D />}
        </div>
        {showEditingChrome && <PropertiesPanel />}
      </div>
    </div>
  );
}
