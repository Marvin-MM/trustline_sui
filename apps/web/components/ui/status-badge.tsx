import { cn } from '@/lib/utils';
import { getStatusVariant } from '@/constants/status-variants';

interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * StatusBadge — reads from STATUS_VARIANT_MAP exclusively.
 * Never hardcodes colours. Pass any status string — unknown ones get a zinc fallback.
 */
export function StatusBadge({ status, showDot = true, className, size = 'md' }: StatusBadgeProps) {
  const variant = getStatusVariant(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        variant.bg,
        variant.text,
        className
      )}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', variant.dot)}
          aria-hidden="true"
        />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
}
