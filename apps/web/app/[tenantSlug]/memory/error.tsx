'use client';

import { SegmentError } from '@/components/ui/segment-error';

export default function MemoryError({ reset }: { error: Error; reset: () => void }) {
  return <SegmentError reset={reset} title="Memory could not load" />;
}
