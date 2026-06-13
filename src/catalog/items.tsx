import type { ReactNode } from "react";
import type { CatalogEntry } from "./types";
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
    flat: true,
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

  // ---------------- BEDROOM ----------------
  {
    id: "bed-double",
    name: "Double bed",
    category: "bedroom",
    footprint: { width: 1.6, depth: 2.1 },
    height: 0.6,
    wallHugger: true,
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
    id: "nightstand",
    name: "Nightstand",
    category: "bedroom",
    footprint: { width: 0.45, depth: 0.4 },
    height: 0.5,
    wallHugger: false,
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

  // ---------------- KITCHEN ----------------
  {
    id: "counter",
    name: "Counter unit",
    category: "kitchen",
    footprint: { width: 1.2, depth: 0.6 },
    height: 0.9,
    wallHugger: true,
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
    id: "fridge",
    name: "Fridge",
    category: "kitchen",
    footprint: { width: 0.7, depth: 0.7 },
    height: 1.8,
    wallHugger: true,
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
    id: "dining-table",
    name: "Dining table",
    category: "kitchen",
    footprint: { width: 1.4, depth: 0.8 },
    height: 0.75,
    wallHugger: false,
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

  // ---------------- BATHROOM ----------------
  {
    id: "toilet",
    name: "Toilet",
    category: "bathroom",
    footprint: { width: 0.4, depth: 0.65 },
    height: 0.78,
    wallHugger: false,
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
];
