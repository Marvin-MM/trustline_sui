'use client';

/**
 * use-ptb-signer — drives the full PTB transaction state machine.
 *
 * Steps:
 * 1. PREPARING — fetch PTB bytes from backend
 * 2. DRY_RUNNING — dry run for gas estimate
 * 3. AWAITING_SIGNATURE — open PTB preview modal, user reviews
 * 4. SIGNING — wallet processes
 * 5. SIGNED — signature obtained
 * 6. SUBMITTING — send result to backend webhook
 * 7. PENDING → CONFIRMED / FAILED / TIMEOUT
 *
 * Network guard: if Sui RPC is offline, returns early with FAILED status.
 *
 * NOTE on @mysten/sui v2:
 * - dryRunTransactionBlock → simulate via suiClient
 * - getTransactionBlock → getTransaction
 * - waitForTransaction — still available on SuiJsonRpcClient
 */

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Transaction } from '@mysten/sui/transactions';
import { useTransactionStore } from '@/stores/transaction.store';
import { useNetworkStore } from '@/stores/network.store';
import { UITransactionStatus } from '@/lib/transaction-status';
import { webhooksApi } from '@/lib/api/webhooks';
import { suiClient } from '@/lib/sui-client';
import { decodeMoveError } from '@/lib/utils';
import { TransactionStatus } from '@bondflow/types';
import { getApiErrorMessage } from '@/lib/api-error';

export interface PtbSignerOptions {
  txType: string;
  /** Async function that fetches the PTB from the backend and returns serialized bytes */
  fetchPtb: () => Promise<{ ptb: string; description: string; estimatedGas: string; relationshipId?: string }>;
  /** Wallet signing function (from dapp-kit) */
  signAndExecuteTransaction: (tx: Transaction | string) => Promise<{ digest: string }>;
  /** Called when the transaction is confirmed */
  onConfirmed?: (digest: string, relationshipId: string | null) => void | Promise<void>;
  onFailed?: (digest: string | null, error: string) => void | Promise<void>;
  onFailedBeforeSubmission?: (relationshipId: string, error: string) => void | Promise<void>;
  /**
   * React Query invalidation after confirm.
   * Accepts readonly tuples from queryKeys factories.
   */
  invalidateKeys?: ReadonlyArray<ReadonlyArray<unknown>>;
  /** Custom pending timeout in ms (default 60s) */
  timeoutMs?: number;
}

export interface PtbSignerResult {
  status: UITransactionStatus;
  ptbDescription: string | null;
  estimatedGas: string | null;
  ptbBytes: string | null;
  errorMessage: string | null;
  digest: string | null;
  relationshipId: string | null;
  prepare: () => Promise<void>;
  sign: () => Promise<void>;
  reset: () => void;
}

