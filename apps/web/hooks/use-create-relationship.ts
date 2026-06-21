'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ConditionType, ReleasePolicy, type AnomalyPreflightResult } from '@bondflow/types';
import { isValidSuiAddress } from '@/lib/utils';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { FEATURE_FLAG_KEYS } from '@/constants/permissions';
import { relationshipsApi } from '@/lib/api/relationships';
import { getApiErrorMessage } from '@/lib/api-error';

function errorMessage(error: unknown): string {
  return getApiErrorMessage(error, 'Pre-flight check failed');
}

// Step 1 schema
const step1Schema = z.object({
  recipientWallet: z
    .string()
    .refine(isValidSuiAddress, 'Invalid Sui wallet address (must be 0x + 64 hex chars)'),
  memo: z
    .string()
    .min(1, 'Memo is required')
    .refine(
      (s) => new TextEncoder().encode(s).length <= 64,
      'Memo must be 64 bytes or fewer'
    ),
});

// Milestone schema
const milestoneSchema = z.object({
  id: z.string(), // client-side only, for dnd-kit
  amount: z.string()
    .regex(/^(0|[1-9]\d*)(\.\d{1,6})?$/, 'Enter a positive USDC amount with up to 6 decimals')
    .refine((value) => /[1-9]/.test(value), 'Amount must be greater than zero'),
  conditionType: z.nativeEnum(ConditionType),
  conditionValue: z.string().min(1, 'Condition value is required'),
  releasePolicy: z.nativeEnum(ReleasePolicy),
}).superRefine((milestone, ctx) => {
  if (milestone.conditionType === ConditionType.MANUAL && milestone.releasePolicy !== ReleasePolicy.PAYER_APPROVAL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['releasePolicy'],
      message: 'Manual milestones require payer approval',
    });
  }
  if (milestone.conditionType === ConditionType.TIME_GATED) {
    const timestamp = new Date(milestone.conditionValue).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conditionValue'],
        message: 'Choose a future release time',
      });
    }
  }
});

// Step 2 schema
const step2Schema = z.object({
  milestones: z
    .array(milestoneSchema)
    .min(1, 'At least one milestone is required')
    .max(10, 'Maximum 10 milestones'),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type MilestoneFormData = z.infer<typeof milestoneSchema>;

export function useCreateRelationship() {
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [anomalyResult, setAnomalyResult] = useState<AnomalyPreflightResult | null>(null);
  const [isCheckingAnomaly, setIsCheckingAnomaly] = useState(false);
  const [ptbData, setPtbData] = useState<{ ptb: string; description: string; estimatedGas: string; relationshipId?: string; walrusMemorySpaceId?: string } | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());

  const aiEnabled = useFeatureFlag(FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { recipientWallet: '', memo: '' },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      milestones: [
        {
          id: crypto.randomUUID(),
          amount: '',
          conditionType: ConditionType.MANUAL,
          conditionValue: 'Approved by payer',
          releasePolicy: ReleasePolicy.PAYER_APPROVAL,
        },
      ],
    },
  });

  const advanceToStep2 = useCallback(async () => {
    const valid = await step1Form.trigger();
    if (!valid) return;
    setPtbData(null);
    setPreflightError(null);
    setClientRequestId(crypto.randomUUID());
    setStep1Data(step1Form.getValues());
    setCurrentStep(2);
  }, [step1Form]);

  const runAnomalyCheck = useCallback(async () => {
    const party = step1Data ?? step1Form.getValues();
    const data = step2Data ?? step2Form.getValues();
    setStep2Data(data);
    setPtbData(null);
    setPreflightError(null);
    setIsCheckingAnomaly(true);
    setCurrentStep(3);
    try {
      const result = await relationshipsApi.checkAnomaly({
        recipientWallet: party.recipientWallet,
        clientRequestId,
        milestones: data.milestones.map((m) => ({
          amount: m.amount,
          conditionType: m.conditionType,
          conditionValue: m.conditionValue,
          releasePolicy: m.releasePolicy,
        })),
      });
      setAnomalyResult(result);
      setCurrentStep(3);
    } catch (error) {
      setPreflightError(errorMessage(error));
    } finally {
      setIsCheckingAnomaly(false);
    }
  }, [step1Data, step1Form, step2Data, step2Form, clientRequestId]);

  const advanceToStep3 = useCallback(async () => {
    const valid = await step2Form.trigger();
    if (!valid) return;
    const data = step2Form.getValues();
    setStep2Data(data);
    setPtbData(null);
    setPreflightError(null);

    if (aiEnabled && step1Data) {
      // Start analysis in background, state handles the loading UI
      runAnomalyCheck().catch(console.error);
    } else {
      setAnomalyResult(null);
      setCurrentStep(3);
    }
  }, [step2Form, aiEnabled, step1Data, runAnomalyCheck]);

  const advanceToStep4 = useCallback(() => {
    setCurrentStep(4);
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(1);
    setStep1Data(null);
    setStep2Data(null);
    setAnomalyResult(null);
    setPtbData(null);
    setPreflightError(null);
    step1Form.reset();
    step2Form.reset();
  }, [step1Form, step2Form]);

  return {
    currentStep,
    step1Form,
    step2Form,
    step1Data,
    step2Data,
    anomalyResult,
    preflightError,
    isCheckingAnomaly,
    ptbData,
    clientRequestId,
    aiEnabled,
    advanceToStep2,
    advanceToStep3,
    runAnomalyCheck,
    advanceToStep4,
    goBack,
    reset,
  };
}
