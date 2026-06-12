import type { MaterialRef } from "../model/types";

// Stable cache key for a material. Identical materials share one generated
// texture / data-URL. Kept pure and dependency-free so it's easy to unit-test.
export function materialKey(ref: MaterialRef): string {
  if (ref.kind === "solid") return `solid:${ref.color.toLowerCase()}`;
  return `pattern:${ref.pattern}:${ref.colorA.toLowerCase()}:${ref.colorB.toLowerCase()}`;
}

// A DOM-safe id derived from the material key (hex colors contain '#', which
// would break an SVG `url(#...)` fragment reference). Distinct materials keep
// distinct ids because all alphanumerics are preserved.
export function materialDomId(ref: MaterialRef): string {
  return `mat-${materialKey(ref).replace(/[^a-z0-9]+/gi, "-")}`;
}

// A short human label for a material (used in chips / tooltips).
export function materialLabel(ref: MaterialRef): string {
  return ref.kind === "solid"
    ? ref.color.toUpperCase()
    : titleCase(ref.pattern);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