export function usePtbSigner(options: PtbSignerOptions): PtbSignerResult {
  const { txType, fetchPtb, signAndExecuteTransaction, onConfirmed, onFailed, onFailedBeforeSubmission, timeoutMs = 60_000 } = options;

  const queryClient = useQueryClient();
  const { initTransaction, updateStatus, confirmTransaction } = useTransactionStore();
  const { suiRpcOnline } = useNetworkStore();

  const [status, setStatus] = useState<UITransactionStatus>(UITransactionStatus.IDLE);
  const [ptbDescription, setPtbDescription] = useState<string | null>(null);
  const [estimatedGas, setEstimatedGas] = useState<string | null>(null);
  const [ptbBytes, setPtbBytes] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const prepareInFlightRef = useRef(false);
  const signInFlightRef = useRef(false);

  const canStartPreparation = (currentStatus: UITransactionStatus) =>
    currentStatus === UITransactionStatus.IDLE ||
    currentStatus === UITransactionStatus.FAILED ||
    currentStatus === UITransactionStatus.DRY_RUN_FAILED ||
    currentStatus === UITransactionStatus.WALLET_REJECTED ||
    currentStatus === UITransactionStatus.TIMEOUT;

  const transition = useCallback(
    (s: UITransactionStatus, digestArg?: string) => {
      setStatus(s);
      if (digestArg) {
        updateStatus(digestArg, s);
      }
    },
    [updateStatus]
  );

  const prepare = useCallback(async () => {
    if (prepareInFlightRef.current || !canStartPreparation(status)) {
      return;
    }
    prepareInFlightRef.current = true;
    // Network guard
    if (!suiRpcOnline) {
      const msg = 'Sui network is unreachable — cannot submit transaction';
      setErrorMessage(msg);
      setStatus(UITransactionStatus.DRY_RUN_FAILED);
      toast.error(msg);
      prepareInFlightRef.current = false;
      return;
    }

    setErrorMessage(null);

    try {
      // Step 1: Fetch PTB
      transition(UITransactionStatus.PREPARING);
      const ptbResult = await fetchPtb();
      setPtbDescription(ptbResult.description);
      setEstimatedGas(ptbResult.estimatedGas);
      setPtbBytes(ptbResult.ptb);
      setRelationshipId(ptbResult.relationshipId ?? null);

      // Step 2: Dry run (gas estimation)
      transition(UITransactionStatus.DRY_RUNNING);
      try {
        // @mysten/sui v2 SuiJsonRpcClient has dryRunTransactionBlock properly typed
        await suiClient.dryRunTransactionBlock({
          transactionBlock: ptbResult.ptb,
        });
      } catch (dryRunError) {
        const errMsg = dryRunError instanceof Error
          ? decodeMoveError(dryRunError.message)
          : 'Gas estimation failed';
        setErrorMessage(errMsg);
        transition(UITransactionStatus.DRY_RUN_FAILED);
        toast.error('Gas estimation failed', { description: errMsg });
        return;
      }

      // Step 3: Awaiting signature (PTB modal shows)
      transition(UITransactionStatus.AWAITING_SIGNATURE);
    } catch (error) {
      const errMsg = getApiErrorMessage(error, 'Transaction preparation failed');
      setErrorMessage(errMsg);
      setStatus(UITransactionStatus.FAILED);
      toast.error('Transaction preparation failed', { description: errMsg });
    } finally {
      prepareInFlightRef.current = false;
    }
  }, [
    status,
    suiRpcOnline,
    fetchPtb,
    transition,
  ]);

  const sign = useCallback(async () => {
    if (signInFlightRef.current) {
      return;
    }
    if (!ptbBytes) {
      await prepare();
      return;
    }

    signInFlightRef.current = true;
    try {

      // Step 4: Sign & Execute
      transition(UITransactionStatus.SIGNING);
      let txDigest: string;
      try {
        const result = await signAndExecuteTransaction(ptbBytes);
        txDigest = result.digest;
      } catch (walletError) {
        const isUserRejection =
          walletError instanceof Error &&
          (walletError.message.includes('User rejected') ||
            walletError.message.includes('cancelled'));

        if (isUserRejection) {
          setErrorMessage('You closed the wallet without signing. No funds were moved.');
          transition(UITransactionStatus.WALLET_REJECTED);
          toast.error('Signing cancelled', {
            description: 'You closed the wallet without signing. No funds were moved.',
          });
          if (relationshipId) {
            await onFailedBeforeSubmission?.(relationshipId, 'Wallet rejected before submission');
          }
        } else {
          const errMsg = walletError instanceof Error ? walletError.message : 'Wallet error';
          setErrorMessage(errMsg);
          transition(UITransactionStatus.FAILED);
          toast.error('Signing failed', { description: errMsg });
          if (relationshipId) {
            await onFailedBeforeSubmission?.(relationshipId, errMsg);
          }
        }
        return;
      }

      setDigest(txDigest);
      initTransaction(txDigest, txType);
      transition(UITransactionStatus.SIGNED, txDigest);

      // Step 5: Submit to backend webhook
      transition(UITransactionStatus.SUBMITTING, txDigest);
      await webhooksApi.submitTransactionResult({
        transactionDigest: txDigest,
        status: TransactionStatus.PENDING,
        txType,
        relationshipId: relationshipId ?? undefined,
      });

      // Step 6: Poll for confirmation (max timeoutMs)
      transition(UITransactionStatus.PENDING, txDigest);
      const toastId = toast.loading('Waiting for on-chain confirmation...');

      const confirmationTimeout = setTimeout(() => {
        transition(UITransactionStatus.TIMEOUT, txDigest);
        toast.dismiss(toastId);
        toast.warning('Transaction taking longer than expected', {
          description: `Check Sui explorer for digest: ${txDigest.slice(0, 16)}...`,
        });
      }, timeoutMs);

      try {
        // waitForTransaction is properly typed on SuiJsonRpcClient
        const txResult = await suiClient.waitForTransaction({
          digest: txDigest,
          options: { showEffects: true },
        });
        clearTimeout(confirmationTimeout);
        const chainStatus = txResult.effects?.status?.status;
        if (chainStatus !== 'success') {
          const chainError = txResult.effects?.status?.error ?? 'Transaction failed on-chain';
          const errMsg = decodeMoveError(chainError);
          setErrorMessage(errMsg);
          transition(UITransactionStatus.FAILED, txDigest);
          toast.dismiss(toastId);
          toast.error('Transaction failed on-chain', { description: errMsg });
          await webhooksApi.submitTransactionResult({
            transactionDigest: txDigest,
            status: TransactionStatus.FAILED,
            txType,
            relationshipId: relationshipId ?? undefined,
            error: chainError,
          });
          for (const key of options.invalidateKeys ?? []) {
            await queryClient.invalidateQueries({ queryKey: key });
          }
          await onFailed?.(txDigest, errMsg);
          return;
        }

        confirmTransaction(txDigest, BigInt(0));
        transition(UITransactionStatus.CONFIRMED, txDigest);
        toast.dismiss(toastId);
        toast.success('Transaction confirmed!');

        // Notify backend of confirmation
        await webhooksApi.submitTransactionResult({
          transactionDigest: txDigest,
          status: TransactionStatus.CONFIRMED,
          txType,
          relationshipId: relationshipId ?? undefined,
        });

        for (const key of options.invalidateKeys ?? []) {
          await queryClient.invalidateQueries({ queryKey: key });
        }
        await onConfirmed?.(txDigest, relationshipId);
      } catch {
        const errMsg = 'Transaction confirmation could not be verified';
        clearTimeout(confirmationTimeout);
        setErrorMessage(errMsg);
        transition(UITransactionStatus.FAILED, txDigest);
        toast.dismiss(toastId);
        toast.error('Transaction failed on-chain', { description: errMsg });
        await webhooksApi.submitTransactionResult({
          transactionDigest: txDigest,
          status: TransactionStatus.FAILED,
          txType,
          relationshipId: relationshipId ?? undefined,
          error: errMsg,
        });
        for (const key of options.invalidateKeys ?? []) {
          await queryClient.invalidateQueries({ queryKey: key });
        }
        await onFailed?.(txDigest, errMsg);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(errMsg);
      setStatus(UITransactionStatus.FAILED);
      toast.error('Transaction error', { description: errMsg });
      await onFailed?.(digest, errMsg);
    } finally {
      signInFlightRef.current = false;
    }
  }, [
    ptbBytes,
    prepare,
    signAndExecuteTransaction,
    txType,
    transition,
    initTransaction,
    confirmTransaction,
    queryClient,
    options.invalidateKeys,
    onConfirmed,
    onFailed,
    onFailedBeforeSubmission,
    digest,
    relationshipId,
    timeoutMs,
  ]);

  const reset = useCallback(() => {
    setStatus(UITransactionStatus.IDLE);
    setErrorMessage(null);
    setDigest(null);
    setRelationshipId(null);
    setPtbBytes(null);
    setPtbDescription(null);
    setEstimatedGas(null);
  }, []);

  return {
    status,
    ptbDescription,
    estimatedGas,
    ptbBytes,
    errorMessage,
    digest,
    relationshipId,
    prepare,
    sign,
    reset,
  };
}
