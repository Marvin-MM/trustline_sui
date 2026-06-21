import apiClient from '@/lib/api-client';
import type { PaginatedResponse } from '@bondflow/types';

export interface MemoryEntryDto {
  id: string;
  relationshipId: string;
  walrusBlobId: string | null;
  summary: string;
  keyInsights: string[];
  riskFactors: string[];
  relationshipHealth: 'healthy' | 'needs_attention' | 'at_risk';
  recommendedActions: string[];
  encryptedForWallet: string;
  milestoneIndex: number | null;
  eventType: string;
  isCritical: boolean;
  storageStatus: 'PENDING' | 'STORED' | 'FAILED';
  storageError: string | null;
  factualPayload: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryInsightResponse {
  insight: string;
  confidence: number;
  relevantEntries: string[];
  suggestedFollowUp?: string;
}

export const memoryApi = {
  getEntries: async (
    relationshipId: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<MemoryEntryDto>> => {
    const { data } = await apiClient.get<PaginatedResponse<MemoryEntryDto> | MemoryEntryDto[]>(
      `/memory/${relationshipId}`,
      { params }
    );
    return Array.isArray(data)
      ? { data, pagination: { page: params.page ?? 1, limit: params.limit ?? data.length, total: data.length, totalPages: 1 } }
      : data;
  },

  getInsight: async (
    relationshipId: string,
    question: string
  ): Promise<MemoryInsightResponse> => {
    const { data } = await apiClient.get<MemoryInsightResponse>(
      `/memory/${relationshipId}/insights`,
      { params: { question }, timeout: 40_000 }
    );
    return data;
  },
};
