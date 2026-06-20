import { useMemo } from "react";
import type { MaterialRef, Wall } from "../../model/types";
import {
  wallToBoxes,
  windowGlassBox,
  doorFrameBoxes,
  doorLeafBox,
  doubleDoorLeafBoxes,
  slidingDoorBoxes,
  windowMuntinBoxes,
  type Box3Spec,
} from "../../geometry/boxes";
import { faceTextureTransform } from "../../materials/faceUV";
import { PATTERN_TILE_METERS } from "../../materials/patterns";
import { useThreeMaterial } from "../../materials/threeMaterial";
import { WallMount3D } from "./WallMount3D";

const NEUTRAL_TOP: MaterialRef = { kind: "solid", color: "#d8d4cc" };
const NEUTRAL_END: MaterialRef = { kind: "solid", color: "#c4bfb5" };
const DOOR_TRIM: MaterialRef = { kind: "solid", color: "#d9d2c6" };
const WINDOW_FRAME: MaterialRef = { kind: "solid", color: "#eef0f2" };
const GLASS_COLOR = "#bcd4e6";

// A box with a single material on every face (door frame trim and leaf).
function SolidBoxMesh({
  box,
  material,
  repeat,
  offset,
  selected,
  ghost,
}: {
  box: Box3Spec;
  material: MaterialRef;
  repeat?: [number, number];
  offset?: [number, number];
  selected: boolean;
  ghost: boolean;
}) {
  const mat = useThreeMaterial(
    material,
    { repeat, offset },
    { selected, ghost },
  );
  return (
    <mesh
      position={box.center}
      rotation={[0, box.rotationY, 0]}
      renderOrder={ghost ? 2 : 0}
    >
      <boxGeometry args={box.size} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

interface Props {
  wall: Wall;
  elevation: number;
  selected: boolean;
  stub: boolean;
  ghost: boolean;
  // The selected wall-mount id (if a mount on this wall is selected).
  selectedMountId?: string | null;
  // Extend the wall downward by this much (the floor-slab thickness) so an upper
  // level's walls meet the lower level's wall tops — no floor band shows between
  // storeys. 0 = no skirt (ground level / stubs).
  skirt?: number;
}

// One box face: solid or world-anchored pattern, built by the shared factory.
function BoxFace({
  attach,
  material,
  repeat,
  offset,
  selected,
  ghost,
}: {
  attach: string;
  material: MaterialRef;
  repeat?: [number, number];
  offset?: [number, number];
  selected: boolean;
  ghost: boolean;
}) {
  const mat = useThreeMaterial(
    material,
    { repeat, offset },
    { selected, ghost },
  );
  return <primitive object={mat} attach={attach} />;
}

// One wall sub-box. Side B is the +Z face (material-4), side A the -Z face
// (material-5); each painted face is textured so the pattern flows continuously
// across all of a wall's sub-boxes (piers, under-sill, over-head).
function WallBox({
  box,
  paintA,
  paintB,
  selected,
  ghost,
}: {
  box: Box3Spec;
  paintA: MaterialRef;
  paintB: MaterialRef;
  selected: boolean;
  ghost: boolean;
}) {
  const tB = faceTextureTransform(box.face, PATTERN_TILE_METERS, false);
  const tA = faceTextureTransform(box.face, PATTERN_TILE_METERS, true);
  return (
    <mesh
      position={box.center}
      rotation={[0, box.rotationY, 0]}
      renderOrder={ghost ? 2 : 0}
    >
      <boxGeometry args={box.size} />
      <BoxFace
        attach="material-0"
        material={NEUTRAL_END}
        selected={selected}
        ghost={ghost}
      />
      <BoxFace
        attach="material-1"
        material={NEUTRAL_END}
        selected={selected}
        ghost={ghost}
      />
      <BoxFace
        attach="material-2"
        material={NEUTRAL_TOP}
        selected={selected}
        ghost={ghost}
      />
      <BoxFace
        attach="material-3"
        material={NEUTRAL_END}
        selected={selected}
        ghost={ghost}
      />
      <BoxFace
        attach="material-4"
        material={paintB}
        repeat={tB.repeat}
        offset={tB.offset}
        selected={selected}
        ghost={ghost}
      />
      <BoxFace
        attach="material-5"
        material={paintA}
        repeat={tA.repeat}
        offset={tA.offset}
        selected={selected}
        ghost={ghost}
      />
    </mesh>
  );
}

export function Wall3D({
  wall,
  elevation,
  selected,
  stub,
  ghost,
  selectedMountId = null,
  skirt = 0,
}: Props) {
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

  // A solid band below the floor (full wall footprint, no openings) that bridges
  // the slab gap to the lower level's wall tops. Skipped in stub mode.
  const skirtBoxes = useMemo(() => {
    if (stub || skirt <= 0) return [];
    return wallToBoxes(
      { ...wall, height: skirt, windows: [], doors: [] },
      elevation - skirt,
    );
  }, [wall, elevation, stub, skirt]);

  return (
    <group renderOrder={ghost ? 2 : 0}>
      {[...boxes, ...skirtBoxes].map((b, i) => (
        <WallBox
          key={i}
          box={b}
          paintA={wall.paintA}
          paintB={wall.paintB}
          selected={selected}
          ghost={ghost}
        />
      ))}

      {/* Translucent glass panes + style muntins (not in stub mode). */}
      {!stub &&
        wall.windows.map((win) => {
          const g = windowGlassBox(wall, win, elevation);
          return (
            <group key={win.id}>
              <mesh
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
              {/* Opaque glazing bars for grid/divided (none for plain/picture). */}
              {windowMuntinBoxes(wall, win, elevation).map((b, i) => (
                <SolidBoxMesh
                  key={i}
                  box={b}
                  material={WINDOW_FRAME}
                  selected={selected}
                  ghost={ghost}
                />
              ))}
            </group>
          );
        })}

      {/* Door frame/track and closed leaf/leaves, by style (not in stub mode). */}
      {!stub &&
        wall.doors.map((door) => {
          // Sliding: a panel parked on the wall face + a track rail, no frame.
          if (door.style === "sliding") {
            const { panel, track } = slidingDoorBoxes(wall, door, elevation);
            const pt = faceTextureTransform(
              panel.face,
              PATTERN_TILE_METERS,
              false,
            );
            return (
              <group key={door.id}>
                <SolidBoxMesh
                  box={track}
                  material={DOOR_TRIM}
                  selected={selected}
                  ghost={ghost}
                />
                <SolidBoxMesh
                  box={panel}
                  material={door.material}
                  repeat={pt.repeat}
                  offset={pt.offset}
                  selected={selected}
                  ghost={ghost}
                />
              </group>
            );
          }
          // Single / double: opening frame (jambs + head) + closed leaf(es).
          const leaves =
            door.style === "double"
              ? doubleDoorLeafBoxes(wall, door, elevation)
              : [doorLeafBox(wall, door, elevation)];
          return (
            <group key={door.id}>
              {doorFrameBoxes(wall, door, elevation).map((b, i) => (
                <SolidBoxMesh
                  key={i}
                  box={b}
                  material={DOOR_TRIM}
                  selected={selected}
                  ghost={ghost}
                />
              ))}
              {leaves.map((leaf, i) => {
                const lt = faceTextureTransform(
                  leaf.face,
                  PATTERN_TILE_METERS,
                  false,
                );
                return (
                  <SolidBoxMesh
                    key={i}
                    box={leaf}
                    material={door.material}
                    repeat={lt.repeat}
                    offset={lt.offset}
                    selected={selected}
                    ghost={ghost}
                  />
                );
              })}
            </group>
          );
        })}

      {/* Wall-mounted items (not in stub mode — they sit above stub height). */}
      {!stub &&
        wall.mounts.map((m) => (
          <WallMount3D
            key={m.id}
            wall={wall}
            mount={m}
            elevation={elevation}
            selected={selectedMountId === m.id}
            ghost={ghost}
          />
        ))}
    </group>
  );
}
