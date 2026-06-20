'use client';

type ProgressListener = (progress: number) => void;

interface RegisteredElement {
  element: Element;
  onProgress: ProgressListener;
  lastProgress: number;
}

// Below this, a progress change is visually imperceptible — skip the React
// state update / anime.js seek() entirely rather than re-rendering on noise.
const EPSILON = 0.003;

/**
 * Maps an element's position to a 0 → 1 → 0 "tent" curve:
 *   0   element is fully off-screen (above or below the viewport)
 *   1   element's vertical midpoint is exactly at the viewport's midpoint
 *   0   element has fully exited on the far side
 *
 * Every scroll-driven animation on the page (assembling icons, section
 * reveals, etc.) is built on this single curve, so "how far through the
 * section am I" always means the same thing and feels consistent everywhere
 * it's used, rather than every component inventing its own thresholds.
 */
function computeTentProgress(rect: DOMRect, viewportHeight: number): number {
  const elementCenter = rect.top + rect.height / 2;
  const viewportCenter = viewportHeight / 2;
  const falloff = viewportHeight / 2 + rect.height / 2;
  if (falloff <= 0) return 0;

  const distance = Math.abs(elementCenter - viewportCenter);
  const raw = 1 - distance / falloff;
  const clamped = Math.min(1, Math.max(0, raw));

  // smoothstep, so motion eases in/out instead of moving at a linear rate
  return clamped * clamped * (3 - 2 * clamped);
}

class ScrollProgressManager {
  private registry = new Map<Element, RegisteredElement>();
  private active = new Set<Element>();
  private observer: IntersectionObserver | null = null;
  private ticking = false;
  private listenersAttached = false;

  /**
   * Registers an element to receive progress updates. Returns an unregister
   * function — always call it from a `useEffect` cleanup.
   */
  register(element: Element, onProgress: ProgressListener): () => void {
    this.registry.set(element, { element, onProgress, lastProgress: -1 });
    this.getObserver().observe(element);
    this.ensureListeners();
    this.schedule();

    return () => {
      this.registry.delete(element);
      this.active.delete(element);
      this.observer?.unobserve(element);
    };
  }

  private getObserver(): IntersectionObserver {
    if (this.observer) return this.observer;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.active.add(entry.target);
          } else {
            this.active.delete(entry.target);
          }
        }
        // An element just crossed into range — compute its first frame
        // immediately instead of waiting for the next scroll event.
        this.schedule();
      },
      // Start tracking a little before the element reaches the viewport so
      // the very first animation frame isn't skipped or jumped-into.
      { rootMargin: '25% 0px 25% 0px', threshold: 0 }
    );
    return this.observer;
  }

  private ensureListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;
    window.addEventListener('scroll', this.handleViewportChange, { passive: true });
    window.addEventListener('resize', this.handleViewportChange, { passive: true });
  }

  private handleViewportChange = () => this.schedule();

  private schedule() {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.ticking = false;
      this.flush();
    });
  }

  private flush() {
    if (this.active.size === 0) return;
    const viewportHeight = window.innerHeight;
    this.active.forEach((element) => {
      const entry = this.registry.get(element);
      if (!entry) return;
      const rect = element.getBoundingClientRect();
      const progress = computeTentProgress(rect, viewportHeight);
      if (Math.abs(progress - entry.lastProgress) > EPSILON) {
        entry.lastProgress = progress;
        entry.onProgress(progress);
      }
    });
  }
}

// One instance for the whole app — every `useScrollProgress()` call shares
// the same observer and the same rAF tick instead of stacking up duplicates.
export const scrollProgressManager = new ScrollProgressManager();
