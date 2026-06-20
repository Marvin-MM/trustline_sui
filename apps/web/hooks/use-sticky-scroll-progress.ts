'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

/**
 * Returns a [0, 1] progress value reflecting how far the user has scrolled
 * through a tall outer container whose inner content is `position: sticky`.
 *
 * Pattern:
 * ```tsx
 * const { containerRef, progress } = useStickyScrollProgress();
 * return (
 *   <div ref={containerRef} style={{ height: '400vh' }}>
 *     <div className="sticky top-0 h-screen">…</div>
 *   </div>
 * );
 * ```
 *
 * IMPORTANT: the container must not have any ancestor with `overflow` set to
 * anything other than `visible` or `clip` — `overflow: hidden/auto/scroll`
 * creates a new scroll container and breaks `position: sticky` entirely.
 * Use `overflow-x: clip` on the page root instead of `overflow-x: hidden`.
 */
export function useStickyScrollProgress() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const prefersReduced = usePrefersReducedMotion();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReduced) {
      // Show fully-assembled state instantly — no scroll scrubbing.
      setProgress(1);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const compute = () => {
      // -rect.top = how many px past the container's top edge we have scrolled.
      const rect = container.getBoundingClientRect();
      const scrolled = -rect.top;
      // offsetHeight gives the CSS-rendered pixel height, which is correct for
      // elements with percentage heights (scrollHeight can lag on first paint).
      const scrollSpace = container.offsetHeight - window.innerHeight;
      if (scrollSpace <= 0) return;
      setProgress(Math.max(0, Math.min(1, scrolled / scrollSpace)));
    };

    const scheduleCompute = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    // Passive scroll listener — fires on every scroll tick.
    window.addEventListener('scroll', scheduleCompute, { passive: true });

    // Recompute if the viewport is resized (e.g. mobile keyboard, orientation).
    window.addEventListener('resize', scheduleCompute, { passive: true });

    // ResizeObserver covers any layout shifts caused by lazy-loaded images,
    // font swap, or dynamic content above the features section.
    const ro = new ResizeObserver(scheduleCompute);
    ro.observe(container);
    ro.observe(document.documentElement);

    // Initial value (section might already be partially scrolled on mount).
    compute();

    return () => {
      window.removeEventListener('scroll', scheduleCompute);
      window.removeEventListener('resize', scheduleCompute);
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReduced]);

  return { containerRef, progress };
}
