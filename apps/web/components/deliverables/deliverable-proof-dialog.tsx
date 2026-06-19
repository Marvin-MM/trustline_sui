'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { ExternalLink, FileArchive, FileText, ImageIcon, Loader2, X } from 'lucide-react';

interface DeliverableProofDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blobId: string;
  walrusUrl: string;
  mimeType?: string | null;
  sizeBytes?: string | null;
  milestoneLabel?: string;
}

function formatBytes(value?: string | null): string | null {
  if (!value) return null;
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function previewKind(mimeType?: string | null): 'image' | 'pdf' | 'text' | 'other' {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  return 'other';
}

export function DeliverableProofDialog({
  open,
  onOpenChange,
  blobId,
  walrusUrl,
  mimeType,
  sizeBytes,
  milestoneLabel = 'Deliverable proof',
}: DeliverableProofDialogProps) {
  const kind = previewKind(mimeType);
  const formattedBytes = formatBytes(sizeBytes);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    setPreviewState(kind === 'other' ? 'ready' : 'loading');
  }, [kind, walrusUrl]);

  const previewFallback = (
    <div className="flex h-full min-h-[22rem] flex-col items-center justify-center gap-3 p-8 text-center">
      <FileArchive className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">
          {previewState === 'failed' ? 'Preview could not be loaded' : 'Preview is not available for this file type'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Open the Walrus copy to download or inspect the evidence in a compatible app.
        </p>
      </div>
    </div>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[80] flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                {milestoneLabel}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                Previewing immutable evidence from Walrus. Use the external link if your browser cannot render this file type.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:p-6">
            <div className="min-h-[22rem] overflow-hidden rounded-xl border border-border bg-muted/20">
              {previewState === 'loading' && kind !== 'other' && (
                <div className="flex h-full min-h-[22rem] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading Walrus preview...
                </div>
              )}
              {kind === 'image' && previewState !== 'failed' && (
                <div className={previewState === 'loading' ? 'hidden' : 'block'}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={walrusUrl}
                    alt={milestoneLabel}
                    className="h-full max-h-[65vh] w-full object-contain"
                    onLoad={() => setPreviewState('ready')}
                    onError={() => setPreviewState('failed')}
                  />
                </div>
              )}
              {(kind === 'pdf' || kind === 'text') && (
                <>
                  <iframe
                    title={milestoneLabel}
                    src={walrusUrl}
                    className={previewState === 'loading' ? 'hidden' : 'h-[65vh] w-full bg-background'}
                    sandbox=""
                    onLoad={() => setPreviewState('ready')}
                  />
                  {previewState === 'failed' && previewFallback}
                </>
              )}
              {kind === 'image' && previewState === 'failed' && previewFallback}
              {kind === 'other' && previewFallback}
            </div>

            <aside className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {kind === 'image' ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                Evidence details
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Blob ID</p>
                  <p className="mt-1 break-all font-mono-num text-foreground">{blobId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">MIME type</p>
                  <p className="mt-1 font-mono-num text-foreground">{mimeType || 'unknown'}</p>
                </div>
                {formattedBytes && (
                  <div>
                    <p className="text-muted-foreground">Size</p>
                    <p className="mt-1 font-mono-num text-foreground">{formattedBytes}</p>
                  </div>
                )}
              </div>
              <a
                href={walrusUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand/90"
              >
                Open on Walrus <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </aside>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
