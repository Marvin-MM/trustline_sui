'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Users, X } from 'lucide-react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { relationshipsApi } from '@/lib/api/relationships';
import { usePtbSigner } from '@/hooks/use-ptb-signer';
import { parseDAppKitExecutionResult } from '@/lib/dapp-kit-result';
import { PtbPreviewModal } from '@/components/blockchain/ptb-preview-modal';
import { TransactionStatusToast } from '@/components/blockchain/transaction-toast';
import { queryKeys } from '@/lib/query-keys';

export function OperatorCapModal({
  open,
  onOpenChange,
  relationshipId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationshipId: string;
}) {
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [operatorAddress, setOperatorAddress] = useState('');
  const [expiryDays, setExpiryDays] = useState(30);
  const [canRelease, setCanRelease] = useState(true);
  const [canCancel, setCanCancel] = useState(false);
  const [canDispute, setCanDispute] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const signer = usePtbSigner({
    txType: 'GRANT_OPERATOR_CAP',
    fetchPtb: () => relationshipsApi.getGrantOperatorCapPtb(relationshipId, {
      operatorAddress,
      expiryDurationSeconds: expiryDays * 86_400,
      canRelease,
      canCancel,
      canDispute,
    }),
    signAndExecuteTransaction: async (tx) =>
      parseDAppKitExecutionResult(await dAppKit.signAndExecuteTransaction({ transaction: tx })),
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.detail(relationshipId) });
      toast.success('Workspace operator capability granted.');
      onOpenChange(false);
    },
  });

  const close = () => {
    setPreviewOpen(false);
    signer.reset();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog.Root open={open && !previewOpen} onOpenChange={(value) => { if (!value) close(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 text-brand" />
              <div>
                <Dialog.Title className="font-semibold">Add Workspace Operator</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Delegate only the selected payer-side actions. Refunds still return to the original payer.
                </Dialog.Description>
              </div>
            </div>
            <div className="space-y-4">
              <input
                value={operatorAddress}
                onChange={(event) => setOperatorAddress(event.target.value)}
                placeholder="Operator wallet address"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <label className="block text-xs text-muted-foreground">
                Expiry in days
                <input
                  type="number"
                  min={1}
                  value={expiryDays}
                  onChange={(event) => setExpiryDays(Math.max(1, Number(event.target.value)))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              {[
                ['Release milestones', canRelease, setCanRelease],
                ['Cancel pending milestones', canCancel, setCanCancel],
                ['Raise disputes', canDispute, setCanDispute],
              ].map(([label, checked, setter]) => (
                <label key={String(label)} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  {String(label)}
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={close} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button
                disabled={operatorAddress.length < 10 || (!canRelease && !canCancel && !canDispute)}
                onClick={() => { setPreviewOpen(true); void signer.prepare(); }}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Review Grant
              </button>
            </div>
            <Dialog.Close className="absolute right-4 top-4"><X className="h-4 w-4" /></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <PtbPreviewModal
        open={previewOpen}
        onOpenChange={(value) => { if (!value) setPreviewOpen(false); }}
        description={signer.ptbDescription}
        estimatedGas={signer.estimatedGas}
        ptbBytes={signer.ptbBytes}
        status={signer.status}
        errorMessage={signer.errorMessage}
        digest={signer.digest}
        onConfirm={() => void signer.sign()}
        onClose={() => setPreviewOpen(false)}
      />
      <TransactionStatusToast digest={signer.digest} status={signer.status} />
    </>
  );
}
