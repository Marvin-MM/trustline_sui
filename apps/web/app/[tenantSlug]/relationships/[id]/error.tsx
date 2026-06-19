'use client';

import { SegmentError } from '@/components/ui/segment-error';

export default function RelationshipDetailError({ reset }: { error: Error; reset: () => void }) {
  return <SegmentError reset={reset} title="Relationship details could not load" />;
}
