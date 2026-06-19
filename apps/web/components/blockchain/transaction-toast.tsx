'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UITransactionStatus, UI_TRANSACTION_STATUS_MESSAGES } from '@/lib/transaction-status';
import { SUI_EXPLORER_URL } from '@/lib/sui-client';

interface TransactionStatusToastProps {
  digest: string | null;
  status: UITransactionStatus | null;
}

/**
 * TransactionStatusToast — auto-updates a Sonner toast as the transaction
 * state machine transitions. Uses toast.promise for the confirmation phase.
 *
 * Render this component once per active transaction — it manages its own
 * toast lifecycle via refs.
 */
export function TransactionStatusToast({ digest, status }: TransactionStatusToastProps) {
  const toastIdRef = useRef<string | number | null>(null);
  const prevStatusRef = useRef<UITransactionStatus | null>(null);

  useEffect(() => {
    if (!status || status === prevStatusRef.current) return;
    prevStatusRef.current = status;

    const message = UI_TRANSACTION_STATUS_MESSAGES[status];

    switch (status) {
      case UITransactionStatus.PREPARING:
      case UITransactionStatus.DRY_RUNNING:
      case UITransactionStatus.SIGNING:
      case UITransactionStatus.SUBMITTING:
        if (!toastIdRef.current) {
          toastIdRef.current = toast.loading(message);
        } else {
          toast.loading(message, { id: toastIdRef.current });
        }
        break;

      case UITransactionStatus.CONFIRMED:
        toast.success('Transaction confirmed!', {
          id: toastIdRef.current ?? undefined,
          description: digest ? (
            <a
              href={`${SUI_EXPLORER_URL}/txblock/${digest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Sui explorer
            </a>
          ) : undefined,
          duration: 5000,
        });
        toastIdRef.current = null;
        break;

      case UITransactionStatus.FAILED:
        toast.error('Transaction failed', {
          id: toastIdRef.current ?? undefined,
          description: message,
        });
        toastIdRef.current = null;
        break;

      case UITransactionStatus.WALLET_REJECTED:
        toast.error('Signing cancelled', {
          id: toastIdRef.current ?? undefined,
          description: message,
        });
        toastIdRef.current = null;
        break;

      case UITransactionStatus.DRY_RUN_FAILED:
        toast.error('Gas estimation failed', {
          id: toastIdRef.current ?? undefined,
          description: message,
        });
        toastIdRef.current = null;
        break;

      case UITransactionStatus.TIMEOUT:
        toast.warning('Transaction delayed', {
          id: toastIdRef.current ?? undefined,
          description: message,
          duration: 10000,
        });
        toastIdRef.current = null;
        break;
    }
  }, [status, digest]);

  return null;
}
