/**
 * Network status store.
 * Populated by NetworkStatusProvider which monitors:
 * - Browser online/offline events
 * - Backend health ping (every 30s)
 * - Sui RPC availability (every 60s)
 */

import { create } from 'zustand';

interface NetworkState {
  browserOnline: boolean;
  backendOnline: boolean;
  suiRpcOnline: boolean;

  // Derived
  isFullyOnline: boolean;

  setBrowserOnline: (v: boolean) => void;
  setBackendOnline: (v: boolean) => void;
  setSuiRpcOnline: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  browserOnline: true,
  backendOnline: true,
  suiRpcOnline: true,
  isFullyOnline: true,

  setBrowserOnline: (v) =>
    set((state) => ({
      browserOnline: v,
      isFullyOnline: v && state.backendOnline && state.suiRpcOnline,
    })),

  setBackendOnline: (v) =>
    set((state) => ({
      backendOnline: v,
      isFullyOnline: state.browserOnline && v && state.suiRpcOnline,
    })),

  setSuiRpcOnline: (v) =>
    set((state) => ({
      suiRpcOnline: v,
      isFullyOnline: state.browserOnline && state.backendOnline && v,
    })),
}));
