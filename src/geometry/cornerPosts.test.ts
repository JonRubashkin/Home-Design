import { describe, it, expect } from "vitest";
import { cornerPosts } from "./cornerPosts";
import { createWall } from "../model/defaults";
import type { Wall } from "../model/types";

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
    expect(posts[0]!.center).toEqual({ x: 3, y: 0 });
    expect(posts[0]!.wallIds).toHaveLength(2);
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
});
