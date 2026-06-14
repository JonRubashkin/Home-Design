import { useEffect, useRef } from "react";
import { useStore } from "../store/store";
import { saveDesign } from "../persistence/storage";

// Debounced autosave of the Design to localStorage whenever it changes. Held
// off until the user has entered the editor, so the welcome screen never writes
// a placeholder design over a real save.
export function useAutosave(delay = 500): void {
  const design = useStore((s) => s.design);
  const started = useStore((s) => s.started);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!started) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDesign(design), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [design, started, delay]);
}
