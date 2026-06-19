import { type LucideIcon, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureUnavailableCardProps {
  icon?: LucideIcon;
  featureName: string;
  description?: string;
  className?: string;
}

/**
 * FeatureUnavailableCard — shown when a feature flag is disabled.
 * Prevents confusing empty pages. Always explains WHY the page is empty.
 */
export function FeatureUnavailableCard({
  icon: Icon = Lock,
  featureName,
  description,
  className,
}: FeatureUnavailableCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-16 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{featureName}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {description ?? 'This feature is not enabled for your workspace.'}
      </p>
      <div className="mt-4 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        Contact your workspace admin to enable this feature
      </div>
    </div>
  );
}
