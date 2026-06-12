import { useEffect, useRef, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

// Track an element's pixel size via ResizeObserver.
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T>,
  Size,
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
