'use client';

import { useFeatureFlagsStore } from '@/stores/feature-flags.store';

/**
 * Synchronously check if a feature flag is enabled.
 * Returns false for any unknown flag (safe default).
 * Never fetches — always reads from the store populated by FeatureFlagProvider.
 */
export function useFeatureFlag(key: string): boolean {
  return useFeatureFlagsStore((s) => s.getFlag(key));
}

/**
 * Returns all feature flags as a record.
 */
export function useAllFeatureFlags(): Record<string, boolean> {
  return useFeatureFlagsStore((s) => s.flags);
}
