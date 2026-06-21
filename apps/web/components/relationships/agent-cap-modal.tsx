'use client';

import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Shield, X } from 'lucide-react';
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

interface AgentCapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'grant' | 'revoke';
  relationshipId: string;
  onSuccess?: () => void;
}

const ACTION_OPTIONS = [
  { value: 0, label: 'Verify deliverables' },
  { value: 1, label: 'Auto-release after challenge' },
];

export function AgentCapModal({
  open,
  onOpenChange,
  mode,
  relationshipId,
  onSuccess,
}: AgentCapModalProps) {
  const queryClient = useQueryClient();
  const dAppKit = useDAppKit();
  const [ptbModalOpen, setPtbModalOpen] = useState(false);

  // Grant form state
  const [expiryDurationSeconds, setExpiryDurationSeconds] = useState(86400);
  const [allowedActions, setAllowedActions] = useState<number[]>([0]);
  const [maxActions, setMaxActions] = useState(100);

  const capSigner = usePtbSigner({
    txType: mode === 'grant' ? 'GRANT_AGENT_CAP' : 'REVOKE_AGENT_CAP',
    fetchPtb: async () => {
      if (mode === 'grant') {
        return relationshipsApi.getGrantAgentCapPtb(relationshipId, {
          expiryDurationSeconds,
          allowedActions,
          maxActions,
        });
      }
      return relationshipsApi.getRevokeAgentCapPtb(relationshipId);
    },
    signAndExecuteTransaction: async (tx) => {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      toast.success(mode === 'grant' ? 'Agent capability granted.' : 'Agent capability revoked.');
      onSuccess?.();
      handleClose();
    },
    invalidateKeys: [queryKeys.relationships.detail(relationshipId)],
  });

  const handleClose = () => {
    if (capSigner.status === UITransactionStatus.SIGNING || capSigner.status === UITransactionStatus.SUBMITTING) return;
    setPtbModalOpen(false);
    capSigner.reset();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    setPtbModalOpen(true);
    void capSigner.prepare();
  };

  const toggleAction = (action: number) => {
    setAllowedActions((prev) =>
      prev.includes(action) ? prev.filter((value) => value !== action) : [...prev, action]
    );
  };

  const isGrantFormValid = expiryDurationSeconds > 0 && maxActions > 0 && allowedActions.length > 0;
  const isRevokeFormValid = true;
  const canSubmit = mode === 'grant' ? isGrantFormValid : isRevokeFormValid;

  return (
    <>
      <DialogPrimitive.Root open={open && !ptbModalOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
                <Shield className="h-5 w-5 text-brand" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                  {mode === 'grant' ? 'Grant Agent Capability' : 'Revoke Agent Capability'}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {mode === 'grant'
                    ? 'Delegate on-chain actions to an agent address for this relationship.'
                    : 'Permanently revoke an existing agent capability by its on-chain ID.'}
                </DialogPrimitive.Description>
              </div>
            </div>

            {mode === 'grant' ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  TrustLine uses its configured verifier wallet. This capability is scoped to this relationship, expires automatically, and can be revoked here.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Expiry (seconds)</label>
                    <input
                      type="number"
                      value={expiryDurationSeconds}
                      onChange={(e) => setExpiryDurationSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Math.round(expiryDurationSeconds / 3600)}h
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Max Actions</label>
                    <input
                      type="number"
                      value={maxActions}
                      onChange={(e) => setMaxActions(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">
                    Allowed Operations
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {ACTION_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleAction(value)}
                        className={cn(
                          'rounded-lg border px-3 py-1 text-xs font-medium transition-colors',
                          allowedActions.includes(value)
                            ? 'border-brand bg-brand/10 text-brand'
                            : 'border-border text-muted-foreground hover:border-brand/50'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">Revoke tracked automation capability</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  TrustLine will revoke the capability selected from this relationship&apos;s automation status. No object ID entry is required.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
              >
                {mode === 'grant' ? 'Grant Cap' : 'Revoke Cap'}
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
        onOpenChange={(o) => { if (!o) { setPtbModalOpen(false); capSigner.reset(); } }}
        description={capSigner.ptbDescription}
        estimatedGas={capSigner.estimatedGas}
        ptbBytes={capSigner.ptbBytes}
        status={capSigner.status}
        errorMessage={capSigner.errorMessage}
        digest={capSigner.digest}
        onConfirm={() => void capSigner.sign()}
        onClose={() => { setPtbModalOpen(false); capSigner.reset(); }}
      />
      <TransactionStatusToast digest={capSigner.digest} status={capSigner.status} />
    </>
  );
}
