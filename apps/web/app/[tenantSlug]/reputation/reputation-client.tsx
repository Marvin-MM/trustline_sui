'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Star, Shield, Plus, ExternalLink, Calendar } from 'lucide-react';
import { useDAppKit } from '@mysten/dapp-kit-react';
import { queryKeys } from '@/lib/query-keys';
import { reputationApi } from '@/lib/api/reputation';
import { useAuthStore } from '@/stores/auth.store';
import { parseDAppKitExecutionResult } from '@/lib/dapp-kit-result';
import { PageHeader } from '@/components/layout/page-header';
import { ReputationScoreCard } from '@/components/reputation/reputation-score-card';
import { PtbPreviewModal } from '@/components/blockchain/ptb-preview-modal';
import { TransactionStatusToast } from '@/components/blockchain/transaction-toast';
import { ReputationCardSkeleton } from '@/components/ui/skeletons';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ComponentErrorBoundary } from '@/components/ui/component-error-boundary';
import { usePtbSigner } from '@/hooks/use-ptb-signer';
import { UITransactionStatus } from '@/lib/transaction-status';
import { formatAbsoluteTime } from '@/lib/utils';
import { SUI_EXPLORER_URL } from '@/lib/sui-client';
import { formatAmount } from '@/lib/utils';
import { toast } from 'sonner';
import { useSigningWallet } from '@/hooks/use-signing-wallet';
import { DAppKitConnectModal } from '@/components/blockchain/dapp-kit-connect-modal';

export function ReputationPageClient() {
  const queryClient = useQueryClient();
  const dAppKit = useDAppKit();
  const { walletAddress } = useAuthStore();
  const signingWallet = useSigningWallet();
  const [ptbModalOpen, setPtbModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [ptbMode, setPtbMode] = useState<'mint' | 'update'>('mint');
  const ptbModeRef = useRef<'mint' | 'update'>('mint');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: queryKeys.reputation.profile(walletAddress ?? ''),
    queryFn: () => reputationApi.getProfile(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 120_000,
  });

  const { data: attestations, isLoading: attLoading } = useQuery({
    queryKey: queryKeys.reputation.attestations(walletAddress ?? ''),
    queryFn: () => reputationApi.getAttestations(walletAddress!, { page: 1, limit: 20 }),
    enabled: !!walletAddress,
    staleTime: 120_000,
  });

  const mintSigner = usePtbSigner({
    txType: ptbMode === 'mint' ? 'MINT_REPUTATION_PROOF' : 'UPDATE_REPUTATION_PROOF',
    fetchPtb: async () => {
      if (!walletAddress) throw new Error('No wallet connected');
      if (ptbModeRef.current === 'update') {
        return reputationApi.getUpdatePtb(walletAddress);
      }
      return reputationApi.getMintPtb({
        ...(profile?.proof?.walrusAttestationSpaceId
          ? { walrusAttestationSpaceId: profile.proof.walrusAttestationSpaceId }
          : {}),
      });
    },
    signAndExecuteTransaction: async (tx) => {
      signingWallet.assertCanSign();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reputation.profile(walletAddress ?? '') });
      toast.success(ptbModeRef.current === 'mint' ? 'Reputation proof minted!' : 'Reputation updated!');
    },
  });

  const openSigner = (mode: 'mint' | 'update') => {
    if (!signingWallet.isMatch) {
      setConnectModalOpen(true);
      toast.error('Reconnect your signing wallet', {
        description: signingWallet.warning ?? 'Connect the wallet authenticated with BondFlow.',
      });
      return;
    }
    ptbModeRef.current = mode;
    setPtbMode(mode);
    setPtbModalOpen(true);
    void mintSigner.prepare();
  };

  const handleMint = () => {
    openSigner('mint');
  };

  const handleUpdate = () => {
    openSigner('update');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reputation"
        description="Portable recipient reputation owned by your connected wallet"
        icon={Star}
        actions={
          <div className="flex gap-2">
            {profile?.proof ? (
              <button
                onClick={handleUpdate}
                disabled={mintSigner.status !== UITransactionStatus.IDLE}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Shield className="h-4 w-4" />
                Update Proof
              </button>
            ) : (
              <button
                onClick={handleMint}
                disabled={mintSigner.status !== UITransactionStatus.IDLE || !profile?.mintEligibility}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Mint Proof
              </button>
            )}
          </div>
        }
      />

      {!profile?.proof && profile?.disabledReason && (
        <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-muted-foreground">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="font-medium text-foreground">When can I mint my reputation?</p>
            <p className="mt-1 leading-relaxed">{profile.disabledReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Score card */}
        <div className="lg:col-span-1">
          {profileLoading ? (
            <ReputationCardSkeleton />
          ) : profile ? (
            <ComponentErrorBoundary>
              <ReputationScoreCard profile={profile} />
            </ComponentErrorBoundary>
          ) : (
            <EmptyState
              icon={Star}
              title="No reputation data"
              description="Complete payment relationships to build your reputation score."
            />
          )}
        </div>

        {/* Attestations list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Attestations</h2>
            {attestations?.pagination.total ? (
              <span className="flex h-5 items-center justify-center rounded-full bg-brand/10 px-2 text-xs font-semibold text-brand">
                {attestations.pagination.total}
              </span>
            ) : null}
          </div>

          {attLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : !attestations?.data.length ? (
            <EmptyState
              icon={Shield}
              title="No attestations yet"
              description="Attestations are minted automatically whenever a milestone payment is released, including manual approvals."
            />
          ) : (
            <div className="space-y-3">
              {attestations.data.map((att, i) => (
                <motion.div
                  key={att.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-lg transition-transform group-hover:scale-105">
                        📜
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground transition-colors group-hover:text-brand">Milestone {att.milestoneIndex + 1}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono-num text-xs text-muted-foreground">
                            {formatAmount(att.amount, profile?.asset.decimals ?? 6, profile?.asset.symbol ?? 'USDC')} · {att.conditionType}
                          </span>
                          <a
                            href={`${SUI_EXPLORER_URL}/object/${att.objectId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="View attestation on Sui Explorer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status="VERIFIED" size="sm" />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatAbsoluteTime(att.completionTimestamp)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PtbPreviewModal
        open={ptbModalOpen}
        onOpenChange={(open) => { if (!open) { setPtbModalOpen(false); mintSigner.reset(); } }}
        description={mintSigner.ptbDescription}
        estimatedGas={mintSigner.estimatedGas}
        ptbBytes={mintSigner.ptbBytes}
        status={mintSigner.status}
        errorMessage={mintSigner.errorMessage}
        digest={mintSigner.digest}
        walletAddress={signingWallet.displayAddress}
        walletConnected={signingWallet.isMatch}
        walletWarning={signingWallet.warning}
        onConnectWallet={() => setConnectModalOpen(true)}
        onConfirm={() => void mintSigner.sign()}
        onClose={() => { setPtbModalOpen(false); mintSigner.reset(); }}
      />
      <DAppKitConnectModal open={connectModalOpen} onClosed={() => setConnectModalOpen(false)} />
      <TransactionStatusToast digest={mintSigner.digest} status={mintSigner.status} />
    </div>
  );
}
