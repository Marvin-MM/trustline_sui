'use client';

import { useShallow } from 'zustand/react/shallow';
import { useNetworkStore } from '@/stores/network.store';

/**
 * Returns the current network status from the Zustand network store.
 * Updated by NetworkStatusProvider (browser events + health pings).
 */
export function useNetworkStatus() {
  return useNetworkStore(
    useShallow((s) => ({
      browserOnline: s.browserOnline,
      backendOnline: s.backendOnline,
      suiRpcOnline: s.suiRpcOnline,
      isFullyOnline: s.isFullyOnline,
    }))
  );
}
