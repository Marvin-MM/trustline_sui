'use client';

import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import anime from 'animejs';
import { useScrollProgress } from '@/hooks/use-scroll-progress';
import { cn } from '@/lib/utils';

interface AssemblyIconProps {
  /** The lucide (or any) icon element to reveal, e.g. <Brain className="h-6 w-6" />. */
  icon: ReactNode;
  /** How many fragments orbit and converge into the icon. 5-8 reads as "assembling"; more starts to look noisy. */
  fragmentCount?: number;
  /** Box size in px. Match this to the icon's existing container (e.g. 48 for h-12 w-12). */
  size?: number;
  /** Classes for the icon's background/border box — reuse the feature's existing `iconBg` token. */
  iconBoxClassName?: string;
  /** Classes for the fragment color, e.g. "bg-violet-500" — pass a concrete color so it doesn't depend on inheritance. */
  fragmentClassName?: string;
  /** Classes for the outer wrapper. Include a `text-*` color here so the assembly "ring" (which uses currentColor) matches. */
  className?: string;
}

interface Fragment {
  id: number;
  angle: number;
  distance: number;
  rotation: number;
  shape: 'square' | 'dot' | 'bar';
}

/**
 * Deterministic fragment layout (no Math.random in render) so the markup
 * the server sends and the markup React hydrates with are identical — using
 * random values here would throw a hydration mismatch warning.
 */
function buildFragments(count: number): Fragment[] {
  const jitterPattern: readonly number[] = [0, 14, -10, 8, -6, 12, -14, 6];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (360 / count) * i + (jitterPattern[i % jitterPattern.length] ?? 0),
    distance: 34 + (i % 3) * 10,
    rotation: 90 + (i % 4) * 45,
    // Guaranteed to match Fragment['shape'] — i % 3 is always 0, 1, or 2
    shape: (['square', 'dot', 'bar'] as const)[i % 3] as Fragment['shape'],
  }));
}

export function AssemblyIcon({
  icon,
  fragmentCount = 6,
  size = 48,
  iconBoxClassName,
  fragmentClassName = 'bg-current',
  className,
}: AssemblyIconProps) {
  const reactId = useId();
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const timelineRef = useRef<ReturnType<typeof anime.timeline> | null>(null);
  const fragments = useMemo(() => buildFragments(fragmentCount), [fragmentCount]);

  // Build the (paused) anime.js timeline once on mount. It never plays on
  // its own — scroll progress drives it entirely via `.seek()` below, which
  // is the standard, jank-free pattern for scroll-scrubbed anime.js motion.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const iconTarget = root.querySelector<HTMLElement>('[data-assembly-icon]');
    const ringTarget = root.querySelector<HTMLElement>('[data-assembly-ring]');
    const fragmentTargets = root.querySelectorAll<HTMLElement>('[data-assembly-fragment]');
    if (!iconTarget) return;

    const timeline = anime.timeline({ autoplay: false, easing: 'easeOutQuad' });

    // Phase 1: fragments fly inward from scattered positions and converge
    // on the icon's center, each along its own fixed angle/distance.
    timeline.add({
      targets: fragmentTargets,
      translateX: (_el: Element, i: number) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const f = fragments[i]!;
        const rad = (f.angle * Math.PI) / 180;
        return [Math.cos(rad) * f.distance, 0];
      },
      translateY: (_el: Element, i: number) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const f = fragments[i]!;
        const rad = (f.angle * Math.PI) / 180;
        return [Math.sin(rad) * f.distance, 0];
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      rotate: (_el: Element, i: number) => [fragments[i]!.rotation, 0],
      scale: [0.4, 1],
      opacity: [0, 1],
      duration: 700,
    });

    // Phase 2 (overlapping the tail of phase 1): the icon itself settles
    // into place with a slight overshoot, as if the fragments delivered it.
    timeline.add(
      {
        targets: iconTarget,
        scale: [0.5, 1],
        rotate: [-20, 0],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutBack',
      },
      '-=450'
    );

    // Phase 3: a brief expanding ring marks the "snap into place" moment.
    if (ringTarget) {
      timeline.add(
        {
          targets: ringTarget,
          scale: [0.6, 1.4],
          opacity: [0.5, 0],
          duration: 600,
          easing: 'easeOutQuad',
        },
        '-=200'
      );
    }

    timelineRef.current = timeline;

    return () => {
      anime.remove(
        [...Array.from(fragmentTargets), iconTarget, ringTarget].filter(Boolean) as Element[]
      );
      timelineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragments]);

  // Scrub the timeline to match scroll position. Because progress rises
  // 0 → 1 on the way in and eases back to 0 on the way out, this single
  // `.seek()` call produces both the assemble-in and disassemble-out motion
  // — no separate "reverse" animation is needed.
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    timeline.seek(timeline.duration * progress);
  }, [progress]);

  return (
    <div
      ref={ref}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        data-assembly-ring
        className="absolute inset-0 rounded-xl border border-current opacity-0"
      />
      <div
        className={cn(
          'relative z-10 flex h-full w-full items-center justify-center rounded-xl border',
          iconBoxClassName
        )}
      >
        <span data-assembly-icon className="opacity-0 will-change-transform">
          {icon}
        </span>
      </div>
      {fragments.map((fragment) => (
        <span
          key={`${reactId}-fragment-${fragment.id}`}
          data-assembly-fragment
          className={cn(
            'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 will-change-transform',
            fragment.shape === 'dot' && 'h-1.5 w-1.5 rounded-full',
            fragment.shape === 'square' && 'h-2 w-2 rounded-[2px]',
            fragment.shape === 'bar' && 'h-1 w-3 rounded-full',
            fragmentClassName
          )}
        />
      ))}
    </div>
  );
}
