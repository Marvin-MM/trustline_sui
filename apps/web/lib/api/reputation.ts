import apiClient from '@/lib/api-client';
import type { PaginatedResponse } from '@bondflow/types';

export interface ReputationProfileDto {
  walletAddress: string;
  ownership: 'RECIPIENT_WALLET';
  asset: { type: string; symbol: string; decimals: number };
  factual: {
    successfulCount: number;
    cancelledCount: number;
    disputedCount: number;
    totalVolume: string;
    completionRateBps: number;
    avgCompletionTimeMs: string;
  };
  proof: {
    objectId: string;
    mintedAt: string;
    walrusAttestationSpaceId: string;
  } | null;
  eligibleOutcomes: number;
  mintEligibility: boolean;
  disabledReason: string | null;
  indexingPending: boolean;
  aiAnalysis: {
    summary: string;
    strengthAreas: string[];
    riskAreas: string[];
    overallRating: 'excellent' | 'good' | 'fair' | 'poor';
    narrativeDescription: string;
  } | null;
}

export interface AttestationDto {
  id: string;
  objectId: string;
  relationshipId: string;
  milestoneIndex: number;
  amount: string;
  conditionType: string;
  deliverableBlobId: string | null;
  completionTimestamp: string;
}

export const reputationApi = {
  getProfile: async (walletAddress: string): Promise<ReputationProfileDto> => {
    const { data } = await apiClient.get<ReputationProfileDto>(`/reputation/${walletAddress}`);
    return data;
  },

  getAttestations: async (
    walletAddress: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<AttestationDto>> => {
    const { data } = await apiClient.get<PaginatedResponse<AttestationDto & { suiObjectId?: string }>>(
      `/reputation/${walletAddress}/attestations`,
      { params }
    );
    return {
      ...data,
      data: data.data.map((raw) => ({
        ...raw,
        id: raw.objectId ?? raw.suiObjectId ?? raw.id,
        objectId: raw.objectId ?? raw.suiObjectId ?? raw.id,
        amount: String(raw.amount ?? '0'),
        conditionType: raw.conditionType ?? 'MANUAL',
        deliverableBlobId: raw.deliverableBlobId ?? null,
        completionTimestamp: raw.completionTimestamp,
      })),
    };
  },

  getMintPtb: async (params: { walrusAttestationSpaceId?: string }): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ ptb: string; description: string; estimatedGas: string }>(
      '/reputation/mint/ptb',
      params
    );
    return data;
  },

  getUpdatePtb: async (
    walletAddress: string
  ): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ ptb: string; description: string; estimatedGas: string }>(
      `/reputation/${walletAddress}/update/ptb`
    );
    return data;
  },
};
