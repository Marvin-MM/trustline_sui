/**
 * STATUS_VARIANT_MAP — Single source of truth for all status badge styling.
 * Every StatusBadge in the app MUST reference this map.
 * Never hardcode colours per component.
 */

export interface StatusVariant {
  bg: string;
  text: string;
  dot: string;
  border: string;
}

export const STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  // Relationship statuses
  PENDING_ON_CHAIN: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
  ACTIVE: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    border: 'border-blue-200 dark:border-blue-800',
  },
  COMPLETED: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  CANCELLED: {
    bg: 'bg-zinc-100 dark:bg-zinc-800/50',
    text: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
  FAILED_ON_CHAIN: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-800',
  },

  // Milestone statuses
  PENDING: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
  CONDITION_MET: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-300',
    dot: 'bg-cyan-500',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
  RELEASED: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  DISPUTED: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-800',
  },

  // Transaction statuses (UI)
  IDLE: {
    bg: 'bg-zinc-100 dark:bg-zinc-800/50',
    text: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
  PREPARING: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  DRY_RUNNING: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  DRY_RUN_FAILED: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-800',
  },
  AWAITING_SIGNATURE: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
  SIGNING: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
    border: 'border-violet-200 dark:border-violet-800',
  },
  WALLET_REJECTED: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-800',
  },
  SIGNED: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  SUBMITTING: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  CONFIRMED: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  FAILED: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-800',
  },
  TIMEOUT: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },

  // AI decision badges
  VERIFIED: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  REJECTED: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    border: 'border-rose-200 dark:border-rose-800',
  },
  FLAGGED: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
  CLEAN: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-800',
  },

  // Fallback
  UNKNOWN: {
    bg: 'bg-zinc-100 dark:bg-zinc-800/50',
    text: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
} as const;

/**
 * Get a status variant safely with a fallback.
 */
export function getStatusVariant(status: string): StatusVariant {
  return STATUS_VARIANT_MAP[status] ?? STATUS_VARIANT_MAP['UNKNOWN']!;
}
