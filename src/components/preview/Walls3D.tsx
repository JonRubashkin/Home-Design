import { useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Level } from "../../model/types";
import { useStore } from "../../store/store";
import { isWallFrontFacing, wallsCentroid } from "../../geometry/cutaway";
import { Wall3D } from "./Wall3D";

// Derives wall meshes for one level straight from the store (never a copy) and,
// in cutaway mode, recomputes which walls face the camera each frame — updating
// React state only when the hidden set actually changes. Each level computes its
// own facing set against its own wall centroid.
export function Walls3D({
  level,
  elevation,
  skirt = 0,
}: {
  level: Level;
  elevation: number;
  skirt?: number;
}) {
  const selection = useStore((s) => s.selection);
  const viewMode = useStore((s) => s.viewMode);
  const cutawayStyle = useStore((s) => s.cutawayStyle);
  const camera = useThree((s) => s.camera);

  const walls = level.walls;
  const centroid = useMemo(() => wallsCentroid(walls), [walls]);

  const [hiddenKey, setHiddenKey] = useState("");
  const hidden = useMemo(
    () => new Set(hiddenKey ? hiddenKey.split(",") : []),
    [hiddenKey],
  );

  useFrame(() => {
    if (viewMode !== "cutaway") {
      setHiddenKey((prev) => (prev === "" ? prev : ""));
      return;
    }
    const cam = { x: camera.position.x, y: camera.position.z };
    const key = walls
      .filter((w) => isWallFrontFacing(w, centroid, cam))
      .map((w) => w.id)
      .sort()
      .join(",");
    setHiddenKey((prev) => (prev === key ? prev : key));
  });

  return (
    <group>
      {walls.map((w) => {
        const isHidden = viewMode === "cutaway" && hidden.has(w.id);
        if (isHidden && cutawayStyle === "invisible") return null;
        return (
          <Wall3D
            key={w.id}
            wall={w}
            elevation={elevation}
            selected={selection?.id === w.id}
            stub={viewMode === "stubs"}
            ghost={isHidden && cutawayStyle === "ghost"}
            skirt={skirt}
          />
        );
      })}
    </group>
  );
}
