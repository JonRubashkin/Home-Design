import { useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Walls3D } from "./Walls3D";
import { Floors3D } from "./Floors3D";
import { Furniture3D } from "./Furniture3D";
import { CameraController } from "./CameraController";
import { ViewModeBar } from "./ViewModeBar";
import { GROUND_Y } from "./stacking";

// Guard the sRGB pipeline regardless of R3F/three version quirks: hex colors are
// interpreted as sRGB and converted to linear for lighting.
THREE.ColorManagement.enabled = true;

function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]}>
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
      <Canvas
        flat
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          // `flat` disables R3F's default ACES tone mapping so flat material
          // colors render colorimetrically and match their swatch + the 2D plan
          // fill. Keep sRGB output explicit (R3F sets the removed `outputEncoding`).
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#0f1117"]} />
        <OrthographicCamera
          makeDefault
          position={[24, 20, 24]}
          zoom={36}
          near={0.1}
          far={5000}
        />
        {/* Lighting kept near unit irradiance on up-facing surfaces (no tone
            mapping) so albedos read at their swatch value. */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[18, 30, 12]} intensity={0.45} />
        <Ground />
        <Floors3D />
        <Walls3D />
        <Furniture3D />
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
