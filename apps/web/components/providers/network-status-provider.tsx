'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNetworkStore } from '@/stores/network.store';
import { suiClient } from '@/lib/sui-client';
import { queryKeys } from '@/lib/query-keys';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

/**
 * NetworkStatusProvider — monitors browser online/offline, backend health, and Sui RPC.
 * Updates the Zustand network store with the results.
 *
 * Monitoring intervals:
 * - Browser online/offline: native browser events (instant)
 * - Backend health: GET /api/v1/health every 30s via React Query
 * - Sui RPC: getLatestCheckpointSequenceNumber every 60s
 */
export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const setBrowserOnline = useNetworkStore((s) => s.setBrowserOnline);
  const setBackendOnline = useNetworkStore((s) => s.setBackendOnline);
  const setSuiRpcOnline = useNetworkStore((s) => s.setSuiRpcOnline);

  // 1. Browser online/offline
  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    setBrowserOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setBrowserOnline]);

  // 2. Backend health ping (every 30s)
  const backendHealth = useQuery({
    queryKey: queryKeys.health.backend(),
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('Backend unhealthy');
      return res.json();
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  // Update network store based on query state (React Query v5 — no onSuccess/onError in useQuery)
  useEffect(() => {
    if (backendHealth.isSuccess) setBackendOnline(true);
    if (backendHealth.isError) setBackendOnline(false);
  }, [backendHealth.isSuccess, backendHealth.isError, setBackendOnline]);

  // 3. Sui RPC check (every 60s)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const checkSuiRpc = async () => {
      try {
        await suiClient.getLatestCheckpointSequenceNumber();
        setSuiRpcOnline(true);
      } catch {
        setSuiRpcOnline(false);
      }
      timer = setTimeout(checkSuiRpc, 60_000);
    };

    void checkSuiRpc();
    return () => clearTimeout(timer);
  }, [setSuiRpcOnline]);

  return <>{children}</>;
}
