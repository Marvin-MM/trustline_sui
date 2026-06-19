'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Upload, CheckCircle, XCircle, File, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatBytes } from '@/lib/utils';
import { deliverablesApi, type UploadDeliverableResponse } from '@/lib/api/deliverables';
import { AIInsightBadge } from '@/components/agents/ai-insight-badge';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/zip',
  'text/plain',
];

const MAX_SIZE_BYTES = 52_428_800; // 50 MB

interface UploadZoneProps {
  relationshipId: string;
  milestoneIndex: number;
  onSuccess?: (result: UploadDeliverableResponse) => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

/**
 * UploadZone — react-dropzone powered deliverable upload.
 * States: idle, drag-over, uploading (with progress), success (blob ID + Walrus URL), error.
 * MIME validation client-side before upload.
 */
export function UploadZone({ relationshipId, milestoneIndex, onSuccess }: UploadZoneProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadDeliverableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) {
        const msgs = rejectedFiles.map((r) => r.errors.map((e) => e.message).join(', ')).join('; ');
        toast.error('File rejected', { description: msgs });
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      setSelectedFile(file);
      setUploadState('uploading');
      setProgress(0);
      setError(null);

      try {
        const uploadResult = await deliverablesApi.upload(
          relationshipId,
          milestoneIndex,
          file,
          setProgress
        );
        setResult(uploadResult);
        setUploadState('success');
        onSuccess?.(uploadResult);
        toast.success('Deliverable uploaded', { description: `Blob ID: ${uploadResult.blobId.slice(0, 16)}...` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        setUploadState('error');
        toast.error('Upload failed', { description: msg });
      }
    },
    [relationshipId, milestoneIndex, onSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: MAX_SIZE_BYTES,
    accept: Object.fromEntries(ALLOWED_MIME_TYPES.map((t) => [t, []])),
    disabled: uploadState === 'uploading',
  });

  const reset = () => {
    setUploadState('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    setSelectedFile(null);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer',
          isDragActive
            ? 'border-brand bg-brand/5 scale-[1.01]'
            : 'border-border hover:border-brand/40 hover:bg-muted/30',
          uploadState === 'uploading' && 'cursor-not-allowed opacity-60',
          uploadState === 'success' && 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/10',
          uploadState === 'error' && 'border-destructive/40 bg-destructive/5'
        )}
      >
        <input {...getInputProps()} aria-label="Upload deliverable" />

        {uploadState === 'idle' && !isDragActive && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 mb-3">
              <Upload className="h-6 w-6 text-brand" />
            </div>
            <p className="text-sm font-medium text-foreground">Drop your deliverable here</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, images, ZIP, text — max 50MB</p>
            <button className="mt-4 rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted">
              Browse files
            </button>
          </>
        )}

        {isDragActive && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/20 mb-3">
              <Upload className="h-6 w-6 text-brand animate-bounce" />
            </div>
            <p className="text-sm font-medium text-brand">Drop it here!</p>
          </>
        )}

        {uploadState === 'uploading' && (
          <>
            <Loader2 className="h-8 w-8 text-brand animate-spin mb-3" />
            <p className="text-sm font-medium text-foreground">Uploading to Walrus...</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedFile?.name}</p>
            <div className="mt-4 w-full max-w-xs">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}

        {uploadState === 'success' && result && (
          <>
            <CheckCircle className="h-8 w-8 text-emerald-500 mb-3" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Upload successful!</p>
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-xs text-muted-foreground">Blob ID</p>
              <p className="font-mono-num text-xs text-foreground break-all">{result.blobId}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formatBytes(result.sizeBytes)}</p>
          </>
        )}

        {uploadState === 'error' && (
          <>
            <XCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium text-destructive">Upload failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </>
        )}
      </div>

      {/* Reset button */}
      {(uploadState === 'success' || uploadState === 'error') && (
        <button
          onClick={reset}
          className="w-full rounded-lg border border-border py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Upload another file
        </button>
      )}
    </div>
  );
}
