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
// builder reads correctly.
const COLS = 4;
const SPACING = 2.8;

export function CatalogQA() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#11141b" }}>
      <Canvas flat dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#11141b"]} />
        <OrthographicCamera
          makeDefault
          position={[14, 14, 14]}
          zoom={48}
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
        {CATALOG_ITEMS.map((entry, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const x = (col - (COLS - 1) / 2) * SPACING;
          const z = (row - 1.5) * SPACING;
          const item = createFurniture(entry.id, { x, y: z });
          return (
            <group key={entry.id}>
              <FurniturePiece item={item} elevation={0} selected={false} />
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
                {entry.name}
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
