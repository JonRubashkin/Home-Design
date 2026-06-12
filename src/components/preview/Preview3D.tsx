import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Walls3D } from "./Walls3D";
import { Floors3D } from "./Floors3D";
import { CameraController } from "./CameraController";
import { ViewModeBar } from "./ViewModeBar";

function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#1a1d27" roughness={1} metalness={0} />
      </mesh>
      <Grid
        args={[600, 600]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#2b3142"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3c4358"
        fadeDistance={90}
        fadeStrength={1.5}
        infiniteGrid
        position={[0, 0, 0]}
      />
    </>
  );
}

export function Preview3D() {
  const [fitNonce, setFitNonce] = useState(0);

  return (
    <div className="preview">
      <ViewModeBar onFit={() => setFitNonce((n) => n + 1)} />
      <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#0f1117"]} />
        <OrthographicCamera
          makeDefault
          position={[24, 20, 24]}
          zoom={36}
          near={0.1}
          far={5000}
        />
        <ambientLight intensity={0.75} />
        <directionalLight position={[18, 30, 12]} intensity={0.9} />
        <Ground />
        <Floors3D />
        <Walls3D />
        <CameraController fitNonce={fitNonce} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.12}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minZoom={2}
          maxZoom={400}
        />
      </Canvas>
    </div>
  );
}
