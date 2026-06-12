import { useEffect, useRef, useState } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import type { Vec2, Wall } from "../model/types";
import { ENDPOINT_SNAP_RADIUS } from "../model/defaults";
import { add, scale as vscale, distance } from "../geometry/vec";
import { snapToGrid, constrainAngle } from "../geometry/snap";
import {
  wallNormal,
  hitTestWall,
  nearestEndpoint,
  wallLength,
} from "../geometry/wall";
import { useElementSize } from "../lib/useElementSize";
import { formatMeters } from "../lib/format";

interface View {
  pan: Vec2; // screen px offset of plan origin
  scale: number; // pixels per meter
}

const MIN_SCALE = 4;
const MAX_SCALE = 600;
const HANDLE_RADIUS_PX = 6;
const HANDLE_HIT_PX = 10;
const WALL_HIT_TOL_PX = 5;
const DRAG_THRESHOLD_PX = 4;

type DragState =
  | { kind: "none" }
  | { kind: "pan"; pointerId: number; startScreen: Vec2; startPan: Vec2 }
  | {
      kind: "body";
      pointerId: number;
      wallId: string;
      startScreen: Vec2;
      startWorld: Vec2;
      baseStart: Vec2;
      baseEnd: Vec2;
      started: boolean;
    }
  | {
      kind: "endpoint";
      pointerId: number;
      wallId: string;
      which: "start" | "end";
      startScreen: Vec2;
      started: boolean;
    };

// Pixel spacing thresholds for which grid tiers to draw.
const GRID_TIERS: { spacing: number; className: string }[] = [
  { spacing: 0.1, className: "grid-minor" },
  { spacing: 1, className: "grid-major" },
  { spacing: 10, className: "grid-coarse" },
];

function wallCorners(wall: Wall): Vec2[] {
  const n = wallNormal(wall);
  const h = wall.thickness / 2;
  const off = vscale(n, h);
  return [
    add(wall.start, off),
    add(wall.end, off),
    add(wall.end, vscale(off, -1)),
    add(wall.start, vscale(off, -1)),
  ];
}

