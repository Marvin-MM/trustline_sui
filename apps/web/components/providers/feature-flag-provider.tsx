'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { featureFlagsApi } from '@/lib/api/feature-flags';
import { useFeatureFlagsStore } from '@/stores/feature-flags.store';
import { useAuthStore } from '@/stores/auth.store';
import { queryKeys } from '@/lib/query-keys';

/**
 * FeatureFlagProvider — fetches flags on mount and every 60 seconds.
 * Matching the backend's Redis cache TTL so clients always see current flags.
 *
 * Renders no UI — just manages the feature flags Zustand store.
 * Must be rendered inside the providers tree after auth is resolved.
 */
export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, tenantId } = useAuthStore();
  const { setFlags } = useFeatureFlagsStore();

  const { data } = useQuery({
    queryKey: queryKeys.featureFlags.byTenant(tenantId),
    queryFn: () => featureFlagsApi.getAll(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  useEffect(() => {
    if (data) {
      const flagMap = Object.fromEntries(data.map((f) => [f.key, f.enabled]));
      setFlags(flagMap, tenantId);
    }
  }, [data, tenantId, setFlags]);

  return <>{children}</>;
}
