'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { useAuthStore } from '@/stores/auth.store';
import { useWalletAuth } from '@/hooks/use-wallet-auth';
import { WalletConnectButton } from '@/components/blockchain/wallet-connect-button';
import { NotificationPopover } from '@/components/notifications/notification-popover';

export function TopBar() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const { signIn } = useWalletAuth();
  const dAppKit = useDAppKit();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md transition-[height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-14 sm:px-6 z-30">
      {/* Left: Context / Breadcrumbs */}
      <div className="flex flex-1 items-center gap-2">
        {/* Breadcrumbs can be dynamically injected here in the future */}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95"
          aria-label="Toggle dark mode"
        >
          {mounted ? (
            resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </button>

        {/* Notifications */}
        {isAuthenticated && (
          <NotificationPopover />
        )}

        <div className="h-4 w-px bg-border mx-1" aria-hidden="true" />

        {/* Wallet */}
        <WalletConnectButton
          compact
          className="rounded-full shadow-sm"
          onConnect={(address) =>
            signIn(address, async (message) => {
              const result = await dAppKit.signPersonalMessage({
                message: new TextEncoder().encode(message),
              });
              return result.signature;
            })
          }
        />
      </div>
    </header>
  );
}
