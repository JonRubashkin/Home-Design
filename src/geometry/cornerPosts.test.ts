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

  it("leaves material undefined when every connected wall is default paint", () => {
    const posts = cornerPosts([
      wall([0, 0], [4, 0]),
      wall([4, 0], [4, 3]),
    ]);
    expect(posts[0]!.material).toBeUndefined();
    // The default paint really is unpainted (sanity check on the rule's basis).
    expect(DEFAULT_PAINT.kind).toBe("solid");
  });

  it("matches a painted connecting wall at an L-corner", () => {
    const posts = cornerPosts([
      paint(wall([0, 0], [4, 0]), "B", "#336699"),
      wall([4, 0], [4, 3]),
    ]);
    expect(posts[0]!.material).toEqual({ kind: "solid", color: "#336699" });
  });

  it("uses the through wall's stub-side face color at a T-junction", () => {
    // Stem rises toward +y → side B of the through wall. Paint side B blue and
    // side A red; the post should take side B (the face it sits against).
    let through = wall([0, 0], [6, 0]);
    through = paint(through, "A", "#ff0000");
    through = paint(through, "B", "#0000ff");
    const posts = cornerPosts([through, wall([3, 0], [3, 3])]);
    expect(posts[0]!.material).toEqual({ kind: "solid", color: "#0000ff" });
  });
});
