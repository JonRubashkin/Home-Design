import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// The design library (IndexedDB) is loaded asynchronously by the welcome screen,
// which also migrates any legacy localStorage autosave into the library on first
// run. The editor stays hidden until the user opens or creates a design.

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
