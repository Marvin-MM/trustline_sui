'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { getOrCreateQueryClient } from '@/lib/query-client';
import { dAppKit } from '@/lib/dapp-kit';
import { FeatureFlagProvider } from '@/components/providers/feature-flag-provider';
import { NetworkStatusProvider } from '@/components/providers/network-status-provider';
import { TenantBootstrap } from '@/components/providers/tenant-bootstrap';
import { RealtimeProvider } from '@/components/providers/realtime-provider';
import { NetworkStatusBanner } from '@/components/network/network-status-banner';

/**
 * Providers — root client-side provider tree.
 * Order matters:
 * 1. ThemeProvider (wraps everything for dark mode)
 * 2. QueryClientProvider (React Query)
 * 3. NetworkStatusProvider (monitors connectivity)
 * 4. TenantBootstrap (restores tenant on refresh)
 * 5. FeatureFlagProvider (fetches flags after auth)
 * 6. Toaster (sonner — at root so it's always accessible)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getOrCreateQueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <DAppKitProvider dAppKit={dAppKit}>
        <QueryClientProvider client={queryClient}>
          <NetworkStatusProvider>
            <TenantBootstrap>
              <FeatureFlagProvider>
                <RealtimeProvider>
                  <NetworkStatusBanner />
                  {children}
                  <Toaster
                    richColors
                    position="bottom-right"
                    closeButton
                    toastOptions={{
                      classNames: {
                        toast: 'font-sans',
                      },
                    }}
                  />
                </RealtimeProvider>
              </FeatureFlagProvider>
            </TenantBootstrap>
          </NetworkStatusProvider>
        </QueryClientProvider>
      </DAppKitProvider>
    </ThemeProvider>
  );
}
