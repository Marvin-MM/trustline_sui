'use client';

import { useEffect, useRef, useState } from 'react';
import { scrollProgressManager } from '@/lib/animation/scroll-progress-manager';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

/**
 * Subscribes an element to the shared scroll-progress manager.
 *
 * ```tsx
 * const { ref, progress } = useScrollProgress<HTMLDivElement>();
 * return <div ref={ref}>{progress}</div>;
 * ```
 *
 * `progress` rises from 0 → 1 as the element scrolls toward the viewport's
 * center and eases back to 0 as it leaves on the far side (see
 * `scroll-progress-manager.ts` for the exact curve). When the visitor
 * prefers reduced motion, `progress` is pinned at `1` and never updates, so
 * dependent UI renders pre-settled with no scroll-driven motion at all.
 */
export function useScrollProgress<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion) {
      setProgress(1);
      return;
    }

    return scrollProgressManager.register(node, setProgress);
  }, [prefersReducedMotion]);

  return { ref, progress };
}
