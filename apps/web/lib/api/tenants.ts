import apiClient from '@/lib/api-client';
import type { TenantRole, TenantPlan, PaginatedResponse } from '@bondflow/types';

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  isActive: boolean;
  createdAt: string;
}

export interface TenantMembershipDto {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantRole;
  plan: TenantPlan;
  platformAdmin?: boolean;
}

export interface TenantMemberDto {
  userId: string;
  walletAddress: string;
  email: string | null;
  role: TenantRole;
  status: 'PENDING' | 'ACCEPTED';
  joinedAt: string;
}

export interface TenantInvitationDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantRole;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface UsageMetricsDto {
  asset: { type: string; symbol: string; decimals: number };
  aiCostPerDay: Array<{ date: string; costUsd: number; tokens: number }>;
  gasPerDay: Array<{ date: string; gas: string; txCount: number }>;
  walrusStorage: { totalBytes: number; growthPerDay: Array<{ date: string; bytes: number }> };
  relationships: {
    volumePerDay: Array<{ date: string; fundedBaseUnits: string; releasedBaseUnits: string }>;
    milestoneCompletionRate: number;
    releasedMilestones: number;
    totalMilestones: number;
    disputeRate: number;
    totalRelationships: number;
    fundedBaseUnits: string;
    releasedBaseUnits: string;
    lockedBaseUnits: string;
  };
  totalTokens: number;
  totalCostUsd: number;
  costPerRelationship: number;
  mostExpensiveAgentType: string;
}

export const tenantsApi = {
  list: async (): Promise<TenantMembershipDto[]> => {
    const { data } = await apiClient.get<Array<TenantMembershipDto & { id?: string; name?: string; slug?: string; platformAdmin?: boolean }>>('/tenants');
    return data.map((membership) => ({
      tenantId: membership.tenantId ?? membership.id ?? '',
      tenantName: membership.tenantName ?? membership.name ?? '',
      tenantSlug: membership.tenantSlug ?? membership.slug ?? '',
      role: membership.role,
      plan: membership.plan,
      platformAdmin: membership.platformAdmin ?? false,
    }));
  },

  getById: async (id: string): Promise<TenantDto> => {
    const { data } = await apiClient.get<TenantDto>(`/tenants/${id}`);
    return data;
  },

  create: async (params: { name: string; slug: string }): Promise<TenantDto> => {
    const { data } = await apiClient.post<TenantDto>('/tenants', params);
    return data;
  },

  update: async (id: string, params: { name?: string; isActive?: boolean }): Promise<TenantDto> => {
    const { data } = await apiClient.patch<TenantDto>(`/tenants/${id}`, params);
    return data;
  },

  getMembers: async (id: string, params: { page?: number; limit?: number }): Promise<PaginatedResponse<TenantMemberDto>> => {
    const { data } = await apiClient.get<PaginatedResponse<TenantMemberDto>>(`/tenants/${id}/members`, { params });
    return data;
  },

  inviteMember: async (
    id: string,
    params: { walletAddress: string; role: TenantRole; email?: string }
  ): Promise<{ invitationDelivery: { inApp: 'queued'; email: 'queued' | 'not_requested' } }> => {
    const { data } = await apiClient.post<{
      invitationDelivery: { inApp: 'queued'; email: 'queued' | 'not_requested' };
    }>(`/tenants/${id}/members/invite`, params);
    return data;
  },
  listPendingInvitations: async (): Promise<TenantInvitationDto[]> => {
    const { data } = await apiClient.get<TenantInvitationDto[]>('/tenants/invitations/pending');
    return data;
  },
  acceptInvitation: async (tenantId: string): Promise<void> => {
    await apiClient.post(`/tenants/${tenantId}/members/accept`, {});
  },
  declineInvitation: async (invitationId: string): Promise<void> => {
    await apiClient.post(`/tenants/invitations/${invitationId}/decline`, {});
  },

  updateMemberRole: async (id: string, userId: string, role: TenantRole): Promise<void> => {
    await apiClient.patch(`/tenants/${id}/members/${userId}/role`, { role });
  },

  removeMember: async (id: string, userId: string): Promise<void> => {
    await apiClient.delete(`/tenants/${id}/members/${userId}`);
  },

  checkSlugAvailability: async (slug: string): Promise<{ available: boolean }> => {
    const { data } = await apiClient.get<{ available: boolean }>(`/tenants/check-slug/${slug}`);
    return data;
  },

  getUsage: async (id: string, range: '7d' | '30d' | '90d'): Promise<UsageMetricsDto> => {
    const { data } = await apiClient.get<UsageMetricsDto>(`/tenants/${id}/usage`, {
      params: { range },
    });
    return data;
  },
};
