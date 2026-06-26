import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useStore } from "./store/store";
import "./index.css";

// The design library (IndexedDB) is loaded asynchronously by the welcome screen,
// which also migrates any legacy localStorage autosave into the library on first
// run. The editor stays hidden until the user opens or creates a design.

// Reboot-on-document-swap. New / Open / Import settle the fresh design into the
// store and bump `bootNonce`; this wrapper keys <App> on it, so each swap fully
// unmounts and remounts the entire editor tree — a clean boot equivalent to a
// page reload. That is how "New" avoids the React #185 infinite-update loop:
// rather than mutating the live, running app into a new design in place (which
// left effects looping against the swap), we rebuild the UI from scratch against
// the already-settled new design — the state the app handles perfectly on first
// load. This component only depends on the `bootNonce` primitive, so it can't
// itself loop. The ErrorBoundary lives ABOVE the key so it persists as the safety
// net across reboots.
//
// main.tsx is the Vite entry module: it intentionally mixes this tiny reboot
// wrapper component with the createRoot() bootstrap below and is never itself
// hot-refreshed, so the Fast-Refresh "move components to their own file" rule
// does not apply — disable it precisely on the component declaration.
// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  const bootNonce = useStore((s) => s.bootNonce);
  return <App key={bootNonce} />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
