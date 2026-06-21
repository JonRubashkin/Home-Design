import { describe, it, expect } from "vitest";
import { migrateToLatest, LATEST_SCHEMA_VERSION } from "./migrations";

// A design saved before doors existed (schema v1): walls have no `doors`.
const V1_FIXTURE = {
  schemaVersion: 1,
  name: "Old design",
  levels: [
    {
      id: "lvl",
      name: "Ground floor",
      elevation: 0,
      wallHeight: 2.4,
      walls: [
        {
          id: "w1",
          start: { x: 0, y: 0 },
          end: { x: 4, y: 0 },
          height: 2.4,
          thickness: 0.15,
          paintA: { kind: "solid", color: "#e8e4dc" },
          paintB: { kind: "solid", color: "#e8e4dc" },
          windows: [
            { id: "win", t: 0.5, width: 1.2, height: 1.2, sillHeight: 0.9 },
          ],
        },
      ],
      floors: [],
    },
  ],
};

describe("migrateToLatest", () => {
  it("upgrades a v1 design to the latest version", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it("adds an empty doors array to every wall (v1 -> v2)", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    const wall = out.levels[0]!.walls[0]!;
    expect(wall.doors).toEqual([]);
    // existing data is preserved
    expect(wall.windows).toHaveLength(1);
  });

  it("adds an empty furniture array to every level (-> v3)", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    expect(out.levels[0]!.furniture).toEqual([]);
  });

  it("migrates a v2 design (doors present) to v3 with furniture", () => {
    const v2 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v2.schemaVersion = 2;
    (v2.levels as Record<string, unknown>[])[0]!.walls = [];
    const out = migrateToLatest(v2);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(out.levels[0]!.furniture).toEqual([]);
  });

  it("adds a unit scale to every furniture item (v3 -> v4)", () => {
    const v3 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v3.schemaVersion = 3;
    (v3.levels as Record<string, unknown>[])[0]!.furniture = [
      { id: "f", catalogId: "sofa-3seat", position: { x: 1, y: 1 }, rotation: 0, materials: {} },
    ];
    const out = migrateToLatest(v3);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(out.levels[0]!.furniture[0]!.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("adds an empty staircases array to every level (-> v6)", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    expect(out.levels[0]!.staircases).toEqual([]);
  });

  it("gives an older design a default large site (-> v5)", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    expect(out.site.width).toBeCloseTo(Math.sqrt(1000), 3);
    expect(out.site.depth).toBeCloseTo(Math.sqrt(1000), 3);
    // a design already carrying a custom site keeps it
    const v4 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v4.schemaVersion = 4;
    v4.site = { width: 12, depth: 8 };
    const kept = migrateToLatest(v4);
    expect(kept.site).toEqual({ width: 12, depth: 8 });
  });

  it("maps pre-4c tree/hedge items to a default variant (v6 -> v7)", () => {
    const v6 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v6.schemaVersion = 6;
    (v6.levels as Record<string, unknown>[])[0]!.staircases = [];
    (v6.levels as Record<string, unknown>[])[0]!.furniture = [
      {
        id: "t",
        catalogId: "tree",
        position: { x: 1, y: 1 },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        materials: {},
      },
      {
        id: "h",
        catalogId: "hedge",
        position: { x: 2, y: 2 },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        materials: {},
      },
      {
        id: "s",
        catalogId: "sofa-3seat",
        position: { x: 3, y: 3 },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        materials: {},
      },
    ];
    const out = migrateToLatest(v6);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    const furn = out.levels[0]!.furniture;
    expect(furn[0]!.variant).toBe("broadleaf");
    // Hedge maps to spreading and widens to preserve its old footprint width
    // (old 1.5 / new 0.8 ≈ 1.875).
    expect(furn[1]!.variant).toBe("spreading");
    expect(furn[1]!.scale.x).toBeCloseTo(1.875, 3);
    // Non-variant items are untouched.
    expect(furn[2]!.variant).toBeUndefined();
  });

  it("adds an empty mounts array to every wall (v7 -> v8)", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    expect(out.levels[0]!.walls[0]!.mounts).toEqual([]);
  });

  it("migrates a v7 design (variants present) to v8 with wall mounts", () => {
    const v7 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v7.schemaVersion = 7;
    const lvl = (v7.levels as Record<string, unknown>[])[0]!;
    lvl.staircases = [];
    lvl.furniture = [];
    // a v7 wall already has windows/doors but no mounts
    (lvl.walls as Record<string, unknown>[])[0]!.doors = [];
    const out = migrateToLatest(v7);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(out.levels[0]!.walls[0]!.mounts).toEqual([]);
  });

  it("adds an empty ceilingLights array to every level (-> v10)", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    expect(out.levels[0]!.ceilingLights).toEqual([]);
  });

  it("adds an empty roofs array to every level and drops Design.roof", () => {
    const out = migrateToLatest(structuredClone(V1_FIXTURE));
    expect(out.levels[0]!.roofs).toEqual([]);
    expect((out as unknown as Record<string, unknown>).roof).toBeUndefined();
  });

  it("clears auto-generated roofs to [] on every level (v11 -> v12, manual roofs)", () => {
    // A v11 design with auto-generated (anchor-based) roof sections.
    const v11 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v11.schemaVersion = 11;
    const lvl = (v11.levels as Record<string, unknown>[])[0]!;
    lvl.staircases = [];
    lvl.furniture = [];
    lvl.ceilingLights = [];
    (lvl.walls as Record<string, unknown>[])[0]!.doors = [];
    (lvl.walls as Record<string, unknown>[])[0]!.mounts = [];
    lvl.roofs = [
      {
        id: "old",
        anchor: { x: 2, y: 0 },
        type: "hipped",
        pitch: 25,
        overhang: 0.5,
        visible: true,
        material: { kind: "solid", color: "#8a5a44" },
      },
    ];
    const out = migrateToLatest(v11);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    // The unsatisfactory auto output is cleared; the user re-places roofs.
    expect(out.levels[0]!.roofs).toEqual([]);
  });

  it("gives every door style 'single' (v12 -> v13)", () => {
    // A v12 design whose wall already carries a door without a `style` field.
    const v12 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v12.schemaVersion = 12;
    const lvl = (v12.levels as Record<string, unknown>[])[0]!;
    lvl.staircases = [];
    lvl.furniture = [];
    lvl.ceilingLights = [];
    lvl.roofs = [];
    const wall = (lvl.walls as Record<string, unknown>[])[0]!;
    wall.mounts = [];
    wall.doors = [
      {
        id: "d",
        t: 0.5,
        width: 0.9,
        height: 2.0,
        hinge: "start",
        swing: "A",
        material: { kind: "solid", color: "#9a6b4f" },
      },
    ];
    const out = migrateToLatest(v12);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(out.levels[0]!.walls[0]!.doors[0]!.style).toBe("single");
  });

  it("migrates a styleless window through to 'picture' + a muntin color", () => {
    // A v13 design whose wall carries a window without a `style` field: it picks
    // up style "plain" at v14, then becomes "picture" with a muntin color at v15.
    const v13 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v13.schemaVersion = 13;
    const lvl = (v13.levels as Record<string, unknown>[])[0]!;
    lvl.staircases = [];
    lvl.furniture = [];
    lvl.ceilingLights = [];
    lvl.roofs = [];
    const wall = (lvl.walls as Record<string, unknown>[])[0]!;
    wall.mounts = [];
    wall.doors = [];
    const out = migrateToLatest(v13);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    const win = out.levels[0]!.walls[0]!.windows[0]!;
    expect(win.style).toBe("picture");
    expect(win.muntinMaterial).toEqual({ kind: "solid", color: "#eef0f2" });
  });

  it("converts a v14 'plain' window to 'picture' and adds a muntin color (v14 -> v15)", () => {
    const v14 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v14.schemaVersion = 14;
    const lvl = (v14.levels as Record<string, unknown>[])[0]!;
    lvl.staircases = [];
    lvl.furniture = [];
    lvl.ceilingLights = [];
    lvl.roofs = [];
    const wall = (lvl.walls as Record<string, unknown>[])[0]!;
    wall.mounts = [];
    wall.doors = [];
    // a v14 window already carries style "plain" but no muntin color
    (wall.windows as Record<string, unknown>[])[0]!.style = "plain";
    const out = migrateToLatest(v14);
    expect(out.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    const win = out.levels[0]!.walls[0]!.windows[0]!;
    expect(win.style).toBe("picture");
    expect(win.muntinMaterial).toEqual({ kind: "solid", color: "#eef0f2" });
  });

  it("keeps a v14 'grid' window's style and just adds a muntin color", () => {
    const v14 = structuredClone(V1_FIXTURE) as Record<string, unknown>;
    v14.schemaVersion = 14;
    const lvl = (v14.levels as Record<string, unknown>[])[0]!;
    lvl.staircases = [];
    lvl.furniture = [];
    lvl.ceilingLights = [];
    lvl.roofs = [];
    const wall = (lvl.walls as Record<string, unknown>[])[0]!;
    wall.mounts = [];
    wall.doors = [];
    (wall.windows as Record<string, unknown>[])[0]!.style = "grid";
    const out = migrateToLatest(v14);
    const win = out.levels[0]!.walls[0]!.windows[0]!;
    expect(win.style).toBe("grid");
    expect(win.muntinMaterial).toEqual({ kind: "solid", color: "#eef0f2" });
  });

  it("leaves an already-current design unchanged", () => {
    const v2 = migrateToLatest(structuredClone(V1_FIXTURE));
    const again = migrateToLatest(
      structuredClone(v2) as unknown as Record<string, unknown>,
    );
    expect(again).toEqual(v2);
  });
});
