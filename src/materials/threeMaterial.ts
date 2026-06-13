import * as THREE from "three";
import { useEffect, useMemo } from "react";
import type { MaterialRef } from "../model/types";
import { patternTextureVariant, patternTextureVariantKey } from "./textures";

const SELECT_EMISSIVE = "#2563eb";

export interface MaterialBuildOptions {
  repeat?: [number, number];
  offset?: [number, number];
  side?: THREE.Side;
  roughness?: number;
}

export interface MaterialStyle {
  selected?: boolean;
  ghost?: boolean;
  // Depth-bias level for coplanar surfaces (higher = rendered on top). Used to
  // layer overlapping floor regions without z-fighting.
  depthBias?: number;
}

// Shared factory: build a THREE material for a MaterialRef. Solids use a color;
// patterns use a cached texture configured with the given repeat/offset. Used by
// BOTH walls and floors so the solid/pattern branching lives in exactly one place.
export function materialRefToThreeMaterial(
  ref: MaterialRef,
  opts: MaterialBuildOptions = {},
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    roughness: opts.roughness ?? 0.92,
    metalness: 0,
    side: opts.side ?? THREE.FrontSide,
  });
  if (ref.kind === "solid") {
    mat.color.set(ref.color);
  } else {
    mat.color.set("#ffffff");
    mat.map = patternTextureVariant(
      ref,
      opts.repeat ?? [1, 1],
      opts.offset ?? [0, 0],
    );
  }
  return mat;
}

// Identity that requires a fresh material (shader recompile): kind, colors,
// texture variant, side, roughness.
function buildKey(ref: MaterialRef, opts: MaterialBuildOptions): string {
  const base =
    ref.kind === "solid"
      ? `solid:${ref.color.toLowerCase()}`
      : patternTextureVariantKey(
          ref,
          opts.repeat ?? [1, 1],
          opts.offset ?? [0, 0],
        );
  return `${base}|s${opts.side ?? THREE.FrontSide}|r${opts.roughness ?? 0.92}`;
}

// A memoized THREE material that is rebuilt — and the previous one disposed —
// only when its build identity changes. Switching solid <-> pattern therefore
// yields a brand-new, correctly-compiled material (three.js needs a recompile
// when `map` is added, which a reused instance doesn't get). Selection/ghost
// styling is applied each render without a rebuild.
export function useThreeMaterial(
  ref: MaterialRef,
  opts: MaterialBuildOptions,
  style: MaterialStyle,
): THREE.MeshStandardMaterial {
  const key = buildKey(ref, opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const material = useMemo(() => materialRefToThreeMaterial(ref, opts), [key]);
  useEffect(() => () => material.dispose(), [material]);

  const selected = style.selected ?? false;
  const ghost = style.ghost ?? false;
  material.emissive.set(selected ? SELECT_EMISSIVE : "#000000");
  material.emissiveIntensity = selected ? 0.4 : 0;
  material.transparent = ghost;
  material.opacity = ghost ? 0.15 : 1;
  material.depthWrite = !ghost;

  // Bias coplanar surfaces toward the camera by their level so a higher level
  // (a more recently drawn floor) wins over a lower one without z-fighting.
  const bias = style.depthBias ?? 0;
  material.polygonOffset = bias > 0;
  material.polygonOffsetFactor = -bias;
  material.polygonOffsetUnits = -bias;
  return material;
}
