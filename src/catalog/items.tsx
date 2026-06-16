import type { ReactNode } from "react";
import type { CatalogEntry, CatalogScaling, ScaleAxes } from "./types";
import { box, cyl, rbox, legs, solid } from "./parts";

// Muted, consistent palette.
const WOOD = solid("#8a6d4b");
const WOOD_DARK = solid("#6b5840");
const WOOD_LIGHT = solid("#b9966b");
const FABRIC = solid("#8d9aa8");
const FABRIC2 = solid("#9aa0a6");
const PORCELAIN = solid("#eef0ee");
const STONE = solid("#6b7280");
const METAL = solid("#cdd1d6");
const SCREEN = solid("#1b1d22");
const MATTRESS = solid("#e7e2d6");
const PILLOW = solid("#dfe3e8");
const RUG = solid("#c2b29a");
const GLASS = solid("#cfe0ea");
const LEAF = solid("#5f7d52");
const POT = solid("#a9785a");
const SHADE = solid("#e8e2d2");

// --- scaling policy helpers (lowercase so the react-refresh lint doesn't
// mistake them for components) ---
const noScale: CatalogScaling = { mode: "none" };
const uniformScale = (min: number, max: number): CatalogScaling => ({
  mode: "uniform",
  uniform: [min, max],
});
const axesScale = (axes: ScaleAxes): CatalogScaling => ({ mode: "axes", axes });

// --- tiny 2D glyph helpers (local centered coords; CSS styles the strokes) ---
const ns = { vectorEffect: "non-scaling-stroke" as const };
const gl = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} {...ns} />
);
const gr = (x: number, y: number, w: number, h: number, key?: string) => (
  <rect key={key} x={x} y={y} width={w} height={h} fill="none" {...ns} />
);
const gc = (cx: number, cy: number, r: number, key?: string) => (
  <circle key={key} cx={cx} cy={cy} r={r} fill="none" {...ns} />
);

