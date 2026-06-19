'use client';

import { useEffect, useRef } from 'react';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';
import type { DAppKitConnectModal as DAppKitConnectModalElement } from '@mysten/dapp-kit-core/web';

interface DAppKitConnectModalProps {
  open: boolean;
  onClosed: () => void;
}

export function DAppKitConnectModal({ open, onClosed }: DAppKitConnectModalProps) {
  const ref = useRef<DAppKitConnectModalElement | null>(null);

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;

    modal.addEventListener('closed', onClosed);
    return () => modal.removeEventListener('closed', onClosed);
  }, [onClosed]);

  return <ConnectModal ref={ref} open={open} />;
}
