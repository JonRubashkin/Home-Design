import { useMemo } from "react";
import type { MaterialRef, Wall } from "../../model/types";
import { wallToBoxes, windowGlassBox } from "../../geometry/boxes";
import { patternTextureSized } from "../../materials/textures";
import { PATTERN_TILE_METERS } from "../../materials/patterns";

const NEUTRAL_TOP = "#d8d4cc";
const NEUTRAL_END = "#c4bfb5";
const SELECT_EMISSIVE = "#2563eb";
const GLASS_COLOR = "#bcd4e6";

const solid = (color: string): MaterialRef => ({ kind: "solid", color });

interface Props {
  wall: Wall;
  elevation: number;
  selected: boolean;
  stub: boolean;
  ghost: boolean;
}

// One BoxGeometry face material. Solid materials use a color; patterns use a
// repeating texture sized to the face (width/height in meters).
function FaceMaterial({
  attach,
  material,
  width,
  height,
  selected,
  ghost,
}: {
  attach: string;
  material: MaterialRef;
  width: number;
  height: number;
  selected: boolean;
  ghost: boolean;
}) {
  const common = {
    roughness: 0.92,
    metalness: 0,
    emissive: selected ? SELECT_EMISSIVE : "#000000",
    emissiveIntensity: selected ? 0.4 : 0,
    transparent: ghost,
    opacity: ghost ? 0.15 : 1,
    depthWrite: !ghost,
  };
  if (material.kind === "solid") {
    return (
      <meshStandardMaterial
        attach={attach}
        color={material.color}
        {...common}
      />
    );
  }
  const tex = patternTextureSized(
    material,
    width / PATTERN_TILE_METERS,
    height / PATTERN_TILE_METERS,
  );
  return (
    <meshStandardMaterial
      attach={attach}
      map={tex}
      color="#ffffff"
      {...common}
    />
  );
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

  return (
    <group renderOrder={ghost ? 2 : 0}>
      {boxes.map((b, i) => {
        // Face order: +X, -X (ends), +Y (top), -Y (bottom), +Z (side B), -Z (side A).
        const [len, hgt] = b.size;
        return (
          <mesh
            key={i}
            position={b.center}
            rotation={[0, b.rotationY, 0]}
            renderOrder={ghost ? 2 : 0}
          >
            <boxGeometry args={b.size} />
            <FaceMaterial
              attach="material-0"
              material={solid(NEUTRAL_END)}
              width={1}
              height={1}
              selected={selected}
              ghost={ghost}
            />
            <FaceMaterial
              attach="material-1"
              material={solid(NEUTRAL_END)}
              width={1}
              height={1}
              selected={selected}
              ghost={ghost}
            />
            <FaceMaterial
              attach="material-2"
              material={solid(NEUTRAL_TOP)}
              width={1}
              height={1}
              selected={selected}
              ghost={ghost}
            />
            <FaceMaterial
              attach="material-3"
              material={solid(NEUTRAL_END)}
              width={1}
              height={1}
              selected={selected}
              ghost={ghost}
            />
            <FaceMaterial
              attach="material-4"
              material={wall.paintB}
              width={len}
              height={hgt}
              selected={selected}
              ghost={ghost}
            />
            <FaceMaterial
              attach="material-5"
              material={wall.paintA}
              width={len}
              height={hgt}
              selected={selected}
              ghost={ghost}
            />
          </mesh>
        );
      })}

      {/* Translucent glass panes (not in stub mode). */}
      {!stub &&
        wall.windows.map((win) => {
          const g = windowGlassBox(wall, win, elevation);
          return (
            <mesh
              key={win.id}
              position={g.center}
              rotation={[0, g.rotationY, 0]}
              renderOrder={3}
            >
              <boxGeometry args={g.size} />
              <meshStandardMaterial
                color={GLASS_COLOR}
                transparent
                opacity={ghost ? 0.12 : 0.28}
                depthWrite={false}
                roughness={0.1}
                metalness={0}
              />
            </mesh>
          );
        })}
    </group>
  );
}
