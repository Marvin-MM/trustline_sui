'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Fuel, Network, Wallet, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn, formatGas, decodeMoveError } from '@/lib/utils';
import { UITransactionStatus, UI_TRANSACTION_STATUS_MESSAGES } from '@/lib/transaction-status';
import { AddressDisplay } from './address-display';
import { useAuthStore } from '@/stores/auth.store';
import { SUI_NETWORK } from '@/lib/sui-client';

interface PtbPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string | null;
  estimatedGas: string | null;
  ptbBytes: string | null;
  status: UITransactionStatus;
  errorMessage: string | null;
  digest: string | null;
  walletAddress?: string | null;
  walletConnected?: boolean;
  walletWarning?: string | null;
  onConnectWallet?: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  [UITransactionStatus.PREPARING]: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  [UITransactionStatus.DRY_RUNNING]: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  [UITransactionStatus.AWAITING_SIGNATURE]: <CheckCircle className="h-5 w-5 text-amber-500" />,
  [UITransactionStatus.SIGNING]: <Loader2 className="h-5 w-5 animate-spin text-violet-500" />,
  [UITransactionStatus.SIGNED]: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  [UITransactionStatus.SUBMITTING]: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  [UITransactionStatus.PENDING]: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  [UITransactionStatus.FINALIZING]: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  [UITransactionStatus.CONFIRMED]: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  [UITransactionStatus.FAILED]: <XCircle className="h-5 w-5 text-destructive" />,
  [UITransactionStatus.DRY_RUN_FAILED]: <AlertCircle className="h-5 w-5 text-destructive" />,
  [UITransactionStatus.WALLET_REJECTED]: <XCircle className="h-5 w-5 text-destructive" />,
};

function getConfirmLabel(status: UITransactionStatus): string {
  switch (status) {
    case UITransactionStatus.PREPARING: return 'Preparing transaction...';
    case UITransactionStatus.DRY_RUNNING: return 'Estimating Gas...';
    case UITransactionStatus.AWAITING_SIGNATURE: return 'Sign & Submit';
    case UITransactionStatus.SIGNING: return 'Signing...';
    case UITransactionStatus.SIGNED: return 'Submitting...';
    case UITransactionStatus.SUBMITTING: return 'Submitting...';
    case UITransactionStatus.PENDING: return 'Confirming...';
    case UITransactionStatus.FINALIZING: return 'Finalizing...';
    case UITransactionStatus.CONFIRMED: return 'Done';
    case UITransactionStatus.FAILED:
    case UITransactionStatus.DRY_RUN_FAILED:
    case UITransactionStatus.WALLET_REJECTED:
    case UITransactionStatus.TIMEOUT:
      return 'Close';
    default: return 'Sign & Submit';
  }
}

/**
 * PTBPreviewModal — the most important component.
 * Shows: description, gas estimate, PTB commands, network badge,
 * wallet address, full status machine feedback.
 * Confirm button disabled during DRY_RUNNING and DRY_RUN_FAILED.
 */
