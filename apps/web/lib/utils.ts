import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a Sui address to 0x1234...5678 format */
export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address) return '';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/** Validate a Sui wallet address */
export function isValidSuiAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(address);
}

/**
 * Format a BigInt amount from base units (MIST) to display value (SUI/USDC).
 * @param amount - amount in base units as bigint or string
 * @param decimals - number of decimal places (9 for SUI, 6 for USDC)
 */
export function formatAmount(
  amount: bigint | string,
  decimals = 9,
  symbol = 'SUI'
): string {
  const bigAmount = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = bigAmount / divisor;
  const fractional = bigAmount % divisor;

  const fractionalStr = fractional.toString().padStart(decimals, '0');
  // Show up to 4 significant fractional digits
  const trimmedFractional = fractionalStr.replace(/0+$/, '').slice(0, 4);

  const formatted =
    trimmedFractional
      ? `${whole.toLocaleString()}.${trimmedFractional}`
      : whole.toLocaleString();

  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUsdc(amount: bigint | string): string {
  return formatAmount(amount, 6, 'USDC');
}

/**
 * Format SUI amount (9 decimals / MIST)
 */
export function formatSui(amount: bigint | string): string {
  return formatAmount(amount, 9, 'SUI');
}

/**
 * Format gas amount in MIST to a human-readable SUI value
 */
export function formatGas(mist: bigint | string): string {
  return formatSui(mist);
}

/**
 * Format a relative timestamp (e.g. "3 minutes ago")
 */
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format an absolute timestamp
 */
export function formatAbsoluteTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return format(date, 'MMM d, yyyy HH:mm:ss');
}

/**
 * Format a cost estimate in USD
 */
export function formatCost(usd: number): string {
  if (usd < 0.001) return `~$${(usd * 1000).toFixed(3)}m`;
  return `~$${usd.toFixed(4)}`;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i] ?? 'B'}`;
}

/**
 * Generate a slug from a name
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Decode a Move error message into plain English where possible.
 */
export function decodeMoveError(error: string): string {
  const abortCodeMatch = /abort code: (\d+)/.exec(error);
  if (abortCodeMatch) {
    const code = parseInt(abortCodeMatch[1] ?? '0', 10);
    const errorMap: Record<number, string> = {
      1: 'Insufficient balance',
      2: 'Milestone already released',
      3: 'Relationship is cancelled',
      4: 'Not authorized to perform this action',
      5: 'Milestone condition not met',
      6: 'Invalid milestone index',
      7: 'Agent capability expired',
      8: 'Agent capability revoked',
      9: 'Dispute already exists',
      10: 'No active dispute',
    };
    return errorMap[code] ?? `On-chain error (code ${code})`;
  }
  return error;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
