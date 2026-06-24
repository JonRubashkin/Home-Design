import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { validateDesign } from "../persistence/storage";
import {
  getDesignRecord,
  listDesigns,
  migrateLegacyAutosave,
  type DesignRecord,
} from "../storage/library";
import { DesignLibrary } from "./DesignLibrary";
import { SiteSizeForm } from "./SiteSizeForm";
import { DESKTOP_RECOMMENDATION, STORAGE_DISCLOSURE } from "../lib/storageDisclosure";

// Shown before the editor on load. Loads the design library (migrating any legacy
// localStorage autosave into it on first run). If saved designs exist, offer the
// recents list with Continue (= most recently modified) and New; otherwise go
// straight to the size chooser. Picking a size creates a new design.
export function WelcomeScreen() {
  const openRecord = useStore((s) => s.openRecord);
  const startNewDesign = useStore((s) => s.startNewDesign);

  const [records, setRecords] = useState<DesignRecord[] | null>(null);
  const [step, setStep] = useState<"choice" | "size">("choice");

  const reload = () => {
    void listDesigns().then(setRecords);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await migrateLegacyAutosave();
      const list = await listDesigns();
      if (cancelled) return;
      setRecords(list);
      // First-timers (no saved designs) skip straight to choosing a work area.
      setStep(list.length > 0 ? "choice" : "size");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onContinue = async () => {
    const list = records ?? (await listDesigns());
    const recent = list[0]; // listDesigns is sorted most-recent-first
    if (!recent) {
      setStep("size");
      return;
    }
    const record = await getDesignRecord(recent.id);
    if (!record) return;
    const result = validateDesign(record.design);
    openRecord(record.id, result.ok ? result.design : record.design);
  };

  const loading = records === null;
  const hasSaved = !loading && records.length > 0;

  return (
    <div className="welcome">
      <div className="welcome-card welcome-wide">
        <div className="welcome-head">
          <h1>Home Design</h1>
          <p className="welcome-sub">Draw walls, furnish rooms, see it in 3D.</p>
        </div>

        {/* Both helper lines show on the genuine entry screen from the very first
            visit (size chooser) as well as for returning users (recents list) —
            never gated behind starting a design. */}
        {!loading && (
          <div className="welcome-notices">
            <p className="welcome-storage-note">{STORAGE_DISCLOSURE}</p>
            <p className="welcome-storage-note">{DESKTOP_RECOMMENDATION}</p>
          </div>
        )}

        {loading ? (
          <p className="welcome-size-hint">Loading your designs…</p>
        ) : step === "size" ? (
          <div className="welcome-size">
            <h2 className="welcome-size-title">Choose your work area</h2>
            <p className="welcome-size-hint">
              The boundary is a soft guide — you can build outside it and resize
              it later.
            </p>
            <SiteSizeForm
              confirmLabel="Create design"
              onConfirm={startNewDesign}
              onCancel={hasSaved ? () => setStep("choice") : undefined}
            />
          </div>
        ) : (
          <div className="welcome-choice-wide">
            {hasSaved && (
              <button
                type="button"
                className="primary-button welcome-continue"
                autoFocus
                onClick={onContinue}
              >
                Continue your most recent design
              </button>
            )}
            <DesignLibrary
              records={records}
              reload={reload}
              onNew={() => setStep("size")}
              mode="welcome"
            />
          </div>
        )}
      </div>
    </div>
  );
}
