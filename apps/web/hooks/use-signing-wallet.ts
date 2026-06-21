'use client';

import { useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useAuthStore } from '@/stores/auth.store';

export interface SigningWalletState {
  authenticatedAddress: string | null;
  connectedAddress: string | null;
  displayAddress: string | null;
  isConnected: boolean;
  isMatch: boolean;
  warning: string | null;
  assertCanSign: () => void;
}

export function getSigningWalletWarning(
  authenticatedAddress: string | null,
  connectedAddress: string | null,
): string | null {
  if (!authenticatedAddress) {
    return 'Sign in with a wallet before signing this transaction.';
  }
  if (!connectedAddress) {
    return 'Your TrustLine session is active, but no wallet is connected for signing. Reconnect the same wallet to continue.';
  }
  if (authenticatedAddress.toLowerCase() !== connectedAddress.toLowerCase()) {
    return 'The connected wallet does not match your TrustLine session. Switch to the authenticated wallet before signing.';
  }
  return null;
}

export function useSigningWallet(): SigningWalletState {
  const currentAccount = useCurrentAccount();
  const authenticatedAddress = useAuthStore((state) => state.walletAddress);
  const connectedAddress = currentAccount?.address ?? null;
  const warning = getSigningWalletWarning(authenticatedAddress, connectedAddress);
  const isConnected = connectedAddress !== null;
  const isMatch = warning === null;

  const assertCanSign = useCallback(() => {
    const currentWarning = getSigningWalletWarning(authenticatedAddress, connectedAddress);
    if (currentWarning) {
      throw new Error(currentWarning);
    }
  }, [authenticatedAddress, connectedAddress]);

  return {
    authenticatedAddress,
    connectedAddress,
    displayAddress: connectedAddress ?? authenticatedAddress,
    isConnected,
    isMatch,
    warning,
    assertCanSign,
  };
}
