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

  it("leaves an already-current design unchanged", () => {
    const v2 = migrateToLatest(structuredClone(V1_FIXTURE));
    const again = migrateToLatest(
      structuredClone(v2) as unknown as Record<string, unknown>,
    );
    expect(again).toEqual(v2);
  });
});
