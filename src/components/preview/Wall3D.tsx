import { useMemo } from "react";
import type { MaterialRef, Wall } from "../../model/types";
import { wallToBoxes } from "../../geometry/boxes";

// Neutral tones for the faces that aren't painted sides (top / ends / bottom).
const NEUTRAL_TOP = "#d8d4cc";
const NEUTRAL_END = "#c4bfb5";
const SELECT_EMISSIVE = "#2563eb";

function solidColor(ref: MaterialRef): string {
  // Phase 1c introduces patterns; until then fall back to the primary color.
  return ref.kind === "solid" ? ref.color : ref.colorA;
}

interface Props {
  wall: Wall;
  elevation: number;
  selected: boolean;
  stub: boolean;
  ghost: boolean;
}

export function Wall3D({ wall, elevation, selected, stub, ghost }: Props) {
  const boxes = useMemo(() => {
    if (stub) {
      // Stubs render every wall at 10% height; windows never show here.
      return wallToBoxes(
        { ...wall, height: wall.height * 0.1, windows: [] },
        elevation,
      );
    }
    return wallToBoxes(wall, elevation);
  }, [wall, elevation, stub]);

  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z. Local +Z faces side B,
  // local -Z faces side A (see boxes.ts rotation derivation).
  const faceColors = useMemo(
    () => [
      NEUTRAL_END,
      NEUTRAL_END,
      NEUTRAL_TOP,
      NEUTRAL_END,
      solidColor(wall.paintB),
      solidColor(wall.paintA),
    ],
    [wall.paintA, wall.paintB],
  );

  return (
    <group renderOrder={ghost ? 2 : 0}>
      {boxes.map((b, i) => (
        <mesh
          key={i}
          position={b.center}
          rotation={[0, b.rotationY, 0]}
          renderOrder={ghost ? 2 : 0}
        >
          <boxGeometry args={b.size} />
          {faceColors.map((color, f) => (
            <meshStandardMaterial
              key={f}
              attach={`material-${f}`}
              color={color}
              roughness={0.92}
              metalness={0}
              emissive={selected ? SELECT_EMISSIVE : "#000000"}
              emissiveIntensity={selected ? 0.45 : 0}
              transparent={ghost}
              opacity={ghost ? 0.15 : 1}
              depthWrite={!ghost}
            />
          ))}
        </mesh>
      ))}
    </group>
  );
}
