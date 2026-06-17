import { useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Level, MaterialRef } from "../../model/types";
import { useStore } from "../../store/store";
import { cornerPosts, type CornerPost } from "../../geometry/cornerPosts";
import { isWallFrontFacing, wallsCentroid } from "../../geometry/cutaway";
import { planToWorld } from "../../geometry/mapping";
import { useThreeMaterial } from "../../materials/threeMaterial";

// Neutral post tone, matching the wall end caps so corners read as part of the
// wall rather than a separate object.
const POST_MATERIAL: MaterialRef = { kind: "solid", color: "#cdc8be" };

function CornerPostBox({
  post,
  elevation,
  stub,
  ghost,
  skirt,
}: {
  post: CornerPost;
  elevation: number;
  stub: boolean;
  ghost: boolean;
  skirt: number;
}) {
  const material = useThreeMaterial(POST_MATERIAL, {}, { ghost });
  const [wx, , wz] = planToWorld(post.center, 0);
  const h = (stub ? post.height * 0.1 : post.height) + (stub ? 0 : skirt);
  // Stub posts sit on the floor; full posts may extend down by the skirt so an
  // upper level's posts meet the lower wall tops (no gap), like wall skirts.
  const bottom = stub ? elevation : elevation - skirt;
  const y = bottom + h / 2;
  return (
    <mesh position={[wx, y, wz]} renderOrder={ghost ? 2 : 0}>
      <boxGeometry args={[post.size, h, post.size]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// Corner posts for one level. They follow the level's wall view mode like walls:
// in Cutaway a post is suppressed (invisible/ghost) when ALL the walls meeting at
// it are front-facing (so a corner that still has a visible rear wall stays
// solid); in Stubs they render at 10% height. The front-facing set is recomputed
// each frame from the camera, mirroring Walls3D.
export function CornerPosts3D({
  level,
  elevation,
  skirt = 0,
}: {
  level: Level;
  elevation: number;
  skirt?: number;
}) {
  const viewMode = useStore((s) => s.viewMode);
  const cutawayStyle = useStore((s) => s.cutawayStyle);
  const camera = useThree((s) => s.camera);

  const walls = level.walls;
  const posts = useMemo(() => cornerPosts(walls), [walls]);
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

  const stub = viewMode === "stubs";

  return (
    <group>
      {posts.map((post, i) => {
        const suppressed =
          viewMode === "cutaway" &&
          post.wallIds.length > 0 &&
          post.wallIds.every((id) => hidden.has(id));
        if (suppressed && cutawayStyle === "invisible") return null;
        return (
          <CornerPostBox
            key={i}
            post={post}
            elevation={elevation}
            stub={stub}
            ghost={suppressed && cutawayStyle === "ghost"}
            skirt={stub ? 0 : skirt}
          />
        );
      })}
    </group>
  );
}
