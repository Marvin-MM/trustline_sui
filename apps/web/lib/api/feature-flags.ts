import apiClient from '@/lib/api-client';
import type { FeatureFlagKey } from '@bondflow/types';

export interface FeatureFlagDto {
  id: string;
  key: string;
  enabled: boolean;
  description: string;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const featureFlagsApi = {
  getAll: async (): Promise<FeatureFlagDto[]> => {
    const { data } = await apiClient.get<FeatureFlagDto[]>('/feature-flags');
    return data;
  },

  update: async (key: FeatureFlagKey | string, enabled: boolean): Promise<FeatureFlagDto> => {
    const { data } = await apiClient.patch<FeatureFlagDto>(`/feature-flags/${key}`, { enabled });
    return data;
  },

  create: async (params: {
    key: string;
    enabled: boolean;
    description: string;
    tenantId?: string | null;
  }): Promise<FeatureFlagDto> => {
    const { data } = await apiClient.post<FeatureFlagDto>('/feature-flags', params);
    return data;
  },
};
