import * as THREE from "three";
import type { Bounds } from "../geometry/planview";

// Reusable view-capture utilities (Phase 5 Part A). Render the 3D preview or the
// 2D plan to a PNG at 2× the view size. Used by the export UI and (small) for the
// design-library thumbnails (Part B).

export interface Capture3DHandles {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  size: { width: number; height: number };
}

// A module-level pointer to the live 3D handles (set by the SceneCapture bridge
// each frame). Lets non-Canvas code (e.g. the autosave thumbnail) grab the
// current view without prop-drilling a ref. Null when no 3D pane is mounted.
let _liveHandles: Capture3DHandles | null = null;
export function setCaptureHandles(handles: Capture3DHandles | null): void {
  _liveHandles = handles;
}
export function getCaptureHandles(): Capture3DHandles | null {
  return _liveHandles;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// Render the current scene/camera to an offscreen render target at `scale`× the
// on-screen view size and return a canvas. `transparent` clears alpha to 0 and
// drops the scene background so the PNG has real alpha (no opaque fill). The
// renderer state is restored afterwards (and the on-screen frame repainted).
export function capture3D(
  { gl, scene, camera, size }: Capture3DHandles,
  opts: { scale?: number; transparent?: boolean } = {},
): HTMLCanvasElement {
  const scale = opts.scale ?? 2;
  const w = Math.max(1, Math.round(size.width * scale));
  const h = Math.max(1, Math.round(size.height * scale));

  const target = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  // Match the on-screen sRGB output so the PNG colors look identical.
  target.texture.colorSpace = THREE.SRGBColorSpace;

  const prevTarget = gl.getRenderTarget();
  const prevAlpha = gl.getClearAlpha();
  const prevBg = scene.background;
  try {
    if (opts.transparent) {
      scene.background = null;
      gl.setClearAlpha(0);
    }
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
    const buffer = new Uint8Array(w * h * 4);
    gl.readRenderTargetPixels(target, 0, 0, w, h, buffer);
    return bufferToCanvas(buffer, w, h);
  } finally {
    gl.setRenderTarget(prevTarget);
    gl.setClearAlpha(prevAlpha);
    scene.background = prevBg;
    // Repaint the on-screen frame (the read above left the offscreen target bound).
    gl.render(scene, camera);
    target.dispose();
  }
}

// WebGL reads pixels bottom-up; flip the rows into a top-left canvas.
function bufferToCanvas(
  buffer: Uint8Array,
  w: number,
  h: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const row = w * 4;
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * row;
    img.data.set(buffer.subarray(src, src + row), y * row);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// A small (thumbnail-sized) 3D capture as a PNG data URL — reused by the design
// library to store a preview of each saved design. Returns null on failure.
export function captureView(
  handles: Capture3DHandles,
  opts: { maxSize?: number; transparent?: boolean } = {},
): string | null {
  try {
    const maxSize = opts.maxSize ?? 320;
    const { width, height } = handles.size;
    if (width === 0 || height === 0) return null;
    const scale = Math.min(maxSize / width, maxSize / height, 1);
    const canvas = capture3D(handles, {
      scale: Math.max(scale, 0.1),
      transparent: opts.transparent ?? false,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// Frame the design content (the union bounds passed in) and rasterize the plan's
// live SVG content to a canvas at `scale`× a sensible pixel density. The content
// group is cloned (reusing the on-screen rendering); its pan/zoom transform is
// dropped and the viewBox is set to the world-space bounds + a margin so the
// result is framed exactly like Fit view. Screen-space dimming is stripped.
export async function capturePlan(
  svg: SVGSVGElement,
  bounds: Bounds,
  opts: { scale?: number; transparent?: boolean } = {},
): Promise<HTMLCanvasElement> {
  const scale = opts.scale ?? 2;
  const margin = 0.04;
  const bw = Math.max(bounds.maxX - bounds.minX, 0.001);
  const bh = Math.max(bounds.maxY - bounds.minY, 0.001);
  const mx = bw * margin;
  const my = bh * margin;
  const vbX = bounds.minX - mx;
  const vbY = bounds.minY - my;
  const vbW = bw + 2 * mx;
  const vbH = bh + 2 * my;

  // Pixels per meter chosen so the longer side is ~1100px before the 2× factor.
  const ppm = clamp(1100 / Math.max(vbW, vbH), 20, 300);
  const wPx = Math.max(1, Math.round(vbW * ppm * scale));
  const hPx = Math.max(1, Math.round(vbH * ppm * scale));

  const NS = "http://www.w3.org/2000/svg";
  const out = document.createElementNS(NS, "svg");
  out.setAttribute("xmlns", NS);
  out.setAttribute("width", String(wPx));
  out.setAttribute("height", String(hPx));
  out.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);

  // Reuse the live defs (pattern fills) so floors/walls render as on screen.
  const defs = svg.querySelector("defs");
  if (defs) out.appendChild(defs.cloneNode(true));

  if (!opts.transparent) {
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("x", String(vbX));
    bg.setAttribute("y", String(vbY));
    bg.setAttribute("width", String(vbW));
    bg.setAttribute("height", String(vbH));
    bg.setAttribute("fill", "#ffffff");
    out.appendChild(bg);
  }

  const content = svg.querySelector("[data-plan-content]");
  if (content) {
    const clone = content.cloneNode(true) as SVGGElement;
    clone.removeAttribute("transform");
    // The site "dim outside" path is computed in screen space; drop it.
    clone.querySelectorAll(".site-dim").forEach((n) => n.remove());
    out.appendChild(clone);
  }

  const xml = new XMLSerializer().serializeToString(out);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const image = await loadImage(url);

  const canvas = document.createElement("canvas");
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, wPx, hPx);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not rasterize the plan SVG."));
    img.src = src;
  });
}

// Trigger a browser download of a canvas as a PNG file.
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// A filesystem-safe slug for a design name (shared with JSON export naming).
export function safeFileName(name: string, fallback = "design"): string {
  const slug = (name || fallback)
    .trim()
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || fallback;
}
