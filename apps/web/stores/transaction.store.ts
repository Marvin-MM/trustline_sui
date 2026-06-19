/**
 * Transaction store — tracks active transaction state machines.
 *
 * Each transaction is tracked by its digest. The store holds the full
 * UITransactionStatus for each, enabling the TransactionStatusToast and
 * PTBPreviewModal to reflect the current state.
 *
 * Cleanup: transactions in CONFIRMED or FAILED state older than 5 minutes
 * are removed by clearOld() — call this from a periodic effect.
 */

import { create } from 'zustand';
import { UITransactionStatus, type ActiveTransaction } from '@/lib/transaction-status';

interface TransactionState {
  transactions: Map<string, ActiveTransaction>;

  initTransaction: (digest: string, txType: string) => void;
  updateStatus: (digest: string, status: UITransactionStatus) => void;
  setError: (digest: string, errorMessage: string) => void;
  confirmTransaction: (digest: string, gasUsed: bigint) => void;
  clearOld: () => void;
  getTransaction: (digest: string) => ActiveTransaction | undefined;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: new Map(),

  initTransaction: (digest, txType) =>
    set((state) => {
      const next = new Map(state.transactions);
      next.set(digest, {
        digest,
        txType,
        status: UITransactionStatus.PREPARING,
      });
      return { transactions: next };
    }),

  updateStatus: (digest, status) =>
    set((state) => {
      const existing = state.transactions.get(digest);
      if (!existing) return state;
      const next = new Map(state.transactions);
      next.set(digest, { ...existing, status });
      return { transactions: next };
    }),

  setError: (digest, errorMessage) =>
    set((state) => {
      const existing = state.transactions.get(digest);
      if (!existing) return state;
      const next = new Map(state.transactions);
      next.set(digest, { ...existing, status: UITransactionStatus.FAILED, errorMessage });
      return { transactions: next };
    }),

  confirmTransaction: (digest, gasUsed) =>
    set((state) => {
      const existing = state.transactions.get(digest);
      if (!existing) return state;
      const next = new Map(state.transactions);
      next.set(digest, {
        ...existing,
        status: UITransactionStatus.CONFIRMED,
        gasUsed,
        confirmedAt: Date.now(),
      });
      return { transactions: next };
    }),

  clearOld: () =>
    set((state) => {
      const FIVE_MINUTES = 5 * 60 * 1000;
      const now = Date.now();
      const next = new Map(state.transactions);
      for (const [digest, tx] of next.entries()) {
        const isTerminal =
          tx.status === UITransactionStatus.CONFIRMED ||
          tx.status === UITransactionStatus.FAILED;
        const isOld = tx.confirmedAt !== undefined && now - tx.confirmedAt > FIVE_MINUTES;
        if (isTerminal && isOld) {
          next.delete(digest);
        }
      }
      return { transactions: next };
    }),

  getTransaction: (digest) => get().transactions.get(digest),
}));
