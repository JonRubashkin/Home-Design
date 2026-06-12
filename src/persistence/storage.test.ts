import { describe, it, expect } from "vitest";
import { validateDesign } from "./storage";
import { createDesign } from "../model/defaults";

describe("validateDesign", () => {
  it("accepts a freshly created design", () => {
    const result = validateDesign(createDesign());
    expect(result.ok).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(validateDesign(null).ok).toBe(false);
    expect(validateDesign(42).ok).toBe(false);
    expect(validateDesign("nope").ok).toBe(false);
  });

  it("rejects a missing schemaVersion", () => {
    const r = validateDesign({ name: "x", levels: [] });
    expect(r.ok).toBe(false);
  });

  it("refuses a newer schema version with a helpful message", () => {
    const r = validateDesign({ schemaVersion: 2, name: "x", levels: [{}] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/i);
  });

  it("rejects a design with no levels", () => {
    const r = validateDesign({ schemaVersion: 1, name: "x", levels: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects a missing name", () => {
    const r = validateDesign({ schemaVersion: 1, levels: [{}] });
    expect(r.ok).toBe(false);
  });
});
