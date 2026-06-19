import { cn, formatAmount, formatRelativeTime } from '@/lib/utils';

interface AmountDisplayProps {
  /** Amount in base units (bigint or string representation) */
  amount: bigint | string;
  /** Decimal places (9 for SUI MIST, 6 for USDC) */
  decimals?: number;
  /** Token symbol to append */
  symbol?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Show sign (+ or -) for delta amounts */
  showSign?: 'positive' | 'negative' | false;
}

const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl font-bold',
};

/**
 * AmountDisplay — renders financial amounts from base units.
 * Always uses JetBrains Mono for alignment and readability.
 * Uses Intl.NumberFormat for locale-correct thousands separators.
 */
export function AmountDisplay({
  amount,
  decimals = 9,
  symbol = 'SUI',
  size = 'md',
  className,
  showSign = false,
}: AmountDisplayProps) {
  const formatted = formatAmount(amount, decimals, '');
  const displayValue = showSign === 'positive' ? `+${formatted}` : showSign === 'negative' ? `-${formatted}` : formatted;

  return (
    <span
      className={cn(
        'font-mono-num tabular-nums',
        SIZE_CLASSES[size],
        showSign === 'positive' && 'text-emerald-600 dark:text-emerald-400',
        showSign === 'negative' && 'text-destructive',
        className
      )}
    >
      {displayValue}
      {symbol && (
        <span className="ml-1 text-muted-foreground text-[0.8em]">{symbol}</span>
      )}
    </span>
  );
}
