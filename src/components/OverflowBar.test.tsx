import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import React from "react";
import { OverflowBar, type OverflowBarItem } from "./OverflowBar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Reproduces the React #185 ("Maximum update depth exceeded") loop that
// white-screened the app: the overflow recompute runs in a layout effect on
// every render, so if a sub-pixel measurement change flips an item in/out of the
// menu on each pass, the updates never settle. We simulate a visible item whose
// measured width jitters by <1px across the fit boundary; with the per-pixel
// rounding + tolerance the decision is idempotent and the tree settles. Without
// it, React throws after 50 nested updates.
let realRect: typeof Element.prototype.getBoundingClientRect;
let realClientWidth: PropertyDescriptor | undefined;
let aCall = 0;

function widthFor(el: Element): number {
  const cls = (el as HTMLElement).className || "";
  const text = (el as HTMLElement).textContent || "";
  if (typeof cls === "string" && cls.includes("overflow-more")) return 10;
  if (typeof cls === "string" && cls.includes("overflow-slot")) {
    if (text.includes("A")) {
      // Jitter across the boundary: totalAll = A + GAP(6) + B(50); avail = 100.
      // 44.4 -> 100.4 (overflow), 43.6 -> 99.6 (fits). Both round to 44 -> 100.
      aCall += 1;
      return aCall % 2 === 1 ? 44.4 : 43.6;
    }
    if (text.includes("B")) return 50;
  }
  return 0;
}

describe("OverflowBar idempotency (React #185 regression)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    aCall = 0;
    realRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const w = widthFor(this);
      return { width: w, height: 20, top: 0, left: 0, right: w, bottom: 20, x: 0, y: 0, toJSON() {} } as DOMRect;
    };
    realClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 100;
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Element.prototype.getBoundingClientRect = realRect;
    if (realClientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", realClientWidth);
  });

  it("does not loop when a visible item's width jitters at the fit boundary", () => {
    const items: OverflowBarItem[] = [
      { key: "A", priority: 1, node: React.createElement("button", null, "A") },
      { key: "B", priority: 2, node: React.createElement("button", null, "B") },
    ];

    // The whole point: rendering + the every-render layout-effect recompute must
    // settle. The old code threw React #185 here.
    expect(() => {
      act(() => {
        root.render(React.createElement(OverflowBar, { items }));
      });
    }).not.toThrow();
  });
});
