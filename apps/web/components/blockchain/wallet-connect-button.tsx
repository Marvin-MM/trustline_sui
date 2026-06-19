'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Check, ExternalLink, QrCode, Wallet, ChevronDown } from 'lucide-react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { QRCodeSVG } from 'qrcode.react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/utils';
import { authApi } from '@/lib/api/auth';
import { SUI_EXPLORER_URL } from '@/lib/sui-client';
import { useAuthStore } from '@/stores/auth.store';

const DAppKitConnectModal = dynamic(
  () => import('./dapp-kit-connect-modal').then((mod) => mod.DAppKitConnectModal),
  { ssr: false },
);

interface WalletConnectButtonProps {
  onConnect?: (address: string) => void | Promise<void>;
  className?: string;
  compact?: boolean;
}

/**
 * WalletConnectButton — three states:
 * 1. Disconnected: "Connect Wallet" button
 * 2. Connecting: spinner
 * 3. Connected: dropdown with address, balance, copy, QR, disconnect
 *
 * Wallet connection is handled by the official dapp-kit ConnectModal. BondFlow
 * auth is started by the optional onConnect callback once a wallet account exists.
 */
export function WalletConnectButton({ onConnect, className, compact = false }: WalletConnectButtonProps) {
  const { walletAddress, isAuthenticated, isAuthenticating, clearAuth } = useAuthStore();
  const dAppKit = useDAppKit();
  const currentAccount = useCurrentAccount();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const lastAuthAttemptAddress = useRef<string | null>(null);
  const shouldAuthenticateAfterConnect = useRef(false);

  const connectedAddress = currentAccount?.address ?? null;
  const displayAddress = connectedAddress ?? walletAddress;

  useEffect(() => {
    if (!onConnect || isAuthenticated || !currentAccount?.address) return;
    if (!shouldAuthenticateAfterConnect.current) return;
    if (lastAuthAttemptAddress.current === currentAccount.address) return;

    lastAuthAttemptAddress.current = currentAccount.address;
    void (async () => {
      try {
        await onConnect(currentAccount.address);
      } finally {
        shouldAuthenticateAfterConnect.current = false;
      }
    })();
  }, [currentAccount?.address, isAuthenticated, onConnect]);

  const handleCopy = async () => {
    if (!displayAddress) return;
    await navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async () => {
    try {
      if (currentAccount?.address) {
        shouldAuthenticateAfterConnect.current = true;
        lastAuthAttemptAddress.current = currentAccount.address; // prevent useEffect re-firing mid-auth
        try {
          await onConnect?.(currentAccount.address);
        } finally {
          shouldAuthenticateAfterConnect.current = false;
        }
        return;
      }

      shouldAuthenticateAfterConnect.current = true;
      setConnectModalOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed';
      toast.error('Wallet connection failed', { description: message });
    }
  };

  const handleDisconnect = async () => {
    try {
      await authApi.logout();
    } catch {
      // The local session should still be cleared if the backend is unavailable.
    } finally {
      localStorage.removeItem('bondflow:return-after-auth');
      clearAuth();
      lastAuthAttemptAddress.current = null;
      shouldAuthenticateAfterConnect.current = false;
      await dAppKit.disconnectWallet();
    }
  };

  if (isAuthenticating) {
    return (
      <button
        disabled
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground',
          compact ? 'h-9 px-3' : 'min-h-10 px-4 py-2',
          className
        )}
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        Authenticating...
      </button>
    );
  }

  if (!isAuthenticated || !connectedAddress) {
    return (
      <>
        <button
          id="wallet-connect-btn"
          onClick={() => void handleConnect()}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-[0.98]',
            compact ? 'h-9 px-3' : 'min-h-10 px-4 py-2',
            className
          )}
        >
          <Wallet className="h-4 w-4" />
          <span className={cn(compact && 'hidden sm:inline')}>
            {isAuthenticated ? 'Reconnect Wallet' : 'Connect Wallet'}
          </span>
        </button>
        <DAppKitConnectModal open={connectModalOpen} onClosed={() => setConnectModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            id="wallet-connected-btn"
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              compact ? 'h-9 max-w-[11rem] px-2.5' : 'min-h-10 px-3 py-2',
              className
            )}
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="min-w-0 truncate font-mono-num text-xs">{truncateAddress(connectedAddress)}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            className="z-50 min-w-[220px] rounded-xl border border-border bg-card p-1 shadow-xl animate-fade-in"
            align="end"
            sideOffset={8}
          >
            {/* Address display */}
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-xs text-muted-foreground">Connected wallet</p>
              <p className="font-mono-num text-xs text-foreground mt-0.5 break-all">
                {connectedAddress.slice(0, 20)}...
              </p>
            </div>

            <DropdownMenuPrimitive.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-muted"
              onSelect={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy address'}
            </DropdownMenuPrimitive.Item>

            <DropdownMenuPrimitive.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-muted"
              onSelect={() => setShowQr(true)}
            >
              <QrCode className="h-4 w-4" />
              Show QR code
            </DropdownMenuPrimitive.Item>

            <DropdownMenuPrimitive.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-muted"
              onSelect={() => window.open(`${SUI_EXPLORER_URL}/address/${connectedAddress}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              View on explorer
            </DropdownMenuPrimitive.Item>

            <div className="my-1 border-t border-border" />

            <DropdownMenuPrimitive.Item
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10"
              onSelect={handleDisconnect}
            >
              Disconnect
            </DropdownMenuPrimitive.Item>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      {/* QR Code Dialog */}
      <DialogPrimitive.Root open={showQr} onOpenChange={setShowQr}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl">
            <DialogPrimitive.Title className="mb-4 text-center text-sm font-semibold text-foreground">
              Wallet Address QR
            </DialogPrimitive.Title>
            <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={connectedAddress} size={200} />
            </div>
            <p className="mt-4 text-center font-mono-num text-xs text-muted-foreground break-all">
              {connectedAddress}
            </p>
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded text-muted-foreground hover:text-foreground">
              ✕
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
