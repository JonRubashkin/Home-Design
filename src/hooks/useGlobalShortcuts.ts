import { useEffect } from "react";
import { useStore } from "../store/store";

// True when the user is typing into a form field — suppress editor shortcuts.
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

// App-wide keyboard shortcuts: tool switching, undo/redo, delete selection.
// (Esc/Enter/Space for drawing and panning are handled inside the plan editor.)
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = useStore.getState();

      // Undo / redo work even while a field is focused.
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }

      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case "v":
        case "V":
          s.setActiveTool("select");
          break;
        case "w":
        case "W":
          s.setActiveTool("wall");
          break;
        case "Delete":
        case "Backspace":
          if (s.selection) {
            e.preventDefault();
            s.deleteWall(s.selection.id);
          }
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
