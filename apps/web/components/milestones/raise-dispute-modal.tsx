'use client';

import { useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PtbPreviewModal } from '@/components/blockchain/ptb-preview-modal';
import { TransactionStatusToast } from '@/components/blockchain/transaction-toast';
import { usePtbSigner } from '@/hooks/use-ptb-signer';
import { UITransactionStatus } from '@/lib/transaction-status';
import { relationshipsApi } from '@/lib/api/relationships';
import { parseDAppKitExecutionResult } from '@/lib/dapp-kit-result';
import { queryKeys } from '@/lib/query-keys';

interface RaiseDisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationshipId: string;
  milestoneIndex: number | null;
  onSuccess?: () => void;
}

export function RaiseDisputeModal({
  open,
  onOpenChange,
  relationshipId,
  milestoneIndex,
  onSuccess,
}: RaiseDisputeModalProps) {
  const queryClient = useQueryClient();
  const dAppKit = useDAppKit();
  const [phase, setPhase] = useState<'input' | 'ptb'>('input');
  const [reason, setReason] = useState('');
  const reasonHashRef = useRef('');
  const [ptbModalOpen, setPtbModalOpen] = useState(false);

  const disputeSigner = usePtbSigner({
    txType: 'RAISE_DISPUTE',
    fetchPtb: async () => {
      if (milestoneIndex === null) throw new Error('No milestone selected');
      return relationshipsApi.getRaiseDisputePtb(relationshipId, milestoneIndex, { reasonHash: reasonHashRef.current });
    },
    signAndExecuteTransaction: async (tx) => {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      toast.success('Dispute raised successfully.');
      onSuccess?.();
      handleClose();
    },
    invalidateKeys: [queryKeys.relationships.detail(relationshipId)],
  });

  const handleClose = () => {
    if (disputeSigner.status === UITransactionStatus.SIGNING || disputeSigner.status === UITransactionStatus.SUBMITTING) return;
    setPhase('input');
    setReason('');
    reasonHashRef.current = '';
    setPtbModalOpen(false);
    disputeSigner.reset();
    onOpenChange(false);
  };

  const handleSubmitReason = async () => {
    if (!reason.trim()) return;
    if (milestoneIndex === null) return;
    const evidence = await relationshipsApi.uploadDisputeEvidence(
      relationshipId,
      milestoneIndex,
      reason.trim(),
    );
    reasonHashRef.current = evidence.reasonHash;
    setPhase('ptb');
    setPtbModalOpen(true);
    void disputeSigner.prepare();
  };

  const isSubmitting = disputeSigner.status === UITransactionStatus.SIGNING || disputeSigner.status === UITransactionStatus.SUBMITTING;

  return (
    <>
      <DialogPrimitive.Root open={open && phase === 'input'} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
              'rounded-xl border border-border bg-card p-6 shadow-2xl',
              'data-[state=open]:animate-fade-in outline-none'
            )}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                  Raise Dispute
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  Milestone {milestoneIndex !== null ? milestoneIndex + 1 : ''} — describe the issue. Your reason is stored off-chain; a hash is submitted on-chain.
                </DialogPrimitive.Description>
              </div>
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why you are disputing this milestone..."
              rows={4}
              className={cn(
                'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none'
              )}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {reason.length} characters — minimum 10 recommended
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReason}
                disabled={reason.trim().length < 3 || isSubmitting}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                Continue to Sign
              </button>
            </div>

            <DialogPrimitive.Close
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <PtbPreviewModal
        open={ptbModalOpen}
        onOpenChange={(o) => { if (!o) { setPtbModalOpen(false); setPhase('input'); disputeSigner.reset(); } }}
        description={disputeSigner.ptbDescription}
        estimatedGas={disputeSigner.estimatedGas}
        ptbBytes={disputeSigner.ptbBytes}
        status={disputeSigner.status}
        errorMessage={disputeSigner.errorMessage}
        digest={disputeSigner.digest}
        onConfirm={() => void disputeSigner.sign()}
        onClose={() => { setPtbModalOpen(false); setPhase('input'); disputeSigner.reset(); }}
      />
      <TransactionStatusToast digest={disputeSigner.digest} status={disputeSigner.status} />
    </>
  );
}
