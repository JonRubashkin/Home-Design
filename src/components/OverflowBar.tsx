import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// A responsive horizontal action bar. It renders its items left-to-right; when
// they don't all fit, the lowest-PRIORITY items collapse into a trailing "⋯"
// overflow menu so nothing is ever clipped or unreachable. Recomputes on
// container resize. Mirrors the app's existing popover/menu pattern (ExportMenu /
// DesignFileMenu) for the dropdown.
//
// `priority`: lower number = more important = kept visible longer; the highest
// priority numbers overflow first. Visible items keep their given display order.
// `node` renders in the bar; `menuNode` (optional) renders inside the overflow
// dropdown — use it to give icon-only bar buttons a text label in the menu.
export interface OverflowBarItem {
  key: string;
  priority: number;
  node: ReactNode;
  menuNode?: ReactNode;
  // True for items that open their OWN popover (ExportMenu / DesignFileMenu) —
  // clicking them must not close the overflow menu out from under that popover.
  submenu?: boolean;
}

const GAP = 6; // must match the .topbar-actions CSS gap
const MORE_FALLBACK = 44; // estimated "⋯" button width before it is measured
// Slack (px) added to every fit comparison. getBoundingClientRect returns
// sub-pixel, frame-to-frame-jittery widths; without slack a width that lands
// exactly on a fit boundary can flip an item in/out of the overflow menu on
// every render. Because the recompute runs in a layout effect on every render
// (to measure a freshly-mounted "⋯"), such a flip is a SYNCHRONOUS infinite
// update loop → React error #185 ("Maximum update depth exceeded") → white
// screen. Rounding measurements to whole pixels + this tolerance makes the
// decision idempotent so the loop can't start.
const FIT_TOLERANCE = 1;

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// Space this container is ALLOWED to occupy = its parent's content width minus
// every sibling at their natural width (plus the parent's gaps). Deriving it from
// the siblings rather than the container's own clientWidth is essential: the
// container shrinks to its content once items collapse into the menu, so reading
// its own width would feed back and over-collapse. This is content-independent
// and so stable across recomputes.
function availableWidth(container: HTMLElement): number {
  const parent = container.parentElement;
  if (!parent) return container.clientWidth;
  const ps = getComputedStyle(parent);
  const padL = parseFloat(ps.paddingLeft) || 0;
  const padR = parseFloat(ps.paddingRight) || 0;
  const parentGap = parseFloat(ps.columnGap || ps.gap) || 0;
  const contentWidth = parent.clientWidth - padL - padR;
  let siblings = 0;
  for (const child of Array.from(parent.children)) {
    if (child === container) continue;
    siblings += (child as HTMLElement).getBoundingClientRect().width;
  }
  const gaps = Math.max(0, parent.children.length - 1) * parentGap;
  return contentWidth - siblings - gaps;
}

export function OverflowBar({
  items,
  className,
  menuLabel = "More actions",
}: {
  items: OverflowBarItem[];
  className?: string;
  menuLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const widths = useRef<Map<string, number>>(new Map());
  const moreRef = useRef<HTMLDivElement>(null);
  // Last measured "⋯" button width, kept stable across renders. The button is
  // only mounted while something overflows, so re-measuring it (vs. falling back
  // to MORE_FALLBACK) would make `moreW` alternate as items hide/show — another
  // way recompute could stop being idempotent. Cache it once and reuse it.
  const moreWidth = useRef<number>(MORE_FALLBACK);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

  // Pure, deterministic given the cached widths + container width, so it can be
  // re-run freely without oscillating: equal results short-circuit the setState.
  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Refresh the width cache from whatever slots are currently mounted (the
    // visible items). Hidden items keep their last-measured width. Round to whole
    // pixels so sub-pixel jitter between renders can't perturb the totals.
    slotRefs.current.forEach((el, key) => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) widths.current.set(key, w);
    });
    // Keep the "⋯" width stable: measure it when present, otherwise reuse the
    // last value (never alternate between measured and the fallback).
    if (moreRef.current) {
      const mw = Math.round(moreRef.current.getBoundingClientRect().width);
      if (mw > 0) moreWidth.current = mw;
    }

    const avail = Math.round(availableWidth(container));
    const widthOf = (key: string) => widths.current.get(key) ?? 0;

    const totalAll = items.reduce(
      (sum, it, i) => sum + widthOf(it.key) + (i > 0 ? GAP : 0),
      0,
    );
    if (totalAll <= avail + FIT_TOLERANCE) {
      setHiddenKeys((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    // Doesn't all fit: hide the least-important items (highest priority number,
    // ties broken by later display position) until the rest + the "⋯" button fit.
    const moreW = moreWidth.current;
    const byImportance = items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => b.it.priority - a.it.priority || b.i - a.i);

    const hidden = new Set<string>();
    const fits = () => {
      let w = moreW + GAP; // the trailing overflow button + its leading gap
      let first = true;
      for (const it of items) {
        if (hidden.has(it.key)) continue;
        w += widthOf(it.key) + (first ? 0 : GAP);
        first = false;
      }
      return w <= avail + FIT_TOLERANCE;
    };
    for (const { it } of byImportance) {
      if (fits()) break;
      hidden.add(it.key);
    }

    setHiddenKeys((prev) => (sameSet(prev, hidden) ? prev : hidden));
  }, [items]);

  // Re-run after every render (cheap; n is small) so a freshly-mounted "⋯"
  // button is measured and changes settle in one extra pass.
  useLayoutEffect(recompute);

  // Recompute live on resize. Observe the PARENT (the full bar): once the content
  // fits, this container is only content-wide and stops changing, so watching the
  // parent is what catches the window/layout getting narrower or wider.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);
    if (container.parentElement) ro.observe(container.parentElement);
    return () => ro.disconnect();
  }, [recompute]);

  // Close the overflow menu on outside click / Escape (same as ExportMenu).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const hiddenItems = items.filter((it) => hiddenKeys.has(it.key));
  // If nothing overflows, keep the menu closed.
  useEffect(() => {
    if (hiddenItems.length === 0 && menuOpen) setMenuOpen(false);
  }, [hiddenItems.length, menuOpen]);

  return (
    <div ref={containerRef} className={className}>
      {items.map((it) =>
        hiddenKeys.has(it.key) ? null : (
          <div
            key={it.key}
            className="overflow-slot"
            ref={(el) => {
              if (el) slotRefs.current.set(it.key, el);
              else slotRefs.current.delete(it.key);
            }}
          >
            {it.node}
          </div>
        ),
      )}

      {hiddenItems.length > 0 && (
        <div className="export-menu overflow-more" ref={moreRef}>
          <button
            type="button"
            className="overflow-more-button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={menuLabel}
            title={menuLabel}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="export-popover overflow-menu" role="menu">
              {hiddenItems.map((it) => (
                <div
                  key={it.key}
                  className="overflow-menu-item"
                  role="presentation"
                  onClick={it.submenu ? undefined : () => setMenuOpen(false)}
                >
                  {it.menuNode ?? it.node}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
