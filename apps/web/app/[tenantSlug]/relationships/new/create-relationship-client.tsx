'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import confetti from 'canvas-confetti';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, GripVertical,
  AlertTriangle, CheckCircle, Wallet, FileText, Clock, Sparkles,
} from 'lucide-react';
import { useFieldArray, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { useCreateRelationship } from '@/hooks/use-create-relationship';
import { usePtbSigner } from '@/hooks/use-ptb-signer';
import { relationshipsApi } from '@/lib/api/relationships';
import { featureFlagsApi } from '@/lib/api/feature-flags';
import { PtbPreviewModal } from '@/components/blockchain/ptb-preview-modal';
import { DAppKitConnectModal } from '@/components/blockchain/dapp-kit-connect-modal';
import { TransactionStatusToast } from '@/components/blockchain/transaction-toast';
import { PageHeader } from '@/components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROUTES } from '@/constants/routes';
import { ConditionType, FEATURE_FLAG_KEYS, Permission, ReleasePolicy } from '@bondflow/types';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import { useFeatureFlagsStore } from '@/stores/feature-flags.store';
import { useHasPermission } from '@/hooks/use-permission';
import { UITransactionStatus } from '@/lib/transaction-status';
import { parseDAppKitExecutionResult } from '@/lib/dapp-kit-result';

function formatUsdc(amount: string): string {
  return `${amount || '0'} USDC`;
}

function parseUsdcBaseUnits(amount: string, decimals = 6): bigint {
  const [whole = '0', fraction = ''] = amount.split('.');
  return (BigInt(whole || '0') * (10n ** BigInt(decimals)))
    + BigInt(fraction.padEnd(decimals, '0').slice(0, decimals) || '0');
}

function formatBaseUnits(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

const CONDITION_LABELS = {
  [ConditionType.MANUAL]: { label: 'Manual approval', icon: CheckCircle, description: 'Payer manually releases when satisfied' },
  [ConditionType.TIME_GATED]: { label: 'Time-locked', icon: Clock, description: 'Releases automatically after a date' },
  [ConditionType.DELIVERABLE]: { label: 'Deliverable', icon: FileText, description: 'AI verifies uploaded proof of work' },
};

const STEPS = ['Party Details', 'Milestones', 'AI Check', 'Review & Sign'];

export function CreateRelationshipClient({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dAppKit = useDAppKit();
  const currentAccount = useCurrentAccount();
  const { walletAddress, tenantId } = useAuthStore();
  const setFeatureFlags = useFeatureFlagsStore((s) => s.setFlags);
  const canManageFeatureFlags = useHasPermission(Permission.FEATURE_FLAG_MANAGE);
  const [ptbModalOpen, setPtbModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [isEnablingAI, setIsEnablingAI] = useState(false);
  const [createSuccessTarget, setCreateSuccessTarget] = useState<string | null>(null);

  // Local protection against double submission
  const [isAdvancingStep1, setIsAdvancingStep1] = useState(false);
  const [isAdvancingStep2, setIsAdvancingStep2] = useState(false);

  const {
    currentStep,
    step1Form,
    step2Form,
    step1Data,
    step2Data,
    anomalyResult,
    ptbData,
    clientRequestId,
    preflightError,
    aiEnabled,
    isCheckingAnomaly,
    advanceToStep2,
    advanceToStep3,
    runAnomalyCheck,
    advanceToStep4,
    goBack,
    reset,
  } = useCreateRelationship();

  const { fields, append, remove } = useFieldArray({
    control: step2Form.control,
    name: 'milestones',
  });

  const totalUsdc = step2Data?.milestones.reduce((sum, milestone) => sum + Number(milestone.amount || '0'), 0) ?? 0;
  const estimatedGasMist = BigInt(ptbData?.estimatedGas ?? '0');
  const requiredGasMist = estimatedGasMist > 0n ? estimatedGasMist : 1_000_000n;
  const authenticatedWallet = walletAddress?.toLowerCase() ?? null;
  const signingWallet = currentAccount?.address?.toLowerCase() ?? null;
  const hasLiveSigningWallet = Boolean(signingWallet);
  const isSigningWalletMatch = Boolean(authenticatedWallet && signingWallet && authenticatedWallet === signingWallet);
  const signingWalletWarning = !walletAddress
    ? 'Sign in with a wallet before creating a relationship.'
    : !hasLiveSigningWallet
      ? 'Your app session is restored, but Slush is not connected for signing. Reconnect the same wallet before continuing.'
      : !isSigningWalletMatch
        ? 'The connected wallet does not match your TrustLine session. Switch to the authenticated wallet before signing.'
        : null;

  const { data: assetPreflight, isLoading: balanceLoading, refetch: refetchBalances } = useQuery({
    queryKey: ['wallet', 'relationship-asset-preflight', walletAddress],
    queryFn: relationshipsApi.getPaymentAsset,
    enabled: Boolean(walletAddress) && currentStep === 4,
    refetchInterval: currentStep === 4 ? 15_000 : false,
  });

  const walletBalanceMist = BigInt(assetPreflight?.gasBalanceMist ?? '0');
  const assetDecimals = assetPreflight?.asset.decimals ?? 6;
  const paymentBalance = BigInt(assetPreflight?.paymentBalanceBaseUnits ?? '0');
  const requiredPayment = step2Data?.milestones.reduce(
    (sum, milestone) => sum + parseUsdcBaseUnits(milestone.amount || '0', assetDecimals),
    0n,
  ) ?? 0n;
  
  const hasEnoughGas = walletBalanceMist >= requiredGasMist;
  const hasEnoughPayment = paymentBalance >= requiredPayment;
  const canOpenSigner = isSigningWalletMatch && hasEnoughGas && hasEnoughPayment && !balanceLoading;
  const relationshipsHref = ROUTES.tenantRelationships(tenantSlug);

  const signer = usePtbSigner({
    txType: 'CREATE_RELATIONSHIP',
    fetchPtb: async () => {
      if (!step1Data || !step2Data) throw new Error('Missing form data');
      if (ptbData) return ptbData;
      return relationshipsApi.getCreatePtb({
        recipientWallet: step1Data.recipientWallet,
        milestones: step2Data.milestones.map((m) => ({
          amount: m.amount,
          conditionType: m.conditionType,
          conditionValue: m.conditionValue,
          releasePolicy: m.releasePolicy,
        })),
        memo: step1Data.memo,
        clientRequestId,
      });
    },
    signAndExecuteTransaction: async (tx) => {
      if (!currentAccount?.address) {
        throw new Error('No wallet is connected. Reconnect Slush before signing this transaction.');
      }
      if (walletAddress && currentAccount.address.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('Connected wallet does not match the wallet authenticated with TrustLine.');
      }
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      return parseDAppKitExecutionResult(result);
    },
    onConfirmed: async (_digest, pendingRelationshipId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.all() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      let target: string = relationshipsHref;
      if (pendingRelationshipId) {
        try {
          const relationship = await relationshipsApi.getById(pendingRelationshipId);
          if (relationship.onChainId.startsWith('0x')) {
            target = ROUTES.tenantRelationshipDetail(tenantSlug, relationship.id);
          } else {
            toast.info('Relationship created. Indexing is still catching up, so it will appear in the list shortly.');
          }
        } catch {
          toast.info('Relationship created. Indexing is still catching up, so it will appear in the list shortly.');
        }
      }
      setCreateSuccessTarget(target);
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.65 } });
      toast.success('Relationship transaction confirmed!');
    },
    onFailed: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.all() });
    },
    onFailedBeforeSubmission: async (relationshipId, error) => {
      await relationshipsApi.markPendingCreateFailed(relationshipId, error);
      await queryClient.invalidateQueries({ queryKey: queryKeys.relationships.all() });
    },
  });

  const terminalSignerStates = [
    UITransactionStatus.IDLE,
    UITransactionStatus.FAILED,
    UITransactionStatus.DRY_RUN_FAILED,
    UITransactionStatus.WALLET_REJECTED,
    UITransactionStatus.TIMEOUT,
  ];
  const isCreateSignerBusy = !terminalSignerStates.includes(signer.status);
  const createButtonLabel = (() => {
    switch (signer.status) {
      case UITransactionStatus.PREPARING:
      case UITransactionStatus.DRY_RUNNING:
        return 'Preparing transaction...';
      case UITransactionStatus.AWAITING_SIGNATURE:
        return 'Review transaction';
      case UITransactionStatus.SIGNING:
        return 'Signing...';
      case UITransactionStatus.SIGNED:
      case UITransactionStatus.SUBMITTING:
        return 'Submitting...';
      case UITransactionStatus.PENDING:
        return 'Confirming...';
      default:
        return 'Sign & Create';
    }
  })();

  const handleSign = () => {
    if (isCreateSignerBusy) {
      return;
    }
    if (!isSigningWalletMatch) {
      toast.error('Reconnect your signing wallet', {
        description: signingWalletWarning ?? 'Connect the same wallet you used to sign in before creating this relationship.',
      });
      setConnectModalOpen(true);
      return;
    }
    setPtbModalOpen(true);
    void signer.prepare();
  };

  const handlePtbModalClose = () => {
    setPtbModalOpen(false);
    if (signer.status === UITransactionStatus.CONFIRMED) {
      const target = createSuccessTarget ?? relationshipsHref;
      reset();
      signer.reset();
      router.push(target);
      return;
    }
    signer.reset();
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdvancingStep1(true);
    await advanceToStep2();
    setIsAdvancingStep1(false);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdvancingStep2(true);
    await advanceToStep3();
    setIsAdvancingStep2(false);
  };

  const handleEnableAiAnalysis = async () => {
    setIsEnablingAI(true);
    try {
      await featureFlagsApi.update(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION, true);
      const flags = await queryClient.fetchQuery({
        queryKey: queryKeys.featureFlags.byTenant(tenantId),
        queryFn: featureFlagsApi.getAll,
      });
      setFeatureFlags(Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])), tenantId);
      toast.success('AI anomaly analysis enabled for this workspace');
      await runAnomalyCheck();
    } catch (error) {
      toast.error('Failed to enable AI anomaly analysis', {
        description: error instanceof Error ? error.message : 'Try again from workspace settings.',
      });
    } finally {
      setIsEnablingAI(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-12">
      <PageHeader
        title="New Relationship"
        description="Define a payment relationship with milestones and conditions"
        breadcrumbs={[
          { label: 'Relationships', href: relationshipsHref },
          { label: 'New' },
        ]}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isActive = currentStep === stepNum;
          const isDone = currentStep > stepNum;
          return (
            <div key={step} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
                  isDone ? 'bg-brand text-white' :
                  isActive ? 'bg-brand/20 text-brand border-2 border-brand' :
                  'bg-muted text-muted-foreground'
                )}>
                  {isDone ? <CheckCircle className="h-4 w-4" /> : stepNum}
                </div>
                <span className={cn(
                  'hidden text-xs font-medium sm:block',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('mx-3 h-0.5 w-8', isDone ? 'bg-brand' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          {/* Step 1: Party Details */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-5">
              <h2 className="text-base font-semibold text-foreground">Party Details</h2>

              <div>
                <label htmlFor="recipient" className="block text-sm font-medium text-foreground mb-1.5">
                  Recipient Wallet Address
                </label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="recipient"
                    {...step1Form.register('recipientWallet')}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2.5 text-sm font-mono-num text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-shadow"
                  />
                </div>
                {step1Form.formState.errors.recipientWallet && (
                  <p className="mt-1 text-xs text-destructive font-medium">{step1Form.formState.errors.recipientWallet.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="memo" className="block text-sm font-medium text-foreground mb-1.5">
                  Memo <span className="text-muted-foreground font-normal">(max 64 bytes)</span>
                </label>
                <input
                  id="memo"
                  {...step1Form.register('memo')}
                  placeholder="e.g. Website redesign Q1 2026"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-shadow"
                />
                {step1Form.formState.errors.memo && (
                  <p className="mt-1 text-xs text-destructive font-medium">{step1Form.formState.errors.memo.message}</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-sm font-medium text-foreground">Encrypted relationship memory is included</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  TrustLine creates and manages the Walrus/MemWal memory space automatically after pre-flight checks pass.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="submit" 
                  disabled={isAdvancingStep1} 
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-60"
                >
                  {isAdvancingStep1 ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Processing...</>
                  ) : (
                    <>Continue <ChevronRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Milestones */}
          {currentStep === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Milestones</h2>
                <button
                  type="button"
                  onClick={() => append({
                    id: crypto.randomUUID(),
                    amount: '',
                    conditionType: ConditionType.MANUAL,
                    conditionValue: 'Approved by payer',
                    releasePolicy: ReleasePolicy.PAYER_APPROVAL,
                  })}
                  disabled={fields.length >= 10 || isAdvancingStep2 || isCheckingAnomaly}
                  className="flex items-center gap-1.5 rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Milestone
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, i) => (
                  <div key={field.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">Milestone {i + 1}</span>
                      </div>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(i)} disabled={isAdvancingStep2 || isCheckingAnomaly} className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">Amount (USDC)</label>
                        <input
                          {...step2Form.register(`milestones.${i}.amount`)}
                          placeholder="200.00"
                          disabled={isAdvancingStep2 || isCheckingAnomaly}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono-num text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-60 transition-shadow"
                        />
                        {step2Form.formState.errors.milestones?.[i]?.amount && (
                          <p className="mt-1 text-xs text-destructive font-medium">{step2Form.formState.errors.milestones[i]?.amount?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">Condition Type</label>
                        <Controller
                          control={step2Form.control}
                          name={`milestones.${i}.conditionType`}
                          render={({ field: { onChange, value } }) => (
                            <Select
                              onValueChange={onChange}
                              value={value}
                              disabled={isAdvancingStep2 || isCheckingAnomaly}
                            >
                              <SelectTrigger className="w-full rounded-lg bg-background text-sm transition-shadow focus:ring-2 focus:ring-brand/50 h-[38px]">
                                <SelectValue placeholder="Select condition type" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    {v.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Requirement</label>
                      <input
                        {...step2Form.register(`milestones.${i}.conditionValue`)}
                        type={step2Form.watch(`milestones.${i}.conditionType`) === ConditionType.TIME_GATED ? 'datetime-local' : 'text'}
                        placeholder="e.g. Upload the first logo draft as a PNG"
                        disabled={isAdvancingStep2 || isCheckingAnomaly}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-60 transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Release Policy</label>
                      <Controller
                        control={step2Form.control}
                        name={`milestones.${i}.releasePolicy`}
                        render={({ field: { onChange, value } }) => (
                          <Select
                            onValueChange={onChange}
                            value={value}
                            disabled={isAdvancingStep2 || isCheckingAnomaly}
                          >
                            <SelectTrigger className="w-full rounded-lg bg-background text-sm transition-shadow focus:ring-2 focus:ring-brand/50 h-[38px]">
                              <SelectValue placeholder="Select release policy" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ReleasePolicy.PAYER_APPROVAL}>
                                Payer approval (recommended)
                              </SelectItem>
                              <SelectItem
                                value={ReleasePolicy.AUTO_AFTER_CHALLENGE}
                                disabled={step2Form.watch(`milestones.${i}.conditionType`) === ConditionType.MANUAL}
                              >
                                {step2Form.watch(`milestones.${i}.conditionType`) === ConditionType.TIME_GATED
                                  ? 'Auto-release when the configured time arrives'
                                  : 'Auto-release after verification and 24-hour challenge'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {step2Form.formState.errors.milestones?.[i]?.releasePolicy && (
                        <p className="mt-1 text-xs text-destructive font-medium">
                          {step2Form.formState.errors.milestones[i]?.releasePolicy?.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {step2Form.formState.errors.milestones?.root && (
                <p className="text-xs text-destructive font-medium">{step2Form.formState.errors.milestones.root.message}</p>
              )}

              <div className="flex justify-between pt-2">
                <button type="button" onClick={goBack} disabled={isAdvancingStep2} className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button type="submit" disabled={isAdvancingStep2} className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-60">
                  {isAdvancingStep2 ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Processing...</>
                  ) : (
                    <>Continue <ChevronRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: AI anomaly check */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-foreground">AI Pre-Flight Check</h2>
              <div className={cn(
                'rounded-xl border p-6 text-center space-y-3 min-h-[220px] flex flex-col justify-center items-center',
                isCheckingAnomaly ? 'border-brand/20 bg-brand/5' :
                preflightError ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/20'
              )}>
                {isCheckingAnomaly ? (
                  <div className="py-2 flex w-full flex-col items-center justify-center space-y-4">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Sparkles className="h-6 w-6 animate-pulse" />
                      {/* Animated orbiting ring */}
                      <div className="absolute inset-0 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground animate-pulse">AI Agent is analyzing...</p>
                      <p className="text-xs text-muted-foreground">Checking milestones and recipient patterns</p>
                    </div>
                    {/* Skeleton loading bars */}
                    <div className="mt-6 w-full max-w-[200px] space-y-2.5 opacity-60">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full bg-brand/60"
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                        />
                      </div>
                      <div className="h-1.5 w-5/6 overflow-hidden rounded-full bg-muted mx-auto">
                        <motion.div
                          className="h-full bg-brand/40"
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{ repeat: Infinity, duration: 1.5, delay: 0.2, ease: 'easeInOut' }}
                        />
                      </div>
                      <div className="h-1.5 w-4/6 overflow-hidden rounded-full bg-muted mx-auto">
                        <motion.div
                          className="h-full bg-brand/30"
                          initial={{ x: '-100%' }}
                          animate={{ x: '200%' }}
                          transition={{ repeat: Infinity, duration: 1.5, delay: 0.4, ease: 'easeInOut' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    {preflightError || anomalyResult?.status === 'UNAVAILABLE' ? (
                      <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
                    ) : (
                      <CheckCircle className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
                    )}
                    <p className="text-sm font-medium text-foreground">
                      {preflightError || anomalyResult?.status === 'UNAVAILABLE'
                        ? 'Pre-flight check needs attention'
                        : 'Pre-flight check completed'}
                    </p>
                    <p className={cn(
                      'text-xs leading-relaxed mt-2',
                      preflightError || anomalyResult?.status === 'UNAVAILABLE' ? 'text-destructive' : 'text-muted-foreground',
                    )}>
                      {preflightError
                        ? preflightError
                        : anomalyResult?.status === 'UNAVAILABLE'
                          ? `AI anomaly analysis is unavailable: ${anomalyResult.reason}. You can retry or continue with manual review.`
                        : anomalyResult?.status === 'COMPLETED'
                          ? `${anomalyResult.result.severity.toUpperCase()} risk: ${anomalyResult.result.reason} Recommended action: ${anomalyResult.result.suggestedAction.replaceAll('_', ' ')}.`
                        : anomalyResult?.status === 'DISABLED' || !aiEnabled
                          ? 'AI anomaly analysis is disabled for this workspace. You can continue to review the funding transaction and sign when ready.'
                          : 'The non-mutating anomaly check completed. Review the parties and milestones before funding.'}
                    </p>
                    {!preflightError && anomalyResult?.status === 'UNAVAILABLE' && (
                      <button
                        type="button"
                        onClick={() => void runAnomalyCheck()}
                        disabled={isCheckingAnomaly}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60 mt-3"
                      >
                        Retry AI check
                      </button>
                    )}
                    {!preflightError && !aiEnabled && (
                      <div className="mx-auto w-full max-w-sm rounded-lg border border-brand/20 bg-brand/5 p-3 text-left mt-4">
                        <p className="text-xs font-medium text-foreground">Want AI to analyze this draft?</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Enable workspace AI to run anomaly analysis now and use deliverable verification later.
                        </p>
                        {canManageFeatureFlags ? (
                          <button
                            type="button"
                            onClick={handleEnableAiAnalysis}
                            disabled={isEnablingAI || isCheckingAnomaly}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-60"
                          >
                            {isEnablingAI || isCheckingAnomaly ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            Enable and run AI check
                          </button>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Ask a workspace owner or admin to enable AI in Settings - Feature Flags.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={goBack} disabled={isCheckingAnomaly} className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={advanceToStep4}
                  disabled={isCheckingAnomaly}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-50"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Sign */}
          {currentStep === 4 && step1Data && step2Data && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-foreground">Review & Sign</h2>

              <div className="space-y-3">
                {preflightError && !ptbData && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-sm font-medium text-destructive">Pre-flight check failed</p>
                    <p className="mt-1 text-xs text-destructive">{preflightError}</p>
                  </div>
                )}
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Recipient</p>
                  <p className="font-mono-num text-sm text-foreground break-all">{step1Data.recipientWallet}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Memo</p>
                  <p className="text-sm text-foreground">{step1Data.memo}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{step2Data.milestones.length} Milestones</p>
                  {step2Data.milestones.map((m, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                      <span className="text-foreground truncate pr-4">Milestone {i + 1}: {m.conditionValue}</span>
                      <span className="font-mono-num text-muted-foreground shrink-0">{formatUsdc(m.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className={cn(
                  'rounded-lg border p-4 space-y-2',
                  hasEnoughGas && hasEnoughPayment ? 'border-border bg-muted/20' : 'border-destructive/30 bg-destructive/5'
                )}>
                  <p className="text-xs text-muted-foreground font-medium">Funding preview</p>
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <span className="text-muted-foreground flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider opacity-70">Gas balance</span>
                      <span className="font-mono-num text-foreground">{balanceLoading ? 'Checking...' : `${walletBalanceMist} MIST`}</span>
                    </span>
                    <span className="text-muted-foreground flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider opacity-70">USDC balance</span>
                      <span className="font-mono-num text-foreground">
                        {balanceLoading ? 'Checking...' : `${formatBaseUnits(paymentBalance, assetDecimals)} ${assetPreflight?.asset.symbol ?? 'USDC'}`}
                      </span>
                    </span>
                    <span className="text-muted-foreground flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider opacity-70">Required Amount</span>
                      <span className="font-mono-num text-foreground">
                        {formatBaseUnits(requiredPayment, assetDecimals)} {assetPreflight?.asset.symbol ?? 'USDC'} + {requiredGasMist.toString()} MIST
                      </span>
                    </span>
                  </div>
                  {!hasEnoughGas && !balanceLoading && (
                    <p className="text-xs text-destructive font-medium pt-1">Fund this wallet with enough SUI for transaction gas.</p>
                  )}
                  {!hasEnoughPayment && !balanceLoading && (
                    <div className="flex flex-col gap-2 text-xs text-destructive sm:flex-row sm:items-center sm:justify-between pt-1">
                      <p className="font-medium">
                        This wallet needs {formatBaseUnits(requiredPayment - paymentBalance, assetDecimals)} more {assetPreflight?.asset.symbol ?? 'USDC'}.
                      </p>
                      {assetPreflight?.asset.faucetUrl && (
                        <a
                          href={assetPreflight.asset.faucetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold underline underline-offset-2 hover:text-destructive/80 transition-colors"
                        >
                          Open Circle testnet faucet
                        </a>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void refetchBalances()}
                    className="text-xs font-semibold text-brand underline underline-offset-2 hover:text-brand/80 transition-colors mt-2 block"
                  >
                    Refresh balances
                  </button>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
                  This transaction locks <span className="font-mono-num font-medium text-foreground">{totalUsdc.toLocaleString()} USDC</span>, creates the shared relationship, and grants the backend a scoped verifier capability. Auto-release milestones use a 24-hour challenge window.
                </div>
                <div className={cn(
                  'rounded-lg border p-4 space-y-2',
                  isSigningWalletMatch ? 'border-border bg-muted/20' : 'border-amber-300/60 bg-amber-50 dark:border-amber-800/70 dark:bg-amber-950/30'
                )}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Signing wallet</p>
                      <p className={cn(
                        'mt-1 text-sm font-semibold',
                        isSigningWalletMatch ? 'text-foreground' : 'text-amber-800 dark:text-amber-200'
                      )}>
                        {isSigningWalletMatch
                          ? 'Connected and ready to sign'
                          : signingWalletWarning}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>Session: <span className="font-mono-num text-foreground">{walletAddress ?? 'Not signed in'}</span></p>
                        <p>Slush: <span className="font-mono-num text-foreground">{currentAccount?.address ?? 'Not connected'}</span></p>
                      </div>
                    </div>
                    {!isSigningWalletMatch && (
                      <button
                        type="button"
                        onClick={() => setConnectModalOpen(true)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-300 bg-background px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950"
                      >
                        Reconnect Wallet
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={goBack} disabled={isCreateSignerBusy} className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleSign}
                  disabled={isCreateSignerBusy || !canOpenSigner}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-60"
                >
                  {isCreateSignerBusy ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{createButtonLabel}</>
                  ) : (
                    createButtonLabel
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* PTB Modal */}
      <PtbPreviewModal
        open={ptbModalOpen}
        onOpenChange={(open) => { if (!open) handlePtbModalClose(); }}
        description={signer.ptbDescription}
        estimatedGas={signer.estimatedGas}
        ptbBytes={signer.ptbBytes}
        status={signer.status}
        errorMessage={signer.errorMessage}
        digest={signer.digest}
        walletAddress={currentAccount?.address ?? walletAddress}
        walletConnected={isSigningWalletMatch}
        walletWarning={signingWalletWarning}
        onConnectWallet={() => setConnectModalOpen(true)}
        onConfirm={() => void signer.sign()}
        onClose={handlePtbModalClose}
      />
      <DAppKitConnectModal open={connectModalOpen} onClosed={() => setConnectModalOpen(false)} />
      <TransactionStatusToast digest={signer.digest} status={signer.status} />
    </div>
  );
}
