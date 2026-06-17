import { useFrame, useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import type { Capture3DHandles } from "../../lib/capture";

// Lives inside the R3F <Canvas> and keeps a ref (owned by the parent, outside the
// Canvas) pointed at the live renderer/scene/camera + view size, so the export UI
// in the view bar can capture the current 3D view on demand (Phase 5 Part A).
export function SceneCapture({
  handlesRef,
}: {
  handlesRef: MutableRefObject<Capture3DHandles | null>;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useFrame(() => {
    handlesRef.current = {
      gl,
      scene,
      camera,
      size: { width: size.width, height: size.height },
    };
  });

  return null;
}
