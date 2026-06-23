import { describe, it, expect } from "vitest";
import { cornerPosts } from "./cornerPosts";
import { createWall, DEFAULT_PAINT } from "../model/defaults";
import type { MaterialRef, Wall } from "../model/types";

const wall = (
  start: [number, number],
  end: [number, number],
  thickness = 0.15,
  height = 2.4,
): Wall =>
  createWall(
    { x: start[0], y: start[1] },
    { x: end[0], y: end[1] },
    { thickness, height },
  );

const paint = (w: Wall, side: "A" | "B", color: string): Wall => ({
  ...w,
  [side === "A" ? "paintA" : "paintB"]: { kind: "solid", color } as MaterialRef,
});

describe("cornerPosts", () => {
  it("emits no posts for a single isolated wall", () => {
    expect(cornerPosts([wall([0, 0], [4, 0])])).toEqual([]);
  });

  it("emits one post at an L-corner of two walls", () => {
    const posts = cornerPosts([
      wall([0, 0], [4, 0]),
      wall([4, 0], [4, 3]),
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.center).toEqual({ x: 4, y: 0 });
    expect(posts[0]!.wallIds).toHaveLength(2);
  });

  it("emits four posts for a closed four-wall room", () => {
    const posts = cornerPosts([
      wall([0, 0], [4, 0]),
      wall([4, 0], [4, 3]),
      wall([4, 3], [0, 3]),
      wall([0, 3], [0, 0]),
    ]);
    expect(posts).toHaveLength(4);
    const centers = posts.map((p) => `${p.center.x},${p.center.y}`).sort();
    expect(centers).toEqual(["0,0", "0,3", "4,0", "4,3"]);
  });

  it("detects a T-junction (endpoint on another wall's segment)", () => {
    const posts = cornerPosts([
      wall([0, 0], [6, 0]), // through wall
      wall([3, 0], [3, 3]), // stem meets the middle of the through wall
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.wallIds).toHaveLength(2);
  });

  it("offsets a T-junction post fully onto the stub side (no far-side post)", () => {
    // Through wall along +x (centerline y=0); stem rises toward +y. The post must
    // sit on the +y (stub) side only — its footprint must not cross to y < 0.
    const posts = cornerPosts([
      wall([0, 0], [6, 0]),
      wall([3, 0], [3, 3]),
    ]);
    expect(posts).toHaveLength(1);
    const post = posts[0]!;
    // Offset onto the stub side: center moved off the centerline by half the size.
    expect(post.center.x).toBeCloseTo(3, 6);
    expect(post.center.y).toBeCloseTo(post.size / 2, 6);
    // No coverage on the far side of the through wall: the back face is flush with
    // the centerline (y=0), nothing crosses to negative y.
    expect(post.center.y - post.size / 2).toBeGreaterThanOrEqual(-1e-6);
  });

  it("offsets the T-junction post toward a stem on the other side", () => {
    // Stem rises toward -y now; the post should land on the -y side instead.
    const posts = cornerPosts([
      wall([0, 0], [6, 0]),
      wall([3, 0], [3, -3]),
    ]);
    const post = posts[0]!;
    expect(post.center.y).toBeCloseTo(-post.size / 2, 6);
    expect(post.center.y + post.size / 2).toBeLessThanOrEqual(1e-6);
  });

  it("keeps an L-corner post centered on the shared point", () => {
    const posts = cornerPosts([
      wall([0, 0], [4, 0]),
      wall([4, 0], [4, 3]),
    ]);
    expect(posts[0]!.center).toEqual({ x: 4, y: 0 });
  });

  it("sizes the post to the thickest wall and tallest height at the corner", () => {
    const posts = cornerPosts([
      wall([0, 0], [4, 0], 0.15, 2.4),
      wall([4, 0], [4, 3], 0.3, 3.0),
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.size).toBeCloseTo(0.3, 6);
    expect(posts[0]!.height).toBeCloseTo(3.0, 6);
  });

  it("leaves every face undefined when all connected walls are default paint", () => {
    const posts = cornerPosts([
      wall([0, 0], [4, 0]),
      wall([4, 0], [4, 3]),
    ]);
    expect(posts[0]!.materials).toEqual({
      px: undefined,
      nx: undefined,
      pz: undefined,
      nz: undefined,
    });
    // The default paint really is unpainted (sanity check on the rule's basis).
    expect(DEFAULT_PAINT.kind).toBe("solid");
  });

  it("colors a face from the same-side wall paint at an L-corner", () => {
    // wall1 along +x with side B (plan +y) painted; wall2 along +y. The post's +z
    // (plan +y) face — the same side as wall1's painted B face — takes that color;
    // the faces along the other axes stay neutral (undefined).
    const posts = cornerPosts([
      paint(wall([0, 0], [4, 0]), "B", "#336699"),
      wall([4, 0], [4, 3]),
    ]);
    const m = posts[0]!.materials;
    expect(m.pz).toEqual({ kind: "solid", color: "#336699" });
    expect(m.nz).toBeUndefined(); // opposite side never borrows the +y color
    expect(m.px).toBeUndefined();
    expect(m.nx).toBeUndefined();
  });

  it("never bleeds a wall's opposite-side color onto a post face", () => {
    // Paint ONLY side A (plan −y) of the horizontal wall. The −z (plan −y) face
    // gets it; the +z (plan +y) face must NOT — it's the wall's other side.
    const posts = cornerPosts([
      paint(wall([0, 0], [4, 0]), "A", "#aa0000"),
      wall([4, 0], [4, 3]),
    ]);
    const m = posts[0]!.materials;
    expect(m.nz).toEqual({ kind: "solid", color: "#aa0000" });
    expect(m.pz).toBeUndefined();
  });

  it("colors interior and exterior post faces from their same-side wall paint", () => {
    // A four-wall room: paint every wall's interior side one color and exterior
    // another. Each post must show interior color only on interior-facing faces
    // and exterior color only on exterior-facing faces — no cross-bleed.
    // For a CCW-in-SVG loop the inward normal is side A on each wall here.
    const INT = "#22aa22";
    const EXT = "#2222aa";
    const paintBoth = (w: Wall, interior: "A" | "B"): Wall =>
      paint(paint(w, interior, INT), interior === "A" ? "B" : "A", EXT);
    // Room corners at (0,0)(4,0)(4,3)(0,3); walls drawn clockwise so interior
    // (toward room center) is side B for top/bottom and ... use explicit sides.
    const top = paintBoth(wall([0, 0], [4, 0]), "B"); // interior = +y (into room)
    const right = paintBoth(wall([4, 0], [4, 3]), "B"); // interior = -x
    const bottom = paintBoth(wall([4, 3], [0, 3]), "B"); // interior = -y
    const left = paintBoth(wall([0, 3], [0, 0]), "B"); // interior = +x
    const posts = cornerPosts([top, right, bottom, left]);
    const at = (x: number, y: number) =>
      posts.find((p) => Math.abs(p.center.x - x) < 1e-6 && Math.abs(p.center.y - y) < 1e-6)!;
    // Corner (0,0): top wall's interior (+y) face is INT → post +z face INT, its
    // -z (exterior) face EXT; left wall's interior (+x) → post +x INT, -x EXT.
    const c00 = at(0, 0).materials;
    expect(c00.pz).toEqual({ kind: "solid", color: INT });
    expect(c00.nz).toEqual({ kind: "solid", color: EXT });
    expect(c00.px).toEqual({ kind: "solid", color: INT });
    expect(c00.nx).toEqual({ kind: "solid", color: EXT });
  });

  it("uses the through wall's stub-side face color at a T-junction", () => {
    // Stem rises toward +y → side B of the through wall faces +y. Paint side B
    // blue and side A red; the post's +z (plan +y) face — the side it sits
    // against — takes blue, and the −z face takes red (each its own same side).
    let through = wall([0, 0], [6, 0]);
    through = paint(through, "A", "#ff0000");
    through = paint(through, "B", "#0000ff");
    const posts = cornerPosts([through, wall([3, 0], [3, 3])]);
    const m = posts[0]!.materials;
    expect(m.pz).toEqual({ kind: "solid", color: "#0000ff" });
    expect(m.nz).toEqual({ kind: "solid", color: "#ff0000" });
  });

  it("breaks a same-side face tie toward the thicker wall", () => {
    // Two collinear-ish walls meeting at (4,0), both presenting a +y (side B)
    // face. The thicker wall's adjacent segment color wins on that face.
    const thin = paint(wall([0, 0], [4, 0], 0.15), "B", "#111111");
    const thick = paint(wall([4, 0], [8, 0], 0.3), "B", "#eeeeee");
    const posts = cornerPosts([thin, thick]);
    expect(posts[0]!.materials.pz).toEqual({ kind: "solid", color: "#eeeeee" });
  });
});
