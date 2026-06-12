import type { MaterialRef } from "../model/types";

// Stable cache key for a material. Identical materials share one generated
// texture / data-URL. Kept pure and dependency-free so it's easy to unit-test.
export function materialKey(ref: MaterialRef): string {
  if (ref.kind === "solid") return `solid:${ref.color.toLowerCase()}`;
  return `pattern:${ref.pattern}:${ref.colorA.toLowerCase()}:${ref.colorB.toLowerCase()}`;
}

// A short human label for a material (used in chips / tooltips).
export function materialLabel(ref: MaterialRef): string {
  return ref.kind === "solid" ? ref.color.toUpperCase() : titleCase(ref.pattern);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
