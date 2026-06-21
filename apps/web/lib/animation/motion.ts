import type { Transition, Variants } from 'framer-motion';

/**
 * Shared easing curve for entrance/scroll-reveal motion across the landing
 * page, so every section settles with the same feel instead of each
 * component inventing its own cubic-bezier.
 */
export const EASE_OUT: Transition['ease'] = [0.16, 1, 0.3, 1];

export const fadeUp = (delay = 0, distance = 20): Variants => ({
  hidden: { opacity: 0, y: distance },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: EASE_OUT } },
});

export const fadeIn = (delay = 0): Variants => ({
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, delay, ease: EASE_OUT } },
});

export const staggerContainer = (staggerChildren = 0.15): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren } },
});
