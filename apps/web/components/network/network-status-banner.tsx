'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, ServerCrash, Radio } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

/**
 * NetworkStatusBanner — sticky banner shown when any network layer is degraded.
 * Cannot be dismissed — financial apps must communicate network problems clearly.
 * Uses framer-motion AnimatePresence for smooth appear/disappear.
 */
export function NetworkStatusBanner() {
  const { browserOnline, backendOnline, suiRpcOnline } = useNetworkStatus();

  let message: string | null = null;
  let icon = WifiOff;
  let colorClasses = '';

  if (!browserOnline) {
    message = "You're offline. Changes will not be saved.";
    icon = WifiOff;
    colorClasses = 'bg-zinc-900 text-zinc-100 dark:bg-zinc-800';
  } else if (!backendOnline) {
    message = 'BondFlow services are temporarily unavailable. Your wallet and on-chain data are safe.';
    icon = ServerCrash;
    colorClasses = 'bg-amber-600 text-white';
  } else if (!suiRpcOnline) {
    message = 'Sui network is unreachable. Transaction submission is paused.';
    icon = Radio;
    colorClasses = 'bg-orange-600 text-white';
  }

  const Icon = icon;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn('sticky top-0 z-40 w-full overflow-hidden', colorClasses)}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium">
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
