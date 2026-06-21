/**
 * UI-specific transaction status enum.
 *
 * This is DIFFERENT from the backend's TransactionStatus (PENDING | CONFIRMED | FAILED).
 * This enum drives the full client-side state machine for wallet interactions.
 * The backend enum lives in @bondflow/types. Do not import the backend enum here.
 */
export enum UITransactionStatus {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',          // fetching PTB from backend
  DRY_RUNNING = 'DRY_RUNNING',      // running gas estimate
  DRY_RUN_FAILED = 'DRY_RUN_FAILED', // simulation failed — show reason
  AWAITING_SIGNATURE = 'AWAITING_SIGNATURE', // wallet modal open
  SIGNING = 'SIGNING',              // wallet processing
  WALLET_REJECTED = 'WALLET_REJECTED', // user dismissed wallet
  SIGNED = 'SIGNED',                // signature obtained
  SUBMITTING = 'SUBMITTING',        // sending to backend webhook
  PENDING = 'PENDING',              // on-chain, awaiting confirmation
  FINALIZING = 'FINALIZING',        // confirmed on-chain, reconciling backend lifecycle work
  CONFIRMED = 'CONFIRMED',          // tx confirmed
  FAILED = 'FAILED',                // tx failed on-chain
  TIMEOUT = 'TIMEOUT',              // confirmation not received in 60s
}

export const UI_TRANSACTION_STATUS_MESSAGES: Record<UITransactionStatus, string> = {
  [UITransactionStatus.IDLE]: 'Ready',
  [UITransactionStatus.PREPARING]: 'Preparing transaction...',
  [UITransactionStatus.DRY_RUNNING]: 'Estimating gas...',
  [UITransactionStatus.DRY_RUN_FAILED]: 'Gas estimation failed',
  [UITransactionStatus.AWAITING_SIGNATURE]: 'Waiting for your signature...',
  [UITransactionStatus.SIGNING]: 'Signing in wallet...',
  [UITransactionStatus.WALLET_REJECTED]: 'You closed the wallet without signing. No funds were moved.',
  [UITransactionStatus.SIGNED]: 'Signed — submitting...',
  [UITransactionStatus.SUBMITTING]: 'Submitting to network...',
  [UITransactionStatus.PENDING]: 'Transaction submitted — awaiting confirmation...',
  [UITransactionStatus.FINALIZING]: 'Confirmed on-chain — finalizing lifecycle updates...',
  [UITransactionStatus.CONFIRMED]: 'Transaction confirmed!',
  [UITransactionStatus.FAILED]: 'Transaction failed on-chain.',
  [UITransactionStatus.TIMEOUT]:
    'The transaction is taking longer than expected. Check the Sui explorer for status.',
};

export interface ActiveTransaction {
  digest: string;
  status: UITransactionStatus;
  txType: string;
  errorMessage?: string;
  gasUsed?: bigint;
  confirmedAt?: number;
}
