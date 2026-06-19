'use client';

import React, { Component, type ReactNode } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { WalletConnectButton } from './wallet-connect-button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * WalletErrorBoundary — catches errors from @mysten/dapp-kit-react hooks.
 * Handles RPC failures, wallet disconnection during transactions, network switching.
 *
 * Renders "Wallet connection lost. Please reconnect." with a reconnect CTA.
 * Wrap all wallet-dependent UI with this boundary.
 */
export class WalletErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env['NODE_ENV'] === 'development') {
      console.error('[WalletErrorBoundary]', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-8 text-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <WifiOff className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Wallet connection lost</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please reconnect your wallet to continue.
            </p>
          </div>
          <WalletConnectButton onConnect={this.handleReset} />
        </div>
      );
    }

    return this.props.children;
  }
}