export function PtbPreviewModal({
  open,
  onOpenChange,
  description,
  estimatedGas,
  ptbBytes,
  status,
  errorMessage,
  digest,
  walletAddress: walletAddressProp,
  walletConnected = true,
  walletWarning = null,
  onConnectWallet,
  onConfirm,
  onClose,
}: PtbPreviewModalProps) {
  const { walletAddress: authWalletAddress } = useAuthStore();
  const walletAddress = walletAddressProp ?? authWalletAddress;
  const [showPtb, setShowPtb] = useState(false);
  const isTerminal =
    status === UITransactionStatus.CONFIRMED ||
    status === UITransactionStatus.FAILED ||
    status === UITransactionStatus.DRY_RUN_FAILED ||
    status === UITransactionStatus.WALLET_REJECTED ||
    status === UITransactionStatus.TIMEOUT;

  const isDisabled =
    (!walletConnected && !isTerminal) ||
    status === UITransactionStatus.DRY_RUNNING ||
    status === UITransactionStatus.PREPARING ||
    status === UITransactionStatus.SIGNING ||
    status === UITransactionStatus.SIGNED ||
    status === UITransactionStatus.SUBMITTING ||
    status === UITransactionStatus.PENDING ||
    status === UITransactionStatus.FINALIZING;

  const isError =
    status === UITransactionStatus.DRY_RUN_FAILED ||
    status === UITransactionStatus.FAILED ||
    status === UITransactionStatus.WALLET_REJECTED;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <AnimatePresence>
          {open && (
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="fixed left-1/2 top-1/2 z-[80] flex max-h-[min(90vh,720px)] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl [translate:-50%_-50%] outline-none sm:rounded-2xl"
              >
                {/* Header */}
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                      Sign Transaction
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                      Review before signing. No funds move until you confirm.
                    </DialogPrimitive.Description>
                  </div>
                  <DialogPrimitive.Close
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </DialogPrimitive.Close>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                  {/* Description */}
                  {description && (
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{description}</p>
                    </div>
                  )}

                  {/* Status */}
                  <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                    {STATUS_ICON[status] ?? <div className="h-5 w-5 rounded-full bg-muted" />}
                    <div>
                      <p className="text-xs font-medium text-foreground">{status}</p>
                      <p className="text-xs text-muted-foreground">
                        {UI_TRANSACTION_STATUS_MESSAGES[status]}
                      </p>
                    </div>
                  </div>

                  {/* Error message */}
                  {isError && errorMessage && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                      <p className="text-xs font-medium text-destructive">
                        {decodeMoveError(errorMessage)}
                      </p>
                    </div>
                  )}

                  {!walletConnected && (
                    <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 dark:border-amber-800/70 dark:bg-amber-950/30">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                            Wallet connection required
                          </p>
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            {walletWarning ?? 'Reconnect your wallet before signing this transaction.'}
                          </p>
                        </div>
                        {onConnectWallet && (
                          <button
                            type="button"
                            onClick={onConnectWallet}
                            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-background px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950"
                          >
                            Reconnect Wallet
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gas + Network + Wallet */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Est. Gas</span>
                      </div>
                      <p className="font-mono-num text-xs font-medium text-foreground">
                        {estimatedGas ? formatGas(BigInt(estimatedGas)) : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Network className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Network</span>
                      </div>
                      <p className="text-xs font-medium text-foreground capitalize">{SUI_NETWORK}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="mb-1 flex items-center gap-1.5">
                        <Wallet className={cn('h-3.5 w-3.5', walletConnected ? 'text-muted-foreground' : 'text-amber-600')} />
                        <span className="text-xs text-muted-foreground">Wallet</span>
                      </div>
                      {walletAddress && (
                        <AddressDisplay
                          address={walletAddress}
                          truncate
                          copyable={false}
                          link={false}
                          size="sm"
                        />
                      )}
                      {!walletAddress && (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Not connected</p>
                      )}
                    </div>
                  </div>

                  {/* PTB raw bytes toggle */}
                  {ptbBytes && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => setShowPtb((v) => !v)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <span>View raw PTB</span>
                        {showPtb ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {showPtb && (
                        <div className="border-t border-border bg-muted/30 p-4">
                          <pre className="overflow-x-auto font-mono-num text-xs text-muted-foreground whitespace-pre-wrap break-all">
                            {ptbBytes.slice(0, 500)}{ptbBytes.length > 500 ? '...' : ''}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirmed digest */}
                  {status === UITransactionStatus.CONFIRMED && digest && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        Transaction confirmed
                      </p>
                      <a
                        href={`${SUI_NETWORK === 'testnet' ? 'https://testnet.suivision.xyz' : 'https://suivision.xyz'}/txblock/${digest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono-num text-xs text-emerald-600 underline dark:text-emerald-400"
                      >
                        {digest.slice(0, 32)}...
                      </a>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                  <button
                    onClick={onClose}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={isTerminal ? onClose : onConfirm}
                    disabled={isDisabled}
                    className={cn(
                      'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-all',
                      isDisabled
                        ? 'bg-brand/50 cursor-not-allowed'
                        : 'bg-brand hover:bg-brand/90 active:scale-95'
                    )}
                  >
                    {(status === UITransactionStatus.PREPARING || status === UITransactionStatus.SIGNING || status === UITransactionStatus.SIGNED || status === UITransactionStatus.SUBMITTING || status === UITransactionStatus.PENDING || status === UITransactionStatus.FINALIZING || status === UITransactionStatus.DRY_RUNNING) && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {getConfirmLabel(status)}
                  </button>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          )}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
