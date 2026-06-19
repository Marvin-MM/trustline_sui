'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn, truncateAddress } from '@/lib/utils';
import { SUI_EXPLORER_URL } from '@/lib/sui-client';

interface AddressDisplayProps {
  address: string;
  truncate?: boolean;
  copyable?: boolean;
  link?: boolean;
  showQr?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * AddressDisplay — renders a Sui address in JetBrains Mono with optional copy and explorer link.
 */
export function AddressDisplay({
  address,
  truncate = true,
  copyable = true,
  link = true,
  className,
  size = 'md',
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayAddress = truncate ? truncateAddress(address) : address;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <span
              className={cn(
                'font-mono-num text-muted-foreground',
                sizeClasses[size]
              )}
            >
              {displayAddress}
            </span>
          </TooltipPrimitive.Trigger>
          {truncate && (
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                className="z-50 max-w-xs rounded-lg border border-border bg-card px-3 py-1.5 font-mono-num text-xs text-foreground shadow-lg"
                side="top"
              >
                {address}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          )}
        </TooltipPrimitive.Root>

        {copyable && (
          <button
            onClick={handleCopy}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Copy address"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {link && (
          <a
            href={`${SUI_EXPLORER_URL}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="View on Sui explorer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </span>
    </TooltipPrimitive.Provider>
  );
}
