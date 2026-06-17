import { useEffect, useRef } from "react";
import { useStore } from "../store/store";
import { saveOpenDesign } from "../storage/library";
import { captureView, getCaptureHandles } from "../lib/capture";

// Debounced autosave of the open design to its IndexedDB library record (Phase
// 5b). Held off until the user has entered the editor (`started`) and a record id
// exists. A small 3D thumbnail is refreshed on each save (debounced — never per
// keystroke) when a 3D pane is mounted; otherwise the previous thumbnail is kept.
export function useAutosave(delay = 500): void {
  const design = useStore((s) => s.design);
  const started = useStore((s) => s.started);
  const openDesignId = useStore((s) => s.openDesignId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!started || !openDesignId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const handles = getCaptureHandles();
      const thumbnail = handles
        ? (captureView(handles, { maxSize: 320 }) ?? undefined)
        : undefined;
      void saveOpenDesign(openDesignId, design, thumbnail);
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [design, started, openDesignId, delay]);
}
