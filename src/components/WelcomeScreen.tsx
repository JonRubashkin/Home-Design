import { useState } from "react";
import { useStore } from "../store/store";
import { SiteSizeForm } from "./SiteSizeForm";

// Shown before the editor on load. If a saved design exists, offer Continue or a
// fresh start; otherwise go straight to the size chooser. Picking a size creates
// a new design with that work area; Continue resumes the saved one untouched.
export function WelcomeScreen() {
  const hasSavedDesign = useStore((s) => s.hasSavedDesign);
  const continueDesign = useStore((s) => s.continueDesign);
  const startNewDesign = useStore((s) => s.startNewDesign);

  // Returning users see the choice first; first-timers go straight to sizing.
  const [step, setStep] = useState<"choice" | "size">(
    hasSavedDesign ? "choice" : "size",
  );

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-head">
          <h1>Home Design</h1>
          <p className="welcome-sub">Draw walls, furnish rooms, see it in 3D.</p>
        </div>

        {step === "choice" ? (
          <div className="welcome-choice">
            <button
              type="button"
              className="primary-button welcome-continue"
              autoFocus
              onClick={continueDesign}
            >
              Continue your design
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setStep("size")}
            >
              Start a new design
            </button>
          </div>
        ) : (
          <div className="welcome-size">
            <h2 className="welcome-size-title">Choose your work area</h2>
            <p className="welcome-size-hint">
              The boundary is a soft guide — you can build outside it and resize
              it later.
            </p>
            <SiteSizeForm
              confirmLabel="Create design"
              onConfirm={startNewDesign}
              onCancel={hasSavedDesign ? () => setStep("choice") : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
