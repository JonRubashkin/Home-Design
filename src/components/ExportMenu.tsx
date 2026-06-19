import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import {
  capture3D,
  downloadCanvasPng,
  getCaptureHandles,
  getPlanCapturer,
  safeFileName,
} from "../lib/capture";

// Unified image-export control for the top bar. A single button opens a small
// popover to export the 2D plan, the 3D view, or both — each a 2× PNG via the
// existing capture utilities. A transparent-background toggle applies to the 3D
// image only (the plan always exports on a white ground, as before). Options for
// a pane that isn't currently mounted (per the layout) are disabled.
export function ExportMenu() {
  const designName = useStore((s) => s.design.name);
  const layout = useStore((s) => s.layout);
  const planAvailable = layout !== "3d";
  const threeAvailable = layout !== "plan";

  const [open, setOpen] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const slug = safeFileName(designName);

  const exportPlan = async () => {
    const capturer = getPlanCapturer();
    if (!capturer) return;
    const canvas = await capturer({ scale: 2 });
    if (canvas) downloadCanvasPng(canvas, `${slug}-plan.png`);
  };

  const export3D = () => {
    const handles = getCaptureHandles();
    if (!handles) return;
    const canvas = capture3D(handles, { scale: 2, transparent });
    downloadCanvasPng(canvas, `${slug}-3d.png`);
  };

  const run = async (what: "plan" | "3d" | "both") => {
    if (what === "plan" || what === "both") await exportPlan();
    if (what === "3d" || what === "both") export3D();
    setOpen(false);
  };

  return (
    <div className="export-menu" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Export an image of the plan and/or 3D view"
        onClick={() => setOpen((v) => !v)}
      >
        Export image ▾
      </button>
      {open && (
        <div className="export-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={!planAvailable}
            title={
              planAvailable
                ? "Download a 2× PNG of the plan, framed to content"
                : "Switch to a layout that shows the plan"
            }
            onClick={() => run("plan")}
          >
            2D plan
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!threeAvailable}
            title={
              threeAvailable
                ? "Download a 2× PNG of the current 3D view"
                : "Switch to a layout that shows the 3D view"
            }
            onClick={() => run("3d")}
          >
            3D image
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!planAvailable || !threeAvailable}
            title={
              planAvailable && threeAvailable
                ? "Download both PNGs (plan + 3D)"
                : "Switch to the Split layout to export both"
            }
            onClick={() => run("both")}
          >
            Both
          </button>
          <label
            className="export-transparent"
            title="Export the 3D image with a transparent background"
          >
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            Transparent 3D background
          </label>
        </div>
      )}
    </div>
  );
}