export function PlanEditor() {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);

  const level = useStore(selectCurrentLevel);
  const activeTool = useStore((s) => s.activeTool);
  const selection = useStore((s) => s.selection);

  const [view, setView] = useState<View>({
    pan: { x: 160, y: 160 },
    scale: 60,
  });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Wall-drawing state.
  const [chainStart, setChainStart] = useState<Vec2 | null>(null);
  const [preview, setPreview] = useState<{ pt: Vec2; snapped: boolean } | null>(
    null,
  );

  const dragRef = useRef<DragState>({ kind: "none" });
  const shiftRef = useRef(false);
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const walls = level.walls;
  const selectedWall = selection
    ? walls.find((w) => w.id === selection.id)
    : undefined;

  // --- coordinate transforms ---
  const worldToScreen = (p: Vec2): Vec2 => ({
    x: p.x * view.scale + view.pan.x,
    y: p.y * view.scale + view.pan.y,
  });

  const clientToWorld = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - view.pan.x) / view.scale,
      y: (sy - view.pan.y) / view.scale,
    };
  };

  const clientToScreen = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Resolve the point a draw click/preview should use: optional angle
  // constraint, then endpoint snap (priority), else grid snap.
  const resolveDrawPoint = (
    raw: Vec2,
    fromChain: Vec2 | null,
    excludeId?: string,
  ): { pt: Vec2; snapped: boolean } => {
    let p = raw;
    if (shiftRef.current && fromChain) p = constrainAngle(fromChain, p);
    const candidates = excludeId
      ? walls.filter((w) => w.id !== excludeId)
      : walls;
    const ep = nearestEndpoint(p, candidates, ENDPOINT_SNAP_RADIUS);
    if (ep) return { pt: ep, snapped: true };
    return { pt: snapToGrid(p), snapped: false };
  };

  // --- wheel zoom centered on cursor (native non-passive listener) ---
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldX = (sx - v.pan.x) / v.scale;
      const worldY = (sy - v.pan.y) / v.scale;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, v.scale * factor),
      );
      const newPan = {
        x: sx - worldX * newScale,
        y: sy - worldY * newScale,
      };
      setView({ pan: newPan, scale: newScale });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // --- keyboard: space (pan), shift (constrain), esc/enter (drawing) ---
  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
      if (isTyping(e.target)) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!spaceRef.current) {
          spaceRef.current = true;
          setSpaceHeld(true);
        }
      } else if (e.key === "Escape") {
        setChainStart(null);
        setPreview(null);
      } else if (e.key === "Enter") {
        setChainStart(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = false;
      if (e.key === " ") {
        spaceRef.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // --- pointer handlers ---
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return; // ignore right-click
    const store = useStore.getState();
    const screen = clientToScreen(e.clientX, e.clientY);

    // Pan: space-drag or middle button.
    if (spaceRef.current || e.button === 1) {
      dragRef.current = {
        kind: "pan",
        pointerId: e.pointerId,
        startScreen: screen,
        startPan: { ...view.pan },
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const world = clientToWorld(e.clientX, e.clientY);

    if (activeTool === "wall") {
      const { pt } = resolveDrawPoint(world, chainStart);
      if (chainStart === null) {
        setChainStart(pt);
      } else {
        if (distance(chainStart, pt) > 1e-6) store.addWall(chainStart, pt);
        setChainStart(pt);
      }
      setPreview({ pt, snapped: false });
      return;
    }

    // Select tool.
    const tolWall = WALL_HIT_TOL_PX / view.scale;
    const tolHandle = HANDLE_HIT_PX / view.scale;

    // Endpoint handles of the selected wall take priority.
    if (selectedWall) {
      if (distance(world, selectedWall.start) <= tolHandle) {
        dragRef.current = {
          kind: "endpoint",
          pointerId: e.pointerId,
          wallId: selectedWall.id,
          which: "start",
          startScreen: screen,
          started: false,
        };
        svgRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      if (distance(world, selectedWall.end) <= tolHandle) {
        dragRef.current = {
          kind: "endpoint",
          pointerId: e.pointerId,
          wallId: selectedWall.id,
          which: "end",
          startScreen: screen,
          started: false,
        };
        svgRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Wall body hit (topmost first).
    let hit: Wall | undefined;
    for (let i = walls.length - 1; i >= 0; i--) {
      const w = walls[i]!;
      if (hitTestWall(world, w, tolWall)) {
        hit = w;
        break;
      }
    }

    if (hit) {
      store.setSelection({ kind: "wall", id: hit.id });
      dragRef.current = {
        kind: "body",
        pointerId: e.pointerId,
        wallId: hit.id,
        startScreen: screen,
        startWorld: world,
        baseStart: { ...hit.start },
        baseEnd: { ...hit.end },
        started: false,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
    } else {
      store.setSelection(null);
      dragRef.current = { kind: "none" };
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const store = useStore.getState();

    if (d.kind === "pan") {
      const screen = clientToScreen(e.clientX, e.clientY);
      setView((v) => ({
        ...v,
        pan: {
          x: d.startPan.x + (screen.x - d.startScreen.x),
          y: d.startPan.y + (screen.y - d.startScreen.y),
        },
      }));
      return;
    }

    if (activeTool === "wall" && d.kind === "none") {
      const world = clientToWorld(e.clientX, e.clientY);
      setPreview(resolveDrawPoint(world, chainStart));
      return;
    }

    if (d.kind === "body" || d.kind === "endpoint") {
      const screen = clientToScreen(e.clientX, e.clientY);
      if (!d.started && distance(screen, d.startScreen) < DRAG_THRESHOLD_PX) {
        return; // still within click threshold
      }
      if (!d.started) {
        store.beginDrag();
        d.started = true;
      }
      const world = clientToWorld(e.clientX, e.clientY);
      if (d.kind === "body") {
        const snappedDelta = snapToGrid({
          x: world.x - d.startWorld.x,
          y: world.y - d.startWorld.y,
        });
        store.translateWall(
          d.wallId,
          add(d.baseStart, snappedDelta),
          add(d.baseEnd, snappedDelta),
        );
      } else {
        const { pt } = resolveDrawPoint(world, null, d.wallId);
        store.moveWallEndpoint(d.wallId, d.which, pt);
      }
    }
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (d.kind === "body" || d.kind === "endpoint") {
      if (d.started) useStore.getState().endDrag();
    }
    if (d.kind !== "none") {
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be gone
      }
    }
    dragRef.current = { kind: "none" };
  };

  const onDoubleClick = () => {
    if (activeTool === "wall") setChainStart(null);
  };

  // --- render helpers ---
  const cursorClass = spaceHeld
    ? "cursor-grab"
    : activeTool === "wall"
      ? "cursor-crosshair"
      : "cursor-default";

  return (
    <div className="plan" ref={containerRef}>
      <svg
        ref={svgRef}
        className={`plan-svg ${cursorClass}`}
        width="100%"
        height="100%"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <rect
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          className="plan-bg"
        />

        <Grid size={size} view={view} />

        <g
          transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.scale})`}
        >
          {walls.map((w) => (
            <polygon
              key={w.id}
              className={`wall${w.id === selection?.id ? " selected" : ""}`}
              points={wallCorners(w)
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Live preview segment while drawing. */}
          {activeTool === "wall" && chainStart && preview && (
            <line
              className="preview-line"
              x1={chainStart.x}
              y1={chainStart.y}
              x2={preview.pt.x}
              y2={preview.pt.y}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>

        {/* Screen-space overlay: handles, snap rings, length label. */}
        <Overlay
          selectedWall={selectedWall}
          activeTool={activeTool}
          chainStart={chainStart}
          preview={preview}
          worldToScreen={worldToScreen}
        />
      </svg>

      <div className="plan-hint">
        {activeTool === "wall"
          ? chainStart
            ? "Click to add a point · Enter / double-click to finish · Esc to cancel"
            : "Click to start a wall · hold Shift for 0/45/90°"
          : selectedWall
            ? "Drag the wall or its end handles · Delete to remove"
            : "Click a wall to select · Space-drag to pan · scroll to zoom"}
      </div>
    </div>
  );
}

function Grid({
  size,
  view,
}: {
  size: { width: number; height: number };
  view: View;
}) {
  if (size.width === 0) return null;
  const left = (0 - view.pan.x) / view.scale;
  const right = (size.width - view.pan.x) / view.scale;
  const top = (0 - view.pan.y) / view.scale;
  const bottom = (size.height - view.pan.y) / view.scale;

  const lines: React.ReactNode[] = [];
  for (const { spacing, className } of GRID_TIERS) {
    const px = spacing * view.scale;
    if (px < 7) continue; // too dense to be useful
    const startX = Math.floor(left / spacing) * spacing;
    const endX = Math.ceil(right / spacing) * spacing;
    const startY = Math.floor(top / spacing) * spacing;
    const endY = Math.ceil(bottom / spacing) * spacing;
    const countX = (endX - startX) / spacing;
    const countY = (endY - startY) / spacing;
    if (countX > 2000 || countY > 2000) continue;

    const tierLines: React.ReactNode[] = [];
    for (let x = startX; x <= endX + 1e-9; x += spacing) {
      const sx = x * view.scale + view.pan.x;
      tierLines.push(
        <line key={`vx${x}`} x1={sx} y1={0} x2={sx} y2={size.height} />,
      );
    }
    for (let y = startY; y <= endY + 1e-9; y += spacing) {
      const sy = y * view.scale + view.pan.y;
      tierLines.push(
        <line key={`hy${y}`} x1={0} y1={sy} x2={size.width} y2={sy} />,
      );
    }
    lines.push(
      <g key={className} className={className}>
        {tierLines}
      </g>,
    );
  }
  return <g className="grid">{lines}</g>;
}

function Overlay({
  selectedWall,
  activeTool,
  chainStart,
  preview,
  worldToScreen,
}: {
  selectedWall: Wall | undefined;
  activeTool: string;
  chainStart: Vec2 | null;
  preview: { pt: Vec2; snapped: boolean } | null;
  worldToScreen: (p: Vec2) => Vec2;
}) {
  return (
    <g className="overlay">
      {/* Endpoint handles for the selected wall (Select tool only). */}
      {selectedWall &&
        activeTool === "select" &&
        [selectedWall.start, selectedWall.end].map((p, i) => {
          const s = worldToScreen(p);
          return (
            <circle
              key={i}
              className="handle"
              cx={s.x}
              cy={s.y}
              r={HANDLE_RADIUS_PX}
            />
          );
        })}

      {/* Snap ring when the draw preview is locked to an existing endpoint. */}
      {activeTool === "wall" && preview?.snapped && (
        <circle
          className="snap-ring"
          cx={worldToScreen(preview.pt).x}
          cy={worldToScreen(preview.pt).y}
          r={HANDLE_RADIUS_PX + 2}
        />
      )}

      {/* Live length label while drawing. */}
      {activeTool === "wall" && chainStart && preview && (
        <LengthLabel
          a={worldToScreen(chainStart)}
          b={worldToScreen(preview.pt)}
          meters={wallLength({ start: chainStart, end: preview.pt })}
        />
      )}
    </g>
  );
}

function LengthLabel({ a, b, meters }: { a: Vec2; b: Vec2; meters: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const text = formatMeters(meters);
  return (
    <g className="length-label" transform={`translate(${mx} ${my - 12})`}>
      <rect
        x={-text.length * 4 - 6}
        y={-11}
        width={text.length * 8 + 12}
        height={20}
        rx={4}
      />
      <text x={0} y={4} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}
