import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { PlanEditor } from "./components/PlanEditor";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useAutosave } from "./hooks/useAutosave";

export default function App() {
  useGlobalShortcuts();
  useAutosave();

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <Toolbar />
        <PlanEditor />
        <PropertiesPanel />
      </div>
    </div>
  );
}
