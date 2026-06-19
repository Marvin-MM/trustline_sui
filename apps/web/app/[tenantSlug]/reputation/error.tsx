'use client';

import { SegmentError } from '@/components/ui/segment-error';

export default function ReputationError({ reset }: { error: Error; reset: () => void }) {
  return <SegmentError reset={reset} title="Reputation could not load" />;
}
