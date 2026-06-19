'use client';

/**
 * use-wallet-auth — orchestrates the full SIWS (Sign-In With Sui) flow.
 *
 * Flow:
 * 1. Request nonce from backend (tied to wallet address)
 * 2. Trigger wallet signing with the canonical message
 * 3. POST signature to backend → receive access token
 * 4. Set auth store (token in memory only)
 * 5. Bootstrap tenant (fetch memberships, restore from localStorage)
 * 6. Redirect to appropriate dashboard
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/lib/api/auth';
import { ROUTES } from '@/constants/routes';
import { TenantRole } from '@bondflow/types';

const TENANT_STORAGE_KEY = 'bondflow:active-tenant';
const RETURN_PATH_KEY = 'bondflow:return-after-auth';
export function useWalletAuth() {
  const router = useRouter();
  const { setAuth, setAuthenticating, setActiveTenant } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback(
    async (walletAddress: string, signMessage: (message: string) => Promise<string>) => {
      setIsLoading(true);
      setAuthenticating(true);

      try {
        // Step 1: Get nonce
        const { message } = await authApi.getNonce(walletAddress);

        // Step 2: Sign message
        let signature: string;
        try {
          signature = await signMessage(message);
        } catch {
          // User rejected the signing request
          toast.error('Signing cancelled', { description: 'You must sign the message to authenticate.' });
          return;
        }

        // Step 3: Verify signature → receive tokens
        const authResponse = await authApi.verifySignature({
          walletAddress,
          signature,
          message,
        });

        // Step 4: Set auth state (access token in memory)
        setAuth({
          walletAddress,
          accessToken: authResponse.accessToken,
          userId: authResponse.user.id,
          isPlatformAdmin: authResponse.user.isPlatformAdmin,
        });

        // Step 5: Bootstrap route. Fresh logins land in personal mode; forced
        // re-auth returns to the protected page that triggered logout.
        await bootstrapTenant(setActiveTenant, router);
      } catch (error) {
        console.error('[useWalletAuth] Authentication failed:', error);
        const axiosData = (error as { response?: { data?: { error?: string; message?: string } } }).response?.data;
        const backendMessage = axiosData?.error ?? axiosData?.message;
        toast.error('Authentication failed', {
          description: backendMessage ?? 'Could not authenticate with BondFlow. Please try again.',
        });
      } finally {
        setIsLoading(false);
        setAuthenticating(false);
      }
    },
    [setAuth, setAuthenticating, setActiveTenant, router]
  );

  return { signIn, isLoading };
}

/**
 * Bootstrap tenant: fetch memberships, restore from localStorage, set active tenant, redirect.
 */
async function bootstrapTenant(
  setActiveTenant: (params: {
    tenantId: string | null;
    tenantSlug: string | null;
    tenantRole: TenantRole | null;
    tenantName: string | null;
  }) => void,
  router: ReturnType<typeof useRouter>
) {
  const returnPath = localStorage.getItem(RETURN_PATH_KEY);
  localStorage.removeItem(RETURN_PATH_KEY);

  setActiveTenant({ tenantId: null, tenantSlug: null, tenantRole: null, tenantName: null });
  if (returnPath && returnPath.startsWith('/') && !returnPath.startsWith('/auth')) {
    router.push(returnPath);
    return;
  }

  localStorage.removeItem(TENANT_STORAGE_KEY);
  router.push(ROUTES.dashboard());
}
