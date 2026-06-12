import { useEffect, useRef, useState } from "react";
import { selectCurrentLevel, useStore } from "../store/store";
import type { WallSide } from "../store/store";
import type { MaterialRef, Vec2, Wall } from "../model/types";
import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  ENDPOINT_SNAP_RADIUS,
} from "../model/defaults";
import { add, sub, dot, scale as vscale, distance } from "../geometry/vec";
import { snapToGrid, constrainAngle } from "../geometry/snap";
import {
  wallNormal,
  wallDirection,
  wallLength,
  hitTestWall,
  nearestEndpoint,
} from "../geometry/wall";
import {
  windowSpan,
  projectPointToWallT,
  validateWindow,
  clampWindowT,
  wallPlanSegments,
} from "../geometry/windows";
import { isValidFloorPolygon, pointInPolygon } from "../geometry/polygon";
import { materialKey, materialDomId } from "../materials/key";
import { patternDataUrl } from "../materials/textures";
import { PATTERN_TILE_METERS } from "../materials/patterns";
import { useElementSize } from "../lib/useElementSize";
import { formatMeters } from "../lib/format";

interface View {
  pan: Vec2;
  scale: number;
}

const MIN_SCALE = 4;
const MAX_SCALE = 600;
const HANDLE_RADIUS_PX = 6;
const HANDLE_HIT_PX = 10;
const WALL_HIT_TOL_PX = 5;
const DRAG_THRESHOLD_PX = 4;
const CLOSE_FLOOR_PX = 12;

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
    }
  | {
      kind: "window";
      pointerId: number;
      wallId: string;
      windowId: string;
      startScreen: Vec2;
      started: boolean;
    };

const GRID_TIERS: { spacing: number; className: string }[] = [
  { spacing: 0.1, className: "grid-minor" },
  { spacing: 1, className: "grid-major" },
  { spacing: 10, className: "grid-coarse" },
];

// Corners of the wall (or a sub-span of it) as a thick rectangle in plan space.
function spanCorners(wall: Wall, a: number, b: number): Vec2[] {
  const dir = wallDirection(wall);
  const n = wallNormal(wall);
  const o = vscale(n, wall.thickness / 2);
  const A = add(wall.start, vscale(dir, a));
  const B = add(wall.start, vscale(dir, b));
  return [add(A, o), add(B, o), sub(B, o), sub(A, o)];
}

// Half of the wall rectangle on the given side (for the paint hover highlight).
function sideHalfCorners(wall: Wall, side: WallSide): Vec2[] {
  const n = wallNormal(wall); // points to side A
  const o = vscale(n, side === "A" ? wall.thickness / 2 : -wall.thickness / 2);
  return [wall.start, wall.end, add(wall.end, o), add(wall.start, o)];
}

