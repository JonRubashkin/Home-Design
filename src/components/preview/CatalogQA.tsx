import { Canvas } from "@react-three/fiber";
import {
  Grid,
  Html,
  OrbitControls,
  OrthographicCamera,
} from "@react-three/drei";
import { CATALOG_ITEMS } from "../../catalog";
import { createFurniture } from "../../model/defaults";
import { FurniturePiece } from "./FurniturePiece";

// Dev-only QA view (open with #catalog in the URL): every catalog item laid out
// in a grid in 3D with default materials, for checking proportions and that each
// builder reads correctly. Variant-bearing items (trees, shrubs) appear once per
// variant so every shape can be eyeballed.
const COLS = 6;
const SPACING = 2.8;

interface QAEntry {
  entry: (typeof CATALOG_ITEMS)[number];
  variant: string | undefined;
  key: string;
  label: string;
}

const QA_ENTRIES: QAEntry[] = CATALOG_ITEMS.flatMap((entry): QAEntry[] =>
  entry.variants && entry.variants.length > 0
    ? entry.variants.map((v) => ({
        entry,
        variant: v.id,
        key: `${entry.id}:${v.id}`,
        label: `${entry.name} — ${v.name}`,
      }))
    : [{ entry, variant: undefined, key: entry.id, label: entry.name }],
);

export function CatalogQA() {
  const rows = Math.ceil(QA_ENTRIES.length / COLS);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#11141b" }}>
      <Canvas flat dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#11141b"]} />
        <OrthographicCamera
          makeDefault
          position={[20, 20, 20]}
          zoom={34}
          near={0.1}
          far={500}
        />
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 8]} intensity={0.5} />
        <Grid
          args={[60, 60]}
          cellSize={1}
          cellColor="#2b3142"
          sectionSize={5}
          sectionColor="#3c4358"
          infiniteGrid
          fadeDistance={60}
        />
        {QA_ENTRIES.map(({ entry, variant, key, label }, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const x = (col - (COLS - 1) / 2) * SPACING;
          const z = (row - (rows - 1) / 2) * SPACING;
          const item = createFurniture(entry.id, { x, y: z }, { variant });
          // Wall items have no floor; float them at their mount height so the
          // build reads at a sensible elevation (centered on defaultMountHeight).
          const elevation =
            entry.mount === "wall"
              ? (entry.defaultMountHeight ?? 1.5) - entry.height / 2
              : 0;
          return (
            <group key={key}>
              <FurniturePiece
                item={item}
                elevation={elevation}
                selected={false}
              />
              <Html
                position={[x, 0, z + entry.footprint.depth / 2 + 0.35]}
                center
                style={{
                  color: "#cdd3e0",
                  font: "12px system-ui",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {label}
              </Html>
            </group>
          );
        })}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.04} />
      </Canvas>
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          color: "#9aa1b2",
          font: "13px system-ui",
        }}
      >
        Catalog QA — drag to orbit · remove #catalog from the URL to return
      </div>
    </div>
  );
}
