import { Analytics } from "@vercel/analytics/react";
import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { PlanEditor } from "./components/PlanEditor";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Preview3D } from "./components/preview/Preview3D";
import { CatalogQA } from "./components/preview/CatalogQA";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useAutosave } from "./hooks/useAutosave";
import { useStore } from "./store/store";

export default function App() {
  useGlobalShortcuts();
  useAutosave();

  const started = useStore((s) => s.started);
  const layout = useStore((s) => s.layout);
  const showPlan = layout !== "3d";
  const showPreview = layout !== "plan";
  // The 2D editing chrome (toolbar + properties) is only useful when the plan
  // is visible.
  const showEditingChrome = showPlan;

  // Dev-only catalog QA view, opened with #catalog in the URL.
  if (typeof window !== "undefined" && window.location.hash === "#catalog") {
    return (
      <>
        <CatalogQA />
        <Analytics />
      </>
    );
  }

  // Welcome screen (size chooser / Continue) before the editor canvas.
  if (!started) {
    return (
      <>
        <WelcomeScreen />
        <Analytics />
      </>
    );
  }

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
      <Analytics />
    </div>
  );
}
