import axios from 'axios';

interface ApiErrorPayload {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  details?: {
    asset?: { symbol?: unknown; decimals?: unknown };
    requiredPaymentBaseUnits?: unknown;
    balanceBaseUnits?: unknown;
  };
}

function formatBaseUnits(value: unknown, decimals: number): string | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const base = 10n ** BigInt(decimals);
  const amount = BigInt(value);
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const payload = error.response?.data;
  const message = typeof payload?.error === 'string'
    ? payload.error
    : typeof payload?.message === 'string'
      ? payload.message
      : error.message;

  if (payload?.code === 'INSUFFICIENT_PAYMENT_BALANCE') {
    const decimals = typeof payload.details?.asset?.decimals === 'number'
      ? payload.details.asset.decimals
      : 6;
    const symbol = typeof payload.details?.asset?.symbol === 'string'
      ? payload.details.asset.symbol
      : 'USDC';
    const required = formatBaseUnits(payload.details?.requiredPaymentBaseUnits, decimals);
    const available = formatBaseUnits(payload.details?.balanceBaseUnits, decimals);
    if (required && available) {
      return `${message} Required: ${required} ${symbol}. Available: ${available} ${symbol}.`;
    }
  }

  return message || fallback;
}
