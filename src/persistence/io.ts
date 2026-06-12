import type { Design } from "../model/types";
import { validateDesign } from "./storage";

// Trigger a browser download of the design as pretty-printed JSON.
export function exportDesignToFile(design: Design): void {
  const json = JSON.stringify(design, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const safeName = (design.name || "design")
    .trim()
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName || "design"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Parse + validate imported JSON text. Throws an Error with a friendly message.
export function parseImportedDesign(text: string): Design {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const result = validateDesign(parsed);
  if (!result.ok) throw new Error(result.error);
  return result.design;
}
