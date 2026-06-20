'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the visitor's `prefers-reduced-motion` OS/browser setting.
 *
 * Used to collapse scroll-scrubbed and particle-style animations to an
 * instant, fully-settled state — see WCAG 2.3.3 (Animation from
 * Interactions). Defaults to `false` on the server and during the first
 * client render so SSR output matches the initial hydration pass.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(query.matches);

    const handleChange = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
}
