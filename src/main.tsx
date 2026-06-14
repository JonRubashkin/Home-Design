import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useStore } from "./store/store";
import { loadDesign } from "./persistence/storage";

// Restore the autosaved design (if any) before the first render. Done directly
// on the store — restoring is not an undoable action. The welcome screen reads
// `hasSavedDesign` to offer Continue vs. a fresh start; the editor stays hidden
// until the user picks one (`started`).
const saved = loadDesign();
useStore.setState({ hasSavedDesign: !!saved });
if (saved) {
  useStore.setState({
    design: saved,
    currentLevelId: saved.levels[0]!.id,
    selection: null,
    past: [],
    future: [],
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
