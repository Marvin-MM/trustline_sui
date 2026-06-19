'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';

export function SegmentError({ reset, title = 'This section could not load' }: { reset: () => void; title?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">Try again, or return to the dashboard if the problem continues.</p>
      <button
        onClick={reset}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <RotateCcw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}
