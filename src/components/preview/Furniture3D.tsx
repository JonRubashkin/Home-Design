import { selectCurrentLevel, useStore } from "../../store/store";
import { FurniturePiece } from "./FurniturePiece";

// Furniture renders in all three wall view modes (wall modes never hide it).
export function Furniture3D() {
  const level = useStore(selectCurrentLevel);
  const selection = useStore((s) => s.selection);
  return (
    <group>
      {level.furniture.map((item) => (
        <FurniturePiece
          key={item.id}
          item={item}
          elevation={level.elevation}
          selected={selection?.kind === "furniture" && selection.id === item.id}
        />
      ))}
    </group>
  );
}
