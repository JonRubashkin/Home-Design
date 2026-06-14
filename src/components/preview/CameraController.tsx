import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../store/store";

// The subset of OrbitControls we drive imperatively.
interface OrbitLike {
  target: THREE.Vector3;
  update: () => void;
}

// Frames the design's bounding box: on first mount (once controls exist) and
// whenever `fitNonce` changes (the Fit view button). Keeps the current view
// direction so fitting doesn't reset the user's orbit angle.
export function CameraController({ fitNonce }: { fitNonce: number }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const levels = useStore((s) => s.design.levels);
  const site = useStore((s) => s.design.site);

  useEffect(() => {
    if (!controls) return;

    // Seed the bounds with the site rectangle so an empty design frames the lot,
    // then expand to include every wall on every level (the whole building).
    let minX = 0;
    let maxX = site.width;
    let minZ = 0;
    let maxZ = site.depth;
    const minY = 0;
    let maxY = 0;
    for (const level of levels) {
      for (const w of level.walls) {
        for (const p of [w.start, w.end]) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.y);
          maxZ = Math.max(maxZ, p.y);
        }
        maxY = Math.max(maxY, level.elevation + w.height);
      }
    }

    const width = maxX - minX;
    const depth = maxZ - minZ;
    const tall = Math.max(maxY - minY, 1);
    const center = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    );
    const radius = Math.max(Math.hypot(width, depth, tall) / 2, 1);

    // Preserve the current orbit direction; fall back to a classic iso angle.
    const dir = new THREE.Vector3().subVectors(
      camera.position,
      controls.target,
    );
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.8, 1);
    dir.normalize();

    camera.position.copy(center).addScaledVector(dir, radius * 3 + 10);
    controls.target.copy(center);

    const maxDim = Math.max(width, depth, tall, 1);
    camera.zoom = Math.min(size.width, size.height) / (maxDim * 1.4);
    camera.near = 0.1;
    camera.far = radius * 10 + 1000;
    camera.updateProjectionMatrix();
    controls.update();
    // We intentionally fit only on mount and on explicit fit requests, not on
    // every wall edit or resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce, controls, size.width, size.height]);

  return null;
}