const toPoints = (pts: Vec2[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

// Which side of the wall centerline a point is on (A = left of start->end).
function sideOf(wall: Wall, p: Vec2): WallSide {
  return dot(sub(p, wall.start), wallNormal(wall)) >= 0 ? "A" : "B";
}

function fillFor(material: MaterialRef): string {
  return material.kind === "solid"
    ? material.color
    : `url(#${materialDomId(material)})`;
}

export function PlanEditor() {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);

  const level = useStore(selectCurrentLevel);
  const activeTool = useStore((s) => s.activeTool);
  const selection = useStore((s) => s.selection);
  const sideHighlight = useStore((s) => s.sideHighlight);
  const currentMaterial = useStore((s) => s.currentMaterial);

  const [view, setView] = useState<View>({
    pan: { x: 160, y: 160 },
    scale: 60,
  });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Wall drawing.
  const [chainStart, setChainStart] = useState<Vec2 | null>(null);
  const [preview, setPreview] = useState<{ pt: Vec2; snapped: boolean } | null>(
    null,
  );
  // Window tool ghost.
  const [winGhost, setWinGhost] = useState<{
    wall: Wall;
    t: number;
    valid: boolean;
  } | null>(null);
  // Floor drawing.
  const [floorPts, setFloorPts] = useState<Vec2[]>([]);
  const [floorCursor, setFloorCursor] = useState<Vec2 | null>(null);

  const dragRef = useRef<DragState>({ kind: "none" });
  const shiftRef = useRef(false);
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const walls = level.walls;
  const floors = level.floors;
  const selectedWall =
    selection?.kind === "wall"
      ? walls.find((w) => w.id === selection.id)
      : undefined;

  // Distinct pattern materials used by floors -> SVG <pattern> defs.
  const patternDefs = new Map<string, MaterialRef>();
  for (const f of floors) {
    if (f.material.kind === "pattern")
      patternDefs.set(materialKey(f.material), f.material);
  }
  if (activeTool === "floor" && currentMaterial.kind === "pattern")
    patternDefs.set(materialKey(currentMaterial), currentMaterial);

  // --- coordinate transforms ---
  const worldToScreen = (p: Vec2): Vec2 => ({
    x: p.x * view.scale + view.pan.x,
    y: p.y * view.scale + view.pan.y,
  });
  const clientToWorld = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.pan.x) / view.scale,
      y: (clientY - rect.top - view.pan.y) / view.scale,
    };
  };
  const clientToScreen = (clientX: number, clientY: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Snap helper: optional angle constraint, then endpoint snap, else grid.
  const resolveDrawPoint = (
    raw: Vec2,
    fromChain: Vec2 | null,
    excludeId?: string,
    extraSnaps: Vec2[] = [],
  ): { pt: Vec2; snapped: boolean } => {
    let p = raw;
    if (shiftRef.current && fromChain) p = constrainAngle(fromChain, p);
    for (const s of extraSnaps) {
      if (distance(p, s) <= ENDPOINT_SNAP_RADIUS)
        return { pt: s, snapped: true };
    }
    const candidates = excludeId
      ? walls.filter((w) => w.id !== excludeId)
      : walls;
    const ep = nearestEndpoint(p, candidates, ENDPOINT_SNAP_RADIUS);
    if (ep) return { pt: ep, snapped: true };
    return { pt: snapToGrid(p), snapped: false };
  };

  const wallUnderCursor = (world: Vec2): Wall | undefined => {
    const tol = WALL_HIT_TOL_PX / view.scale;
    for (let i = walls.length - 1; i >= 0; i--) {
      if (hitTestWall(world, walls[i]!, tol)) return walls[i]!;
    }
    return undefined;
  };

  const windowUnderCursor = (
    world: Vec2,
  ): { wall: Wall; windowId: string } | undefined => {
    const tol = WALL_HIT_TOL_PX / view.scale;
    for (let i = walls.length - 1; i >= 0; i--) {
      const wall = walls[i]!;
      const L = wallLength(wall);
      if (L === 0) continue;
      const rel = sub(world, wall.start);
      const along = dot(rel, wallDirection(wall));
      const perp = dot(rel, wallNormal(wall));
      if (Math.abs(perp) > wall.thickness / 2 + tol) continue;
      for (const win of wall.windows) {
        const { a, b } = windowSpan(L, win.t, win.width);
        if (along >= a - tol && along <= b + tol)
          return { wall, windowId: win.id };
      }
    }
    return undefined;
  };

  // --- wheel zoom centered on cursor ---
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
      setView({
        pan: { x: sx - worldX * newScale, y: sy - worldY * newScale },
        scale: newScale,
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Reset transient drawing state when the tool changes.
  useEffect(() => {
    setChainStart(null);
    setPreview(null);
    setWinGhost(null);
    setFloorPts([]);
    setFloorCursor(null);
    useStore.getState().setSideHighlight(null);
  }, [activeTool]);

  const closeFloor = () => {
    if (floorPts.length >= 3 && isValidFloorPolygon(floorPts)) {
      useStore.getState().addFloor(floorPts, currentMaterial);
      setFloorPts([]);
      setFloorCursor(null);
    }
  };

  // --- keyboard ---
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
        setFloorPts([]);
        setFloorCursor(null);
      } else if (e.key === "Enter") {
        setChainStart(null);
        if (activeTool === "floor") closeFloor();
      } else if (
        e.key === "Backspace" &&
        activeTool === "floor" &&
        floorPts.length
      ) {
        e.preventDefault();
        setFloorPts((pts) => pts.slice(0, -1));
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
  });

  // --- pointer handlers ---
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 2) return;
    const store = useStore.getState();
    const screen = clientToScreen(e.clientX, e.clientY);

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
      if (chainStart === null) setChainStart(pt);
      else {
        if (distance(chainStart, pt) > 1e-6) store.addWall(chainStart, pt);
        setChainStart(pt);
      }
      setPreview({ pt, snapped: false });
      return;
    }

    if (activeTool === "window") {
      const wall = wallUnderCursor(world);
      if (wall) {
        const candidate = {
          t: projectPointToWallT(wall, world),
          width: DEFAULT_WINDOW_WIDTH,
          height: DEFAULT_WINDOW_HEIGHT,
          sillHeight: DEFAULT_WINDOW_SILL_HEIGHT,
        };
        if (validateWindow(wall, candidate).ok)
          store.addWindow(wall.id, candidate);
      }
      return;
    }

    if (activeTool === "paint") {
      const wall = wallUnderCursor(world);
      if (wall)
        store.paintWallSide(wall.id, sideOf(wall, world), currentMaterial);
      return;
    }

    if (activeTool === "floor") {
      const first = floorPts[0];
      const snap = resolveDrawPoint(world, null, undefined, floorPts);
      if (
        first &&
        floorPts.length >= 3 &&
        distance(worldToScreen(snap.pt), worldToScreen(first)) <= CLOSE_FLOOR_PX
      ) {
        closeFloor();
      } else {
        setFloorPts((pts) => [...pts, snap.pt]);
      }
      return;
    }

    // --- select tool ---
    const tolHandle = HANDLE_HIT_PX / view.scale;
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

    const winHit = windowUnderCursor(world);
    if (winHit) {
      store.setSelection({
        kind: "window",
        wallId: winHit.wall.id,
        id: winHit.windowId,
      });
      dragRef.current = {
        kind: "window",
        pointerId: e.pointerId,
        wallId: winHit.wall.id,
        windowId: winHit.windowId,
        startScreen: screen,
        started: false,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    const hitWall = wallUnderCursor(world);
    if (hitWall) {
      store.setSelection({ kind: "wall", id: hitWall.id });
      dragRef.current = {
        kind: "body",
        pointerId: e.pointerId,
        wallId: hitWall.id,
        startScreen: screen,
        startWorld: world,
        baseStart: { ...hitWall.start },
        baseEnd: { ...hitWall.end },
        started: false,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    for (let i = floors.length - 1; i >= 0; i--) {
      if (pointInPolygon(world, floors[i]!.polygon)) {
        store.setSelection({ kind: "floor", id: floors[i]!.id });
        dragRef.current = { kind: "none" };
        return;
      }
    }

    store.setSelection(null);
    dragRef.current = { kind: "none" };
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

    if (d.kind === "none") {
      const world = clientToWorld(e.clientX, e.clientY);
      if (activeTool === "wall") {
        setPreview(resolveDrawPoint(world, chainStart));
      } else if (activeTool === "floor") {
        setFloorCursor(resolveDrawPoint(world, null, undefined, floorPts).pt);
      } else if (activeTool === "window") {
        const wall = wallUnderCursor(world);
        if (wall) {
          const t = projectPointToWallT(wall, world);
          const valid = validateWindow(wall, {
            t,
            width: DEFAULT_WINDOW_WIDTH,
            height: DEFAULT_WINDOW_HEIGHT,
            sillHeight: DEFAULT_WINDOW_SILL_HEIGHT,
          }).ok;
          setWinGhost({ wall, t, valid });
        } else setWinGhost(null);
      } else if (activeTool === "paint") {
        const wall = wallUnderCursor(world);
        store.setSideHighlight(
          wall ? { wallId: wall.id, side: sideOf(wall, world) } : null,
        );
      }
      return;
    }

    if (d.kind === "body" || d.kind === "endpoint" || d.kind === "window") {
      const screen = clientToScreen(e.clientX, e.clientY);
      if (!d.started && distance(screen, d.startScreen) < DRAG_THRESHOLD_PX)
        return;
      if (!d.started) {
        store.beginDrag();
        d.started = true;
      }
      const world = clientToWorld(e.clientX, e.clientY);
      if (d.kind === "body") {
        const delta = snapToGrid({
          x: world.x - d.startWorld.x,
          y: world.y - d.startWorld.y,
        });
        store.translateWall(
          d.wallId,
          add(d.baseStart, delta),
          add(d.baseEnd, delta),
        );
      } else if (d.kind === "endpoint") {
        store.moveWallEndpoint(
          d.wallId,
          d.which,
          resolveDrawPoint(world, null, d.wallId).pt,
        );
      } else {
        const wall = walls.find((w) => w.id === d.wallId);
        const win = wall?.windows.find((x) => x.id === d.windowId);
        if (wall && win) {
          const t = clampWindowT(
            wall,
            win.width,
            projectPointToWallT(wall, world),
          );
          if (validateWindow(wall, { ...win, t }, win.id).ok)
            store.moveWindow(d.wallId, d.windowId, t);
        }
      }
    }
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (
      (d.kind === "body" || d.kind === "endpoint" || d.kind === "window") &&
      d.started
    ) {
      useStore.getState().endDrag();
    }
    if (d.kind !== "none") {
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // capture already gone
      }
    }
    dragRef.current = { kind: "none" };
  };

  const onDoubleClick = () => {
    if (activeTool === "wall") setChainStart(null);
    else if (activeTool === "floor") closeFloor();
  };

  const cursorClass = spaceHeld
    ? "cursor-grab"
    : activeTool === "select"
      ? "cursor-default"
      : "cursor-crosshair";

  const highlightWall = sideHighlight
    ? walls.find((w) => w.id === sideHighlight.wallId)
    : undefined;

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
        <defs>
          {[...patternDefs.entries()].map(([key, mat]) => (
            <pattern
              key={key}
              id={materialDomId(mat)}
              patternUnits="userSpaceOnUse"
              width={PATTERN_TILE_METERS}
              height={PATTERN_TILE_METERS}
            >
              <image
                href={mat.kind === "pattern" ? patternDataUrl(mat) : undefined}
                x={0}
                y={0}
                width={PATTERN_TILE_METERS}
                height={PATTERN_TILE_METERS}
                preserveAspectRatio="none"
              />
            </pattern>
          ))}
        </defs>

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
          {/* Floors beneath everything. */}
          {floors.map((f) => (
            <polygon
              key={f.id}
              className={`floor${selection?.kind === "floor" && selection.id === f.id ? " selected" : ""}`}
              points={toPoints(f.polygon)}
              fill={fillFor(f.material)}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Walls, broken at window openings. */}
          {walls.map((w) => {
            const isSel = selection?.kind === "wall" && selection.id === w.id;
            return (
              <g key={w.id}>
                {wallPlanSegments(w).map((seg, i) => (
                  <polygon
                    key={i}
                    className={`wall${isSel ? " selected" : ""}`}
                    points={toPoints(spanCorners(w, seg.a, seg.b))}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {w.windows.map((win) => (
                  <WindowSymbol
                    key={win.id}
                    wall={w}
                    t={win.t}
                    width={win.width}
                    selected={
                      selection?.kind === "window" && selection.id === win.id
                    }
                  />
                ))}
              </g>
            );
          })}

          {/* Paint / chip side-highlight. */}
          {highlightWall && sideHighlight && (
            <polygon
              className="side-highlight"
              points={toPoints(
                sideHalfCorners(highlightWall, sideHighlight.side),
              )}
            />
          )}

          {/* Window ghost (placement preview). */}
          {activeTool === "window" && winGhost && (
            <WindowSymbol
              wall={winGhost.wall}
              t={winGhost.t}
              width={DEFAULT_WINDOW_WIDTH}
              ghost={winGhost.valid ? "valid" : "invalid"}
            />
          )}

          {/* Wall drawing preview. */}
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

          {/* Floor drawing preview. */}
          {activeTool === "floor" && floorPts.length > 0 && (
            <FloorPreview points={floorPts} cursor={floorCursor} />
          )}
        </g>

        <Overlay
          selectedWall={selectedWall}
          activeTool={activeTool}
          chainStart={chainStart}
          preview={preview}
          floorPts={floorPts}
          worldToScreen={worldToScreen}
        />
      </svg>

      <div className="plan-hint">
        {hintFor(activeTool, chainStart, floorPts.length)}
      </div>
    </div>
  );
}

function hintFor(tool: string, chainStart: Vec2 | null, floorCount: number) {
  switch (tool) {
    case "wall":
      return chainStart
        ? "Click to add a point · Enter / double-click to finish · Esc to cancel"
        : "Click to start a wall · hold Shift for 0/45/90°";
    case "window":
      return "Hover a wall and click to place a window · invalid spots show red";
    case "paint":
      return "Hover a wall to highlight the near side · click to paint it";
    case "floor":
      return floorCount
        ? "Click to add points · click the first point or Enter to close · Backspace removes the last · Esc cancels"
        : "Click to start a floor outline";
    default:
      return "Click a wall, window, or floor to select · Space-drag to pan · scroll to zoom";
  }
}

function WindowSymbol({
  wall,
  t,
  width,
  selected,
  ghost,
}: {
  wall: Wall;
  t: number;
  width: number;
  selected?: boolean;
  ghost?: "valid" | "invalid";
}) {
  const L = wallLength(wall);
  if (L === 0) return null;
  const { a, b } = windowSpan(L, t, width);
  const dir = wallDirection(wall);
  const n = wallNormal(wall);
  const o = vscale(n, wall.thickness / 2);
  const A = add(wall.start, vscale(dir, Math.max(0, a)));
  const B = add(wall.start, vscale(dir, Math.min(L, b)));
  const cls = ghost
    ? `window-symbol ghost-${ghost}`
    : `window-symbol${selected ? " selected" : ""}`;
  const seg = (p: Vec2, q: Vec2, key: string) => (
    <line
      key={key}
      x1={p.x}
      y1={p.y}
      x2={q.x}
      y2={q.y}
      vectorEffect="non-scaling-stroke"
    />
  );
  return (
    <g className={cls}>
      {seg(add(A, o), add(B, o), "fa")}
      {seg(sub(A, o), sub(B, o), "fb")}
      {seg(A, B, "c")}
      {seg(add(A, o), sub(A, o), "ja")}
      {seg(add(B, o), sub(B, o), "jb")}
    </g>
  );
}

function FloorPreview({
  points,
  cursor,
}: {
  points: Vec2[];
  cursor: Vec2 | null;
}) {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const linePts = cursor ? [...points, cursor] : points;
  return (
    <g className="floor-preview">
      <polyline points={toPoints(linePts)} vectorEffect="non-scaling-stroke" />
      {cursor && points.length >= 2 && (
        <line
          className="floor-close"
          x1={cursor.x}
          y1={cursor.y}
          x2={first.x}
          y2={first.y}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={0.06}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {cursor && (
        <line
          className="floor-edge"
          x1={last.x}
          y1={last.y}
          x2={cursor.x}
          y2={cursor.y}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
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
    if (spacing * view.scale < 7) continue;
    const startX = Math.floor(left / spacing) * spacing;
    const endX = Math.ceil(right / spacing) * spacing;
    const startY = Math.floor(top / spacing) * spacing;
    const endY = Math.ceil(bottom / spacing) * spacing;
    if ((endX - startX) / spacing > 2000 || (endY - startY) / spacing > 2000)
      continue;

    const tier: React.ReactNode[] = [];
    for (let x = startX; x <= endX + 1e-9; x += spacing) {
      const sx = x * view.scale + view.pan.x;
      tier.push(
        <line key={`vx${x}`} x1={sx} y1={0} x2={sx} y2={size.height} />,
      );
    }
    for (let y = startY; y <= endY + 1e-9; y += spacing) {
      const sy = y * view.scale + view.pan.y;
      tier.push(<line key={`hy${y}`} x1={0} y1={sy} x2={size.width} y2={sy} />);
    }
    lines.push(
      <g key={className} className={className}>
        {tier}
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
  floorPts,
  worldToScreen,
}: {
  selectedWall: Wall | undefined;
  activeTool: string;
  chainStart: Vec2 | null;
  preview: { pt: Vec2; snapped: boolean } | null;
  floorPts: Vec2[];
  worldToScreen: (p: Vec2) => Vec2;
}) {
  return (
    <g className="overlay">
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

      {activeTool === "wall" && preview?.snapped && (
        <circle
          className="snap-ring"
          cx={worldToScreen(preview.pt).x}
          cy={worldToScreen(preview.pt).y}
          r={HANDLE_RADIUS_PX + 2}
        />
      )}

      {activeTool === "wall" && chainStart && preview && (
        <LengthLabel
          a={worldToScreen(chainStart)}
          b={worldToScreen(preview.pt)}
          meters={wallLength({ start: chainStart, end: preview.pt })}
        />
      )}

      {activeTool === "floor" &&
        floorPts.length > 0 &&
        (() => {
          const s = worldToScreen(floorPts[0]!);
          return (
            <circle
              className="floor-start"
              cx={s.x}
              cy={s.y}
              r={HANDLE_RADIUS_PX}
            />
          );
        })()}
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
