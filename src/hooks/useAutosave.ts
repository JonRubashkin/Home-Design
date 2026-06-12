import { useEffect, useRef } from "react";
import { useStore } from "../store/store";
import { saveDesign } from "../persistence/storage";

// Debounced autosave of the Design to localStorage whenever it changes.
export function useAutosave(delay = 500): void {
  const design = useStore((s) => s.design);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDesign(design), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [design, delay]);
}