export const CATALOG_ITEMS: CatalogEntry[] = [
  // ---------------- LIVING ----------------
  {
    id: "sofa-3seat",
    name: "3-seat sofa",
    category: "living",
    footprint: { width: 2.1, depth: 0.9 },
    height: 0.8,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.6, 1.8], z: [0.7, 1.4] }),
    slots: [
      { name: "body", default: FABRIC },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 2.1,
        D = 0.9;
      return [
        box("body", [W, 0.32, D - 0.18], [0, 0.32, 0.09]),
        box("body", [W, 0.5, 0.18], [0, 0.5, -D / 2 + 0.09]),
        box("body", [0.18, 0.42, D], [-W / 2 + 0.09, 0.37, 0]),
        box("body", [0.18, 0.42, D], [W / 2 - 0.09, 0.37, 0]),
        ...legs("legs", W, D, 0.16),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gr(-w / 2 + 0.08, -d / 2 + 0.06, w - 0.16, 0.16, "back")}
        {gl(-w / 6, -d / 2 + 0.24, -w / 6, d / 2 - 0.08, "d1")}
        {gl(w / 6, -d / 2 + 0.24, w / 6, d / 2 - 0.08, "d2")}
      </>
    ),
  },
  {
    id: "armchair",
    name: "Armchair",
    category: "living",
    footprint: { width: 0.9, depth: 0.9 },
    height: 0.8,
    wallHugger: false,
    collidable: true,
    scaling: uniformScale(0.6, 1.6),
    slots: [
      { name: "body", default: FABRIC },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 0.9,
        D = 0.9;
      return [
        box("body", [W, 0.34, D - 0.18], [0, 0.32, 0.09]),
        box("body", [W, 0.46, 0.16], [0, 0.5, -D / 2 + 0.08]),
        box("body", [0.16, 0.4, D], [-W / 2 + 0.08, 0.36, 0]),
        box("body", [0.16, 0.4, D], [W / 2 - 0.08, 0.36, 0]),
        ...legs("legs", W, D, 0.16),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.08, -d / 2 + 0.06, w - 0.16, 0.14, "back")}</>
    ),
  },
  {
    id: "coffee-table",
    name: "Coffee table",
    category: "living",
    footprint: { width: 1.1, depth: 0.6 },
    height: 0.4,
    wallHugger: false,
    collidable: true,
    surfaceTop: 0.4,
    scaling: axesScale({ x: [0.5, 2.2], z: [0.5, 2.0] }),
    slots: [
      { name: "top", default: WOOD_LIGHT },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 1.1,
        D = 0.6;
      return [
        box("top", [W, 0.06, D], [0, 0.37, 0]),
        ...legs("legs", W, D, 0.34),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.12, -d / 2 + 0.1, w - 0.24, d - 0.2, "in")}</>
    ),
  },
  {
    id: "tv-stand",
    name: "TV stand",
    category: "living",
    footprint: { width: 1.4, depth: 0.4 },
    height: 1.1,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.5, 2.5] }),
    slots: [
      { name: "body", default: WOOD_DARK },
      { name: "screen", default: SCREEN },
    ],
    build: () => {
      const W = 1.4,
        D = 0.4;
      return [
        box("body", [W, 0.45, D], [0, 0.225, 0]),
        box("body", [0.1, 0.18, 0.1], [0, 0.55, -0.02]),
        box("screen", [1.0, 0.58, 0.05], [0, 0.86, -D / 2 + 0.04]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.3, -d / 2 + 0.05, w - 0.6, 0.08, "tv")}</>
    ),
  },
  {
    id: "rug",
    name: "Rug",
    category: "living",
    footprint: { width: 1.8, depth: 1.2 },
    height: 0.012,
    wallHugger: false,
    collidable: false,
    flat: true,
    scaling: axesScale({ x: [0.3, 4], z: [0.3, 4] }),
    slots: [{ name: "rug", default: RUG }],
    build: () => [box("rug", [1.8, 0.012, 1.2], [0, 0.006, 0])],
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.12, -d / 2 + 0.12, w - 0.24, d - 0.24, "inner")}</>
    ),
  },
  {
    id: "bookshelf",
    name: "Bookshelf",
    category: "living",
    footprint: { width: 0.9, depth: 0.3 },
    height: 1.8,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.5, 2.5], y: [0.5, 1.8] }),
    slots: [{ name: "body", default: WOOD }],
    build: () => {
      const W = 0.9,
        D = 0.3,
        H = 1.8;
      return [
        box("body", [W, H, 0.04], [0, H / 2, -D / 2 + 0.02]), // back
        box("body", [0.04, H, D], [-W / 2 + 0.02, H / 2, 0]),
        box("body", [0.04, H, D], [W / 2 - 0.02, H / 2, 0]),
        box("body", [W, 0.04, D], [0, 0.6, 0]),
        box("body", [W, 0.04, D], [0, 1.1, 0]),
        box("body", [W, 0.04, D], [0, 1.6, 0]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gl(-w / 6, -d / 2 + 0.05, -w / 6, d / 2 - 0.05, "s1")}
        {gl(0, -d / 2 + 0.05, 0, d / 2 - 0.05, "s2")}
        {gl(w / 6, -d / 2 + 0.05, w / 6, d / 2 - 0.05, "s3")}
      </>
    ),
  },
  {
    id: "floor-lamp",
    name: "Floor lamp",
    category: "living",
    footprint: { width: 0.4, depth: 0.4 },
    height: 1.6,
    wallHugger: false,
    collidable: false,
    scaling: uniformScale(0.7, 1.5),
    slots: [
      { name: "shade", default: SHADE },
      { name: "stand", default: WOOD_DARK },
    ],
    build: () => [
      cyl("stand", 0.16, 0.04, [0, 0.02, 0]),
      cyl("stand", 0.025, 1.4, [0, 0.72, 0]),
      cyl("shade", 0.2, 0.3, [0, 1.5, 0]),
    ],
    glyph: (): ReactNode => (
      <>
        {gc(0, 0, 0.17, "shade")}
        {gc(0, 0, 0.03, "pole")}
      </>
    ),
  },
  {
    id: "side-table",
    name: "Side table",
    category: "living",
    footprint: { width: 0.5, depth: 0.5 },
    height: 0.55,
    wallHugger: false,
    collidable: true,
    surfaceTop: 0.55,
    scaling: axesScale({ x: [0.5, 2.0], z: [0.5, 2.0] }),
    slots: [
      { name: "top", default: WOOD_LIGHT },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => [
      box("top", [0.5, 0.05, 0.5], [0, 0.52, 0]),
      ...legs("legs", 0.5, 0.5, 0.5, 0.05, 0.04),
    ],
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.1, -d / 2 + 0.1, w - 0.2, d - 0.2, "in")}</>
    ),
  },
  {
    id: "console-table",
    name: "Console table",
    category: "living",
    footprint: { width: 1.1, depth: 0.35 },
    height: 0.8,
    wallHugger: true,
    collidable: true,
    surfaceTop: 0.8,
    scaling: axesScale({ x: [0.5, 2.5] }),
    slots: [
      { name: "top", default: WOOD_LIGHT },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => [
      box("top", [1.1, 0.05, 0.35], [0, 0.77, 0]),
      ...legs("legs", 1.1, 0.35, 0.75, 0.06, 0.04),
    ],
    glyph: (w, d): ReactNode => (
      <>{gl(-w / 2 + 0.06, -d / 2 + 0.07, w / 2 - 0.06, -d / 2 + 0.07, "back")}</>
    ),
  },
  {
    id: "plant",
    name: "Potted plant",
    category: "living",
    footprint: { width: 0.5, depth: 0.5 },
    height: 1.1,
    wallHugger: false,
    collidable: false,
    scaling: uniformScale(0.5, 2.2),
    slots: [
      { name: "foliage", default: LEAF },
      { name: "pot", default: POT },
    ],
    build: () => [
      cyl("pot", 0.2, 0.4, [0, 0.2, 0]),
      rbox("foliage", [0.55, 0.7, 0.55], 0.26, [0, 0.75, 0]),
    ],
    glyph: (): ReactNode => (
      <>
        {gc(0, 0, 0.2, "foliage")}
        {gc(0, 0, 0.09, "pot")}
      </>
    ),
  },
  {
    id: "sofa-sectional",
    name: "Sectional sofa",
    category: "living",
    footprint: { width: 2.4, depth: 1.6 },
    height: 0.8,
    wallHugger: true,
    collidable: true,
    // L-shaped: width and the return depth both flex.
    scaling: axesScale({ x: [0.7, 1.6], z: [0.7, 1.4] }),
    slots: [
      { name: "body", default: FABRIC },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 2.4,
        D = 1.6;
      return [
        box("body", [W, 0.34, 0.8], [0, 0.32, D / 2 - 0.4]), // front seat row
        box("body", [0.8, 0.34, D - 0.8], [-W / 2 + 0.4, 0.32, -0.4]), // chaise
        box("body", [W, 0.5, 0.16], [0, 0.5, -D / 2 + 0.08]), // back (long)
        box("body", [0.16, 0.5, D], [-W / 2 + 0.08, 0.5, 0]), // back (side)
        box("legs", [W - 0.1, 0.14, 0.7], [0, 0.07, D / 2 - 0.4]),
        box("legs", [0.7, 0.14, D - 0.9], [-W / 2 + 0.4, 0.07, -0.45]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gr(-w / 2 + 0.06, -d / 2 + 0.05, w - 0.12, 0.16, "back")}
        {gr(-w / 2 + 0.05, -d / 2 + 0.05, 0.16, d - 0.1, "side")}
      </>
    ),
  },
  {
    id: "sofa-2seat",
    name: "Loveseat",
    category: "living",
    footprint: { width: 1.5, depth: 0.9 },
    height: 0.8,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.7, 1.5] }),
    slots: [
      { name: "body", default: FABRIC },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 1.5,
        D = 0.9;
      return [
        box("body", [W, 0.32, D - 0.18], [0, 0.32, 0.09]),
        box("body", [W, 0.5, 0.18], [0, 0.5, -D / 2 + 0.09]),
        box("body", [0.18, 0.42, D], [-W / 2 + 0.09, 0.37, 0]),
        box("body", [0.18, 0.42, D], [W / 2 - 0.09, 0.37, 0]),
        ...legs("legs", W, D, 0.16),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gr(-w / 2 + 0.08, -d / 2 + 0.06, w - 0.16, 0.16, "back")}
        {gl(0, -d / 2 + 0.24, 0, d / 2 - 0.08, "div")}
      </>
    ),
  },
  {
    id: "ottoman",
    name: "Ottoman",
    category: "living",
    footprint: { width: 0.6, depth: 0.6 },
    height: 0.42,
    wallHugger: false,
    collidable: true,
    scaling: uniformScale(0.6, 1.8),
    slots: [{ name: "body", default: FABRIC2 }],
    build: () => [
      box("body", [0.5, 0.06, 0.5], [0, 0.03, 0]),
      box("body", [0.54, 0.24, 0.54], [0, 0.2, 0]),
      rbox("body", [0.58, 0.16, 0.58], 0.07, [0, 0.36, 0]),
    ],
    glyph: (w, d): ReactNode => (
      <>
        {gc(0, 0, Math.min(w, d) / 2 - 0.05, "o")}
        {gc(0, 0, 0.05, "tuft")}
      </>
    ),
  },
  {
    id: "fireplace",
    name: "Fireplace",
    category: "living",
    footprint: { width: 1.4, depth: 0.4 },
    height: 1.2,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.6, 1.8] }),
    slots: [
      { name: "surround", default: solid("#cfcac0") },
      { name: "firebox", default: SCREEN },
    ],
    build: () => {
      const W = 1.4,
        D = 0.4,
        H = 1.2;
      return [
        box("surround", [0.26, H, D], [-W / 2 + 0.13, H / 2, 0]),
        box("surround", [0.26, H, D], [W / 2 - 0.13, H / 2, 0]),
        box("surround", [W, 0.2, D + 0.06], [0, H - 0.1, 0]),
        box("surround", [W, 0.18, D], [0, 0.09, 0]),
        box("firebox", [W - 0.5, H - 0.38, D - 0.08], [0, H / 2, 0.03]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.28, -d / 2 + 0.08, w - 0.56, d - 0.16, "firebox")}</>
    ),
  },

  // ---------------- BEDROOM ----------------
  {
    id: "bed-double",
    name: "Double bed",
    category: "bedroom",
    footprint: { width: 1.6, depth: 2.1 },
    height: 0.6,
    wallHugger: true,
    collidable: true,
    // Beds: width and length flex (twin .. king) but height stays locked.
    scaling: axesScale({ x: [0.8, 1.4], z: [0.85, 1.3] }),
    slots: [
      { name: "frame", default: WOOD },
      { name: "mattress", default: MATTRESS },
      { name: "pillows", default: PILLOW },
    ],
    build: () => {
      const W = 1.6,
        D = 2.1;
      return [
        box("frame", [W, 0.3, D], [0, 0.15, 0]),
        box("frame", [W, 0.6, 0.08], [0, 0.3, -D / 2 + 0.04]), // headboard (-z)
        box("mattress", [W - 0.1, 0.18, D - 0.1], [0, 0.39, 0.02]),
        box("pillows", [0.62, 0.1, 0.34], [-0.36, 0.5, -D / 2 + 0.32]),
        box("pillows", [0.62, 0.1, 0.34], [0.36, 0.5, -D / 2 + 0.32]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gl(-w / 2 + 0.05, -d / 2 + 0.45, w / 2 - 0.05, -d / 2 + 0.45, "pl")}
        {gr(-w / 2 + 0.12, -d / 2 + 0.1, w / 2 - 0.2, 0.28, "p1")}
        {gr(0.08, -d / 2 + 0.1, w / 2 - 0.2, 0.28, "p2")}
      </>
    ),
  },
  {
    id: "bed-single",
    name: "Single bed",
    category: "bedroom",
    footprint: { width: 1.0, depth: 2.0 },
    height: 0.6,
    wallHugger: true,
    collidable: true,
    // Same policy shape as the double bed: width/length flex, height locked.
    scaling: axesScale({ x: [0.8, 1.4], z: [0.85, 1.3] }),
    slots: [
      { name: "frame", default: WOOD },
      { name: "mattress", default: MATTRESS },
      { name: "pillows", default: PILLOW },
    ],
    build: () => {
      const W = 1.0,
        D = 2.0;
      return [
        box("frame", [W, 0.3, D], [0, 0.15, 0]),
        box("frame", [W, 0.6, 0.08], [0, 0.3, -D / 2 + 0.04]), // headboard (-z)
        box("mattress", [W - 0.1, 0.18, D - 0.1], [0, 0.39, 0.02]),
        box("pillows", [0.62, 0.1, 0.34], [0, 0.5, -D / 2 + 0.32]), // single pillow
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gl(-w / 2 + 0.05, -d / 2 + 0.45, w / 2 - 0.05, -d / 2 + 0.45, "pl")}
        {gr(-0.3, -d / 2 + 0.1, 0.6, 0.28, "p1")}
      </>
    ),
  },
  {
    id: "nightstand",
    name: "Nightstand",
    category: "bedroom",
    footprint: { width: 0.45, depth: 0.4 },
    height: 0.5,
    wallHugger: false,
    collidable: true,
    surfaceTop: 0.48,
    scaling: uniformScale(0.6, 1.6),
    slots: [{ name: "body", default: WOOD }],
    build: () => {
      const W = 0.45,
        D = 0.4;
      return [
        box("body", [W, 0.46, D], [0, 0.25, 0]),
        box("body", [W - 0.08, 0.02, D - 0.06], [0, 0.33, D / 2 - 0.02]),
      ];
    },
    glyph: (): ReactNode => <>{gc(0, 0.04, 0.04, "knob")}</>,
  },
  {
    id: "wardrobe",
    name: "Wardrobe",
    category: "bedroom",
    footprint: { width: 1.2, depth: 0.6 },
    height: 2.0,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.5, 2.2], y: [0.7, 1.4] }),
    slots: [{ name: "body", default: WOOD }],
    build: () => {
      const W = 1.2,
        D = 0.6,
        H = 2.0;
      return [
        box("body", [W, H, D], [0, H / 2, 0]),
        box("body", [0.03, H - 0.1, 0.02], [-0.04, H / 2, D / 2 - 0.005]),
        box("body", [0.03, H - 0.1, 0.02], [0.04, H / 2, D / 2 - 0.005]),
      ];
    },
    glyph: (_w, d): ReactNode => (
      <>
        {gl(0, -d / 2 + 0.05, 0, d / 2 - 0.05, "split")}
        {gc(-0.06, 0, 0.025, "h1")}
        {gc(0.06, 0, 0.025, "h2")}
      </>
    ),
  },
  {
    id: "dresser",
    name: "Dresser",
    category: "bedroom",
    footprint: { width: 1.1, depth: 0.5 },
    height: 0.8,
    wallHugger: true,
    collidable: true,
    surfaceTop: 0.8,
    scaling: axesScale({ x: [0.5, 2.2], y: [0.7, 1.4] }),
    slots: [{ name: "body", default: WOOD }],
    build: () => {
      const W = 1.1,
        D = 0.5,
        H = 0.8;
      return [
        box("body", [W, H, D], [0, H / 2, 0]),
        box("body", [W - 0.08, 0.02, 0.02], [0, 0.28, D / 2 - 0.005]),
        box("body", [W - 0.08, 0.02, 0.02], [0, 0.55, D / 2 - 0.005]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gl(-w / 2 + 0.05, -d / 6, w / 2 - 0.05, -d / 6, "d1")}
        {gl(-w / 2 + 0.05, d / 6, w / 2 - 0.05, d / 6, "d2")}
      </>
    ),
  },
  {
    id: "bedside-lamp",
    name: "Bedside lamp",
    category: "bedroom",
    footprint: { width: 0.25, depth: 0.25 },
    height: 0.5,
    wallHugger: false,
    collidable: false,
    stackable: true,
    scaling: uniformScale(0.7, 1.5),
    slots: [
      { name: "shade", default: SHADE },
      { name: "stand", default: METAL },
    ],
    build: () => [
      cyl("stand", 0.08, 0.03, [0, 0.015, 0]),
      cyl("stand", 0.02, 0.32, [0, 0.18, 0]),
      cyl("shade", 0.12, 0.16, [0, 0.42, 0]),
    ],
    glyph: (): ReactNode => <>{gc(0, 0, 0.11, "shade")}</>,
  },
  {
    id: "mirror",
    name: "Full-length mirror",
    category: "bedroom",
    footprint: { width: 0.6, depth: 0.1 },
    height: 1.6,
    wallHugger: true,
    collidable: false,
    scaling: axesScale({ x: [0.5, 1.8], y: [0.7, 1.5] }),
    slots: [
      { name: "frame", default: WOOD_DARK },
      { name: "glass", default: GLASS },
    ],
    build: () => {
      const W = 0.6,
        H = 1.6;
      return [
        box("frame", [W, H, 0.08], [0, H / 2, -0.01]),
        box("glass", [W - 0.1, H - 0.12, 0.02], [0, H / 2, 0.04]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.06, -d / 2 + 0.02, w - 0.12, d - 0.04, "glass")}</>
    ),
  },
  {
    id: "vanity-table",
    name: "Dressing table",
    category: "bedroom",
    footprint: { width: 1.1, depth: 0.5 },
    height: 1.4,
    wallHugger: true,
    collidable: true,
    surfaceTop: 0.8,
    scaling: axesScale({ x: [0.6, 1.6] }),
    slots: [
      { name: "surface", default: WOOD_LIGHT },
      { name: "legs", default: WOOD_DARK },
      { name: "mirror", default: GLASS },
      { name: "stool", default: FABRIC2 },
    ],
    build: () => {
      const W = 1.1,
        D = 0.5;
      return [
        box("surface", [W, 0.05, D], [0, 0.77, 0]),
        ...legs("legs", W, D, 0.75, 0.05, 0.04),
        box("mirror", [0.7, 0.62, 0.03], [0, 1.1, -D / 2 + 0.03]),
        box("stool", [0.42, 0.45, 0.34], [0, 0.225, 0.06]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gl(-w / 2 + 0.12, -d / 2 + 0.05, w / 2 - 0.12, -d / 2 + 0.05, "mirror")}
        {gr(-0.21, 0.02, 0.42, 0.16, "stool")}
      </>
    ),
  },
  {
    id: "bed-bench",
    name: "Bed bench",
    category: "bedroom",
    footprint: { width: 1.2, depth: 0.4 },
    height: 0.48,
    wallHugger: false,
    collidable: true,
    surfaceTop: 0.48,
    scaling: axesScale({ x: [0.5, 2.0] }),
    slots: [
      { name: "seat", default: FABRIC },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 1.2,
        D = 0.4;
      return [
        rbox("seat", [W, 0.16, D], 0.05, [0, 0.4, 0]),
        ...legs("legs", W, D, 0.34, 0.05, 0.04),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.06, -d / 2 + 0.06, w - 0.12, d - 0.12, "seat")}</>
    ),
  },
  {
    id: "crib",
    name: "Crib",
    category: "bedroom",
    footprint: { width: 1.3, depth: 0.7 },
    height: 0.9,
    wallHugger: true,
    collidable: true,
    // Cribs are a fairly standard size — only a tight tolerance.
    scaling: uniformScale(0.9, 1.1),
    slots: [
      { name: "frame", default: WOOD },
      { name: "mattress", default: MATTRESS },
    ],
    build: () => {
      const W = 1.3,
        D = 0.7;
      return [
        box("frame", [W, 0.5, 0.05], [0, 0.55, D / 2 - 0.025]),
        box("frame", [W, 0.5, 0.05], [0, 0.55, -D / 2 + 0.025]),
        box("frame", [0.05, 0.5, D], [-W / 2 + 0.025, 0.55, 0]),
        box("frame", [0.05, 0.5, D], [W / 2 - 0.025, 0.55, 0]),
        box("mattress", [W - 0.12, 0.12, D - 0.12], [0, 0.42, 0]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gr(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16, "mattress")}
        {gl(-w / 4, -d / 2 + 0.05, -w / 4, d / 2 - 0.05, "s1")}
        {gl(0, -d / 2 + 0.05, 0, d / 2 - 0.05, "s2")}
        {gl(w / 4, -d / 2 + 0.05, w / 4, d / 2 - 0.05, "s3")}
      </>
    ),
  },

  // ---------------- KITCHEN / DINING ----------------
  {
    id: "counter",
    name: "Counter unit",
    category: "kitchen",
    footprint: { width: 1.2, depth: 0.6 },
    height: 0.9,
    wallHugger: true,
    collidable: true,
    surfaceTop: 0.9,
    scaling: axesScale({ x: [0.4, 4], y: [0.85, 1.2] }),
    slots: [
      { name: "body", default: solid("#d7d2c8") },
      { name: "countertop", default: STONE },
    ],
    build: () => {
      const W = 1.2,
        D = 0.6;
      return [
        box("body", [W, 0.84, D], [0, 0.42, 0]),
        box("countertop", [W + 0.04, 0.06, D + 0.04], [0, 0.87, 0]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gl(-w / 2 + 0.05, d / 2 - 0.12, w / 2 - 0.05, d / 2 - 0.12, "edge")}</>
    ),
  },
  {
    id: "upper-cabinet",
    name: "Upper cabinet",
    category: "kitchen",
    footprint: { width: 0.8, depth: 0.35 },
    height: 0.7,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.4, 3] }),
    slots: [{ name: "body", default: solid("#d7d2c8") }],
    build: () => {
      const W = 0.8,
        D = 0.35;
      // Elevated to sit above a counter (no wall-mount system yet).
      return [
        box("body", [W, 0.7, D], [0, 1.8, 0]),
        box("body", [0.02, 0.5, 0.02], [0, 1.8, D / 2 - 0.005]),
      ];
    },
    glyph: (_w, d): ReactNode => (
      <>{gl(0, -d / 2 + 0.04, 0, d / 2 - 0.04, "split")}</>
    ),
  },
  {
    id: "fridge",
    name: "Fridge",
    category: "kitchen",
    footprint: { width: 0.7, depth: 0.7 },
    height: 1.8,
    wallHugger: true,
    collidable: true,
    scaling: uniformScale(0.7, 1.5),
    slots: [{ name: "body", default: METAL }],
    build: () => {
      const W = 0.7,
        D = 0.7,
        H = 1.8;
      return [
        box("body", [W, H, D], [0, H / 2, 0]),
        box("body", [W, 0.02, 0.02], [0, 1.15, D / 2 - 0.005]), // freezer split
        box("body", [0.04, 0.5, 0.04], [W / 2 - 0.1, 1.45, D / 2 - 0.01]), // handle
      ];
    },
    glyph: (w): ReactNode => (
      <>{gl(-w / 2 + 0.05, -0.02, w / 2 - 0.05, -0.02, "split")}</>
    ),
  },
  {
    id: "microwave",
    name: "Microwave",
    category: "kitchen",
    footprint: { width: 0.5, depth: 0.35 },
    height: 0.3,
    wallHugger: false,
    collidable: false,
    stackable: true,
    scaling: noScale, // standard appliance — fixed size
    slots: [
      { name: "body", default: solid("#c9ccd1") },
      { name: "door", default: SCREEN },
    ],
    build: () => {
      const W = 0.5,
        D = 0.35,
        H = 0.3;
      return [
        box("body", [W, H, D], [0, H / 2, 0]),
        box("door", [W - 0.16, H - 0.08, 0.02], [-0.04, H / 2, D / 2 - 0.005]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.05, -d / 2 + 0.05, w - 0.22, d - 0.1, "door")}</>
    ),
  },
  {
    id: "dining-table",
    name: "Dining table",
    category: "kitchen",
    footprint: { width: 1.4, depth: 0.8 },
    height: 0.75,
    wallHugger: false,
    collidable: true,
    surfaceTop: 0.75,
    scaling: axesScale({ x: [0.5, 2.5], z: [0.6, 1.8] }),
    slots: [
      { name: "top", default: WOOD_LIGHT },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 1.4,
        D = 0.8;
      return [
        box("top", [W, 0.06, D], [0, 0.72, 0]),
        ...legs("legs", W, D, 0.69, 0.07, 0.06),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.12, -d / 2 + 0.1, w - 0.24, d - 0.2, "in")}</>
    ),
  },
  {
    id: "dining-chair",
    name: "Dining chair",
    category: "kitchen",
    footprint: { width: 0.45, depth: 0.45 },
    height: 0.9,
    wallHugger: false,
    collidable: true,
    scaling: uniformScale(0.7, 1.5),
    slots: [
      { name: "seat", default: FABRIC2 },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 0.45,
        D = 0.45;
      return [
        box("seat", [W, 0.06, D], [0, 0.45, 0]),
        box("seat", [W, 0.42, 0.06], [0, 0.66, -D / 2 + 0.03]),
        ...legs("legs", W, D, 0.45, 0.04, 0.03),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gl(-w / 2 + 0.06, -d / 2 + 0.07, w / 2 - 0.06, -d / 2 + 0.07, "back")}
      </>
    ),
  },
  {
    id: "bar-stool",
    name: "Bar stool",
    category: "kitchen",
    footprint: { width: 0.4, depth: 0.4 },
    height: 0.75,
    wallHugger: false,
    collidable: true,
    scaling: uniformScale(0.7, 1.5),
    slots: [
      { name: "seat", default: FABRIC2 },
      { name: "legs", default: METAL },
    ],
    build: () => [
      cyl("seat", 0.18, 0.06, [0, 0.72, 0]),
      cyl("legs", 0.04, 0.66, [0, 0.36, 0]),
      cyl("legs", 0.16, 0.03, [0, 0.02, 0]),
    ],
    glyph: (): ReactNode => <>{gc(0, 0, 0.17, "seat")}</>,
  },
  {
    id: "bench",
    name: "Bench",
    category: "kitchen",
    footprint: { width: 1.2, depth: 0.4 },
    height: 0.45,
    wallHugger: false,
    collidable: true,
    surfaceTop: 0.45,
    scaling: axesScale({ x: [0.5, 2.8] }),
    slots: [
      { name: "seat", default: WOOD_LIGHT },
      { name: "legs", default: WOOD_DARK },
    ],
    build: () => {
      const W = 1.2,
        D = 0.4;
      return [
        box("seat", [W, 0.06, D], [0, 0.42, 0]),
        ...legs("legs", W, D, 0.4, 0.06, 0.04),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16, "seat")}</>
    ),
  },
  {
    id: "stove",
    name: "Stove",
    category: "kitchen",
    footprint: { width: 0.6, depth: 0.6 },
    height: 0.9,
    wallHugger: true,
    collidable: true,
    // Standard range — a tight uniform tolerance only.
    scaling: uniformScale(0.85, 1.2),
    slots: [
      { name: "body", default: METAL },
      { name: "cooktop", default: SCREEN },
      { name: "controls", default: solid("#3a3d44") },
    ],
    build: () => {
      const W = 0.6,
        D = 0.6;
      return [
        box("body", [W, 0.84, D], [0, 0.42, 0]),
        box("cooktop", [W, 0.04, D], [0, 0.86, 0]),
        cyl("cooktop", 0.1, 0.02, [-0.14, 0.89, -0.14]),
        cyl("cooktop", 0.1, 0.02, [0.14, 0.89, -0.14]),
        cyl("cooktop", 0.1, 0.02, [-0.14, 0.89, 0.14]),
        cyl("cooktop", 0.1, 0.02, [0.14, 0.89, 0.14]),
        box("controls", [W - 0.06, 0.08, 0.03], [0, 0.78, D / 2 - 0.02]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gc(-w / 4, -d / 4, 0.1, "b1")}
        {gc(w / 4, -d / 4, 0.1, "b2")}
        {gc(-w / 4, d / 4, 0.1, "b3")}
        {gc(w / 4, d / 4, 0.1, "b4")}
      </>
    ),
  },
  {
    id: "dishwasher",
    name: "Dishwasher",
    category: "kitchen",
    footprint: { width: 0.6, depth: 0.6 },
    height: 0.85,
    wallHugger: true,
    collidable: true,
    scaling: uniformScale(0.9, 1.1),
    slots: [
      { name: "body", default: METAL },
      { name: "door", default: solid("#c2c6cc") },
    ],
    build: () => {
      const W = 0.6,
        D = 0.6,
        H = 0.85;
      return [
        box("body", [W, H, D], [0, H / 2, 0]),
        box("door", [W - 0.06, 0.66, 0.03], [0, 0.4, D / 2 - 0.005]),
        box("door", [0.4, 0.04, 0.04], [0, 0.78, D / 2 + 0.005]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gr(-w / 2 + 0.06, -d / 2 + 0.08, w - 0.12, d - 0.16, "door")}
        {gl(-0.18, -d / 2 + 0.1, 0.18, -d / 2 + 0.1, "handle")}
      </>
    ),
  },
  {
    id: "pantry-cabinet",
    name: "Pantry cabinet",
    category: "kitchen",
    footprint: { width: 0.6, depth: 0.6 },
    height: 2.1,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ y: [0.8, 1.2] }),
    slots: [{ name: "body", default: solid("#d7d2c8") }],
    build: () => {
      const W = 0.6,
        D = 0.6,
        H = 2.1;
      return [
        box("body", [W, H, D], [0, H / 2, 0]),
        box("body", [0.02, H - 0.1, 0.02], [0, H / 2, D / 2 - 0.005]),
        box("body", [0.04, 0.3, 0.03], [-0.06, 1.0, D / 2 - 0.005]),
        box("body", [0.04, 0.3, 0.03], [0.06, 1.1, D / 2 - 0.005]),
      ];
    },
    glyph: (_w, d): ReactNode => (
      <>
        {gl(0, -d / 2 + 0.05, 0, d / 2 - 0.05, "split")}
        {gc(-0.06, 0, 0.025, "h1")}
        {gc(0.06, 0, 0.025, "h2")}
      </>
    ),
  },
  {
    id: "kitchen-island",
    name: "Kitchen island",
    category: "kitchen",
    footprint: { width: 1.4, depth: 0.9 },
    height: 0.9,
    // A free-standing centerpiece — never hugs a wall.
    wallHugger: false,
    collidable: true,
    surfaceTop: 0.9,
    scaling: axesScale({ x: [0.6, 2.0], z: [0.6, 1.6] }),
    slots: [
      { name: "cabinet", default: solid("#d7d2c8") },
      { name: "countertop", default: STONE },
    ],
    build: () => {
      const W = 1.4,
        D = 0.9;
      return [
        box("cabinet", [W, 0.84, D], [0, 0.42, 0]),
        box("cabinet", [0.02, 0.7, 0.02], [0, 0.45, D / 2 - 0.005]),
        box("countertop", [W + 0.1, 0.06, D + 0.1], [0, 0.87, 0]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16, "top")}</>
    ),
  },

  // ---------------- BATHROOM ----------------
  {
    id: "toilet",
    name: "Toilet",
    category: "bathroom",
    footprint: { width: 0.4, depth: 0.65 },
    height: 0.78,
    wallHugger: false,
    collidable: true,
    scaling: uniformScale(0.8, 1.3),
    slots: [{ name: "body", default: PORCELAIN }],
    build: () => {
      const D = 0.65;
      return [
        box("body", [0.36, 0.5, 0.18], [0, 0.25, -D / 2 + 0.09]), // tank (back)
        cyl("body", 0.18, 0.4, [0, 0.2, 0.06]), // bowl
        cyl("body", 0.19, 0.04, [0, 0.42, 0.06]), // lid
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gc(0, 0.06, w / 2 - 0.06, "bowl")}
        {gr(-w / 2 + 0.04, -d / 2 + 0.04, w - 0.08, 0.14, "tank")}
      </>
    ),
  },
  {
    id: "sink-vanity",
    name: "Sink vanity",
    category: "bathroom",
    footprint: { width: 0.6, depth: 0.46 },
    height: 0.85,
    wallHugger: true,
    collidable: true,
    scaling: uniformScale(0.6, 1.6),
    slots: [
      { name: "cabinet", default: solid("#c8b89a") },
      { name: "basin", default: PORCELAIN },
    ],
    build: () => {
      const W = 0.6,
        D = 0.46;
      return [
        box("cabinet", [W, 0.78, D], [0, 0.39, 0]),
        box("basin", [W, 0.1, D], [0, 0.83, 0]),
        cyl("basin", 0.14, 0.04, [0, 0.9, 0.02]),
      ];
    },
    glyph: (): ReactNode => <>{gc(0, 0.02, 0.13, "basin")}</>,
  },
  {
    id: "bathtub",
    name: "Bathtub",
    category: "bathroom",
    footprint: { width: 1.6, depth: 0.75 },
    height: 0.55,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.8, 1.6], z: [0.85, 1.3] }),
    slots: [{ name: "body", default: PORCELAIN }],
    build: () => {
      const W = 1.6,
        D = 0.75;
      return [
        rbox("body", [W, 0.5, D], 0.12, [0, 0.25, 0]),
        box("body", [W - 0.2, 0.06, D - 0.18], [0, 0.46, 0]), // inner rim/water
      ];
    },
    glyph: (w, d): ReactNode => (
      <>{gr(-w / 2 + 0.1, -d / 2 + 0.09, w - 0.2, d - 0.18, "inner")}</>
    ),
  },
  {
    id: "shower-stall",
    name: "Shower stall",
    category: "bathroom",
    footprint: { width: 0.9, depth: 0.9 },
    height: 2.0,
    wallHugger: true,
    collidable: true,
    scaling: axesScale({ x: [0.6, 1.8], z: [0.6, 1.8] }),
    slots: [
      { name: "tray", default: PORCELAIN },
      { name: "glass", default: GLASS },
    ],
    build: () => {
      const W = 0.9,
        D = 0.9;
      return [
        box("tray", [W, 0.08, D], [0, 0.04, 0]),
        box("glass", [0.03, 1.9, D], [W / 2 - 0.015, 0.99, 0]), // side panel
        box("glass", [W, 1.9, 0.03], [0, 0.99, D / 2 - 0.015]), // front panel
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gr(-w / 2 + 0.04, -d / 2 + 0.04, w - 0.08, d - 0.08, "tray")}
        {gc(-w / 2 + 0.18, -d / 2 + 0.18, 0.05, "drain")}
      </>
    ),
  },
  {
    id: "towel-rack",
    name: "Towel rack",
    category: "bathroom",
    footprint: { width: 0.6, depth: 0.12 },
    height: 0.3,
    wallHugger: true,
    collidable: false,
    scaling: axesScale({ x: [0.5, 2.5] }),
    slots: [{ name: "body", default: METAL }],
    build: () => {
      const W = 0.6;
      // Elevated wall bar with two brackets.
      return [
        cyl("body", 0.015, W, [0, 1.1, 0.04], [0, 0, Math.PI / 2]),
        box("body", [0.03, 0.03, 0.1], [-W / 2 + 0.04, 1.1, -0.01]),
        box("body", [0.03, 0.03, 0.1], [W / 2 - 0.04, 1.1, -0.01]),
      ];
    },
    glyph: (w): ReactNode => (
      <>{gl(-w / 2 + 0.04, 0, w / 2 - 0.04, 0, "bar")}</>
    ),
  },
  {
    id: "bathroom-cabinet",
    name: "Bathroom cabinet",
    category: "bathroom",
    footprint: { width: 0.6, depth: 0.18 },
    height: 0.7,
    wallHugger: true,
    collidable: false,
    scaling: axesScale({ x: [0.5, 2.2] }),
    slots: [{ name: "body", default: solid("#d7d2c8") }],
    build: () => {
      const W = 0.6,
        D = 0.18;
      // Elevated medicine cabinet.
      return [
        box("body", [W, 0.7, D], [0, 1.7, 0]),
        box("body", [0.02, 0.5, 0.02], [0, 1.7, D / 2 - 0.005]),
      ];
    },
    glyph: (_w, d): ReactNode => (
      <>{gl(0, -d / 2 + 0.03, 0, d / 2 - 0.03, "split")}</>
    ),
  },
  {
    id: "bidet",
    name: "Bidet",
    category: "bathroom",
    footprint: { width: 0.38, depth: 0.6 },
    height: 0.4,
    wallHugger: true,
    collidable: true,
    scaling: uniformScale(0.85, 1.15),
    slots: [{ name: "body", default: PORCELAIN }],
    build: () => {
      const D = 0.6;
      return [
        box("body", [0.18, 0.36, 0.2], [0, 0.18, -D / 2 + 0.12]), // pedestal
        cyl("body", 0.16, 0.34, [0, 0.2, 0.06]), // bowl
        cyl("body", 0.17, 0.04, [0, 0.39, 0.06]), // rim
      ];
    },
    glyph: (w): ReactNode => (
      <>
        {gc(0, 0.06, w / 2 - 0.04, "bowl")}
        {gc(0, 0.06, 0.05, "jet")}
      </>
    ),
  },

  // ---------------- OFFICE ----------------
  {
    id: "desk",
    name: "Desk",
    category: "office",
    footprint: { width: 1.4, depth: 0.7 },
    height: 0.75,
    wallHugger: true,
    collidable: true,
    surfaceTop: 0.75,
    scaling: axesScale({ x: [0.6, 1.8] }),
    slots: [
      { name: "top", default: WOOD_LIGHT },
      { name: "legs", default: METAL },
    ],
    build: () => {
      const W = 1.4,
        D = 0.7;
      return [
        box("top", [W, 0.05, D], [0, 0.72, 0]),
        ...legs("legs", W, D, 0.7, 0.06, 0.05),
        box("legs", [W - 0.2, 0.3, 0.03], [0, 0.52, -D / 2 + 0.05]), // modesty
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gr(-w / 2 + 0.08, -d / 2 + 0.08, w - 0.16, d - 0.16, "top")}
        {gl(-w / 2 + 0.1, -d / 2 + 0.07, w / 2 - 0.1, -d / 2 + 0.07, "back")}
      </>
    ),
  },
  {
    id: "office-chair",
    name: "Office chair",
    category: "office",
    footprint: { width: 0.6, depth: 0.6 },
    height: 1.0,
    wallHugger: false,
    collidable: true,
    scaling: uniformScale(0.8, 1.3),
    slots: [
      { name: "seat", default: FABRIC2 },
      { name: "back", default: FABRIC2 },
      { name: "base", default: solid("#2b2e35") },
    ],
    build: () => {
      const D = 0.6;
      return [
        box("seat", [0.48, 0.1, 0.46], [0, 0.48, 0.04]),
        box("back", [0.46, 0.5, 0.07], [0, 0.74, -D / 2 + 0.06]),
        cyl("base", 0.03, 0.42, [0, 0.26, 0]), // gas column
        cyl("base", 0.28, 0.04, [0, 0.04, 0]), // 5-star base
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gc(0, 0.04, 0.18, "seat")}
        {gl(-0.18, -d / 2 + 0.07, 0.18, -d / 2 + 0.07, "back")}
        {gl(-w / 2 + 0.08, -d / 2 + 0.08, w / 2 - 0.08, d / 2 - 0.08, "x1")}
        {gl(-w / 2 + 0.08, d / 2 - 0.08, w / 2 - 0.08, -d / 2 + 0.08, "x2")}
      </>
    ),
  },
  {
    id: "filing-cabinet",
    name: "Filing cabinet",
    category: "office",
    footprint: { width: 0.45, depth: 0.6 },
    height: 0.72,
    wallHugger: true,
    collidable: true,
    surfaceTop: 0.72,
    // Two-drawer up to a tall multi-drawer unit — height flexes.
    scaling: axesScale({ y: [0.8, 2.0] }),
    slots: [
      { name: "body", default: METAL },
      { name: "drawers", default: solid("#b0b4ba") },
    ],
    build: () => {
      const W = 0.45,
        D = 0.6,
        H = 0.72;
      return [
        box("body", [W, H, D], [0, H / 2, 0]),
        box("drawers", [W - 0.06, 0.3, 0.02], [0, 0.52, D / 2 - 0.005]),
        box("drawers", [W - 0.06, 0.3, 0.02], [0, 0.19, D / 2 - 0.005]),
        box("drawers", [0.14, 0.03, 0.03], [0, 0.52, D / 2 + 0.005]),
        box("drawers", [0.14, 0.03, 0.03], [0, 0.19, D / 2 + 0.005]),
      ];
    },
    glyph: (w, d): ReactNode => (
      <>
        {gl(-w / 2 + 0.06, -d / 6, w / 2 - 0.06, -d / 6, "d1")}
        {gl(-w / 2 + 0.06, d / 6, w / 2 - 0.06, d / 6, "d2")}
        {gc(0, -d / 6 + 0.09, 0.022, "h1")}
        {gc(0, d / 6 + 0.09, 0.022, "h2")}
      </>
    ),
  },
  {
    id: "desk-lamp",
    name: "Desk lamp",
    category: "office",
    footprint: { width: 0.25, depth: 0.25 },
    height: 0.5,
    wallHugger: false,
    // Decor/surface item like the other lamps — never collides; rests on desks.
    collidable: false,
    stackable: true,
    scaling: uniformScale(0.7, 1.4),
    slots: [
      { name: "base", default: METAL },
      { name: "arm", default: METAL },
      { name: "shade", default: SHADE },
    ],
    build: () => [
      cyl("base", 0.09, 0.03, [0, 0.015, 0]),
      cyl("arm", 0.015, 0.4, [0, 0.22, 0]),
      cyl("arm", 0.015, 0.2, [0.07, 0.43, 0], [0, 0, -Math.PI / 4]),
      cyl("shade", 0.07, 0.1, [0.15, 0.46, 0], [Math.PI / 2, 0, Math.PI / 4]),
    ],
    glyph: (): ReactNode => (
      <>
        {gc(0, 0, 0.08, "base")}
        {gc(0.06, -0.03, 0.05, "shade")}
        {gl(0, 0, 0.06, -0.03, "arm")}
      </>
    ),
  },
];
