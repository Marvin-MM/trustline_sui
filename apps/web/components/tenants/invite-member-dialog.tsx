'use client';

import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { TenantRole } from '@bondflow/types';
import { isValidSuiAddress } from '@/lib/utils';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onInvite: (params: { walletAddress: string; role: TenantRole; email?: string }) => void;
}

export function InviteMemberDialog({ open, onOpenChange, loading, onInvite }: InviteMemberDialogProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [role, setRole] = useState<TenantRole>(TenantRole.MEMBER);
  const [email, setEmail] = useState('');
  const walletValid = isValidSuiAddress(walletAddress);
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[80] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">Invite Member</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                The invitation is tied to this Sui wallet. Email delivery is optional.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-foreground">Wallet address</span>
              <input
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value.trim())}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono-num text-xs text-foreground outline-none focus:border-brand"
              />
              {walletAddress && !walletValid && (
                <span className="mt-1 block text-xs text-destructive">Enter a complete 0x-prefixed Sui address.</span>
              )}
            </label>

            <label className="block">
              <span className="text-xs font-medium text-foreground">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as TenantRole)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              >
                <option value={TenantRole.ADMIN}>Admin</option>
                <option value={TenantRole.MEMBER}>Member</option>
                <option value={TenantRole.VIEWER}>Viewer</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-foreground">Email (optional)</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value.trim())}
                placeholder="member@example.com"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              />
              {!emailValid && <span className="mt-1 block text-xs text-destructive">Enter a valid email address.</span>}
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <DialogPrimitive.Close className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Cancel
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={() => onInvite({ walletAddress, role, ...(email ? { email } : {}) })}
              disabled={!walletValid || !emailValid || loading}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
