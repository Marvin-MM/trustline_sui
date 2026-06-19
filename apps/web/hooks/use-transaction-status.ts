'use client';

import { useTransactionStore } from '@/stores/transaction.store';
import type { UITransactionStatus, ActiveTransaction } from '@/lib/transaction-status';

/**
 * Returns the current UITransactionStatus for a given digest.
 * Used by TransactionStatusToast to auto-update on state transitions.
 */
export function useTransactionStatus(digest: string | null): UITransactionStatus | null {
  const transactions = useTransactionStore((s) => s.transactions);
  if (!digest) return null;
  return transactions.get(digest)?.status ?? null;
}

/**
 * Returns the full transaction record for a given digest.
 */
export function useTransaction(digest: string | null): ActiveTransaction | null {
  const transactions = useTransactionStore((s) => s.transactions);
  if (!digest) return null;
  return transactions.get(digest) ?? null;
}
