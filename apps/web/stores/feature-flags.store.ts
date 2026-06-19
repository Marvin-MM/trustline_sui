/**
 * Feature flags store.
 *
 * Populated by FeatureFlagProvider on mount (and every 60 seconds thereafter).
 * All flag checks are synchronous — never fetch in components.
 * Returns false for any unknown flag (safe default).
 */

import { create } from 'zustand';

interface FeatureFlagsState {
  flags: Record<string, boolean>;
  loadedAt: number | null;
  tenantId: string | null;

  setFlags: (flags: Record<string, boolean>, tenantId: string | null) => void;
  getFlag: (key: string) => boolean;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  flags: {},
  loadedAt: null,
  tenantId: null,

  setFlags: (flags, tenantId) =>
    set({ flags, loadedAt: Date.now(), tenantId }),

  getFlag: (key) => get().flags[key] ?? false,
}));
