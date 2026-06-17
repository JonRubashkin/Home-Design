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

  it("leaves an already-current design unchanged", () => {
    const v2 = migrateToLatest(structuredClone(V1_FIXTURE));
    const again = migrateToLatest(
      structuredClone(v2) as unknown as Record<string, unknown>,
    );
    expect(again).toEqual(v2);
  });
});
