import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

// Where each named tab bar's indicator was last drawn. A tab bar that lives in
// a page remounts when the route changes (e.g. Sản lượng -> Chia sẻ): starting
// from the remembered spot lets the indicator slide across instead of jumping.
const lastPos = new Map<string, { left: number; width: number }>();

const EASE = 'cubic-bezier(0.22, 0.8, 0.2, 1)';
const DURATION_MS = 300;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * A highlight that slides under the active tab ("moving window").
 *
 *   const s = useSlidingIndicator(activeIndex, 'main-nav');
 *   <div ref={s.containerRef} className="relative ...">
 *     <span aria-hidden className="absolute ..." style={s.indicatorStyle} />
 *     {items.map((it, i) => <button ref={s.itemRef(i)} className="relative z-10" .../>)}
 *   </div>
 *
 * The container must be `position: relative`; the indicator is positioned
 * with left/width taken from the active item's offsetLeft/offsetWidth.
 */
export function useSlidingIndicator<C extends HTMLElement = HTMLDivElement>(
  activeIndex: number,
  memoryKey?: string,
) {
  const containerRef = useRef<C>(null);
  const items = useRef<Array<HTMLElement | null>>([]);
  const remembered = memoryKey ? lastPos.get(memoryKey) : undefined;
  const [pos, setPos] = useState<{ left: number; width: number; animate: boolean } | null>(
    remembered ? { ...remembered, animate: false } : null,
  );
  const shown = useRef<boolean>(!!remembered);

  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;

  // Stable: reads the active index from a ref, so the ResizeObserver below is
  // created once and never re-fires (its first callback would cancel a slide).
  const measure = useCallback(
    (animate: boolean) => {
      const el = items.current[activeRef.current];
      if (!el) return;
      const next = { left: el.offsetLeft, width: el.offsetWidth };
      if (memoryKey) lastPos.set(memoryKey, next);
      setPos((prev) =>
        prev && prev.left === next.left && prev.width === next.width && !animate
          ? prev
          : // The very first placement never animates (nothing to slide from).
            { ...next, animate: animate && shown.current },
      );
      shown.current = true;
    },
    [memoryKey],
  );

  // Active tab changed (or first mount): slide to it on the next frame, so a
  // remembered start position is painted first.
  useLayoutEffect(() => {
    if (activeIndex < 0) return;
    const raf = requestAnimationFrame(() => measure(true));
    return () => cancelAnimationFrame(raf);
  }, [activeIndex, measure]);

  // Real layout changes (window resize, fonts, counts in labels): follow
  // without animating. The observer's initial callback is skipped.
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      measure(false);
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [measure]);

  const itemRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      items.current[i] = el;
    },
    [],
  );

  const indicatorStyle: CSSProperties =
    pos && activeIndex >= 0
      ? {
          left: 0,
          width: pos.width,
          transform: `translateX(${pos.left}px)`,
          transition:
            pos.animate && !reducedMotion()
              ? `transform ${DURATION_MS}ms ${EASE}, width ${DURATION_MS}ms ${EASE}`
              : 'none',
        }
      : { left: 0, width: 0, opacity: 0 };

  return { containerRef, itemRef, indicatorStyle };
}
