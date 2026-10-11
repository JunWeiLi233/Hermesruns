import { useLayoutEffect, useState } from 'react';

/**
 * The width of an element in pixels, read before the first paint so a chart is not drawn at a guess and then redrawn,
 * and kept up to date as the element is resized. Without a measure (the element has no width yet, or there is no
 * ResizeObserver, as in a test) it is `fallback`.
 */
export default function useElementWidth(ref, fallback = 720) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measured = Math.floor(node.clientWidth);
    if (measured > 0) setWidth(measured);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
