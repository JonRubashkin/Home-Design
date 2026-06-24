import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Boom(): React.ReactElement {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // React logs the caught error; silence it for a clean test run.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders a readable fallback instead of a blank screen when a child throws", () => {
    act(() => {
      root.render(
        React.createElement(ErrorBoundary, null, React.createElement(Boom)),
      );
    });
    expect(container.querySelector(".crash-screen")).toBeTruthy();
    expect(container.textContent).toContain("Something went wrong");
    expect(container.textContent).toContain("kaboom");
  });

  it("renders children normally when nothing throws", () => {
    act(() => {
      root.render(
        React.createElement(
          ErrorBoundary,
          null,
          React.createElement("p", null, "all good"),
        ),
      );
    });
    expect(container.querySelector(".crash-screen")).toBeNull();
    expect(container.textContent).toContain("all good");
  });
});
