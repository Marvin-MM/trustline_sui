import apiClient from '@/lib/api-client';
import { buildWalrusBlobUrl } from '@/lib/walrus';
import type { PaginatedResponse } from '@bondflow/types';
import {
  type RelationshipStatus,
  type MilestoneStatus,
  type ConditionType,
  type DisputeStatus,
  type ReleasePolicy,
  type RelationshipAction,
  type RelationshipActorRole,
  type AnomalyPreflightResult,
} from '@bondflow/types';

export interface MilestoneDto {
  index: number;
  amount: string;
  conditionType: ConditionType;
  conditionValue: string;
  status: MilestoneStatus;
  disputeStatus: DisputeStatus;
  releasedAt: string | null;
  walrusBlobId: string | null;
  latestAgentActionId: string | null;
  releasePolicy: ReleasePolicy;
  verificationEvidenceHash: string | null;
  challengeDeadline: string | null;
  actions: RelationshipAction[];
  deliverable: {
    uploadId: string;
    blobId: string;
    mimeType: string;
    sizeBytes: string | null;
    walrusUrl: string;
    verificationStatus: string;
    confidence: number | null;
    reason: string | null;
    createdAt: string;
  } | null;
}

export interface RelationshipDto {
  id: string;
  onChainId: string;
  payerWallet: string;
  recipientWallet: string;
  status: RelationshipStatus;
  memo: string;
  walrusMemorySpaceId: string | null;
  totalAmount: string;
  releasedAmount: string;
  milestones: MilestoneDto[];
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
  actorRole: RelationshipActorRole;
  availableActions: RelationshipAction[];
  lifecycleGuidance: string;
  contractVersion: number;
  legacyReadOnly: boolean;
  asset: { type: string; symbol: string; decimals: number };
  automation: {
    active: boolean;
    expiresAt: string | null;
    allowedActions: number[];
  };
}

export interface CreateRelationshipPtbResponse {
  ptb: string; // base64-encoded PTB bytes
  description: string;
  estimatedGas: string;
  relationshipId?: string;
  walrusMemorySpaceId?: string;
  asset?: { type: string; symbol: string; decimals: number };
  effects?: {
    fundsLockedBaseUnits: string;
    verifierCapabilityGranted: boolean;
    autoReleaseChallengeHours: number;
  };
}

export interface PaymentAssetPreflight {
  asset: {
    type: string;
    symbol: string;
    decimals: number;
    network: string;
    issuer: string;
    faucetUrl: string | null;
  };
  wallet: string;
  gasBalanceMist: string;
  paymentBalanceBaseUnits: string;
  minimumCreateGasMist: string;
}

export interface AgentActionDto {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  confidence: number | null;
  durationMs: number;
  estimatedCostUsd: string | null;
  model: string | null;
  promptVersion: string | null;
  promptKey: string | null;
  success: boolean;
  errorMessage: string | null;
  milestoneIndex: number | null;
  createdAt: string;
}

function normalizeAgentAction(raw: Record<string, unknown>): AgentActionDto {
  const result = raw['result'] as Record<string, unknown> | undefined;
  const payload = (raw['payload'] as Record<string, unknown>) ?? {};
  const payloadPromptKey = typeof payload['promptKey'] === 'string' ? payload['promptKey'] : null;
  return {
    id: String(raw['id']),
    actionType: String(raw['actionType'] ?? 'UNKNOWN'),
    payload,
    result: result ?? {},
    confidence: result && typeof result['confidence'] === 'number' ? result['confidence'] : null,
    durationMs: Number(raw['durationMs'] ?? 0),
    estimatedCostUsd: raw['estimatedCostUsd'] ? String(raw['estimatedCostUsd']) : null,
    model: raw['model'] ? String(raw['model']) : raw['aiModel'] ? String(raw['aiModel']) : null,
    promptVersion: raw['promptVersion'] ? String(raw['promptVersion']) : null,
    promptKey: payloadPromptKey ?? (raw['promptKey'] ? String(raw['promptKey']) : raw['actionType'] ? String(raw['actionType']).toLowerCase().replace(/_/g, '-') : null),
    success: raw['success'] === undefined ? true : Boolean(raw['success']),
    errorMessage: raw['errorMessage'] ? String(raw['errorMessage']) : null,
    milestoneIndex: raw['milestoneIndex'] !== undefined && raw['milestoneIndex'] !== null ? Number(raw['milestoneIndex']) : null,
    createdAt: String(raw['createdAt'] ?? new Date().toISOString()),
  };
}

function normalizePtbResponse(data: { txBytes?: string; ptb?: string; description?: string; estimatedGas?: string; relationshipId?: string; walrusMemorySpaceId?: string }, description: string): CreateRelationshipPtbResponse {
  return {
    ptb: data.ptb ?? data.txBytes ?? '',
    description: data.description ?? description,
    estimatedGas: data.estimatedGas ?? '0',
    relationshipId: 'relationshipId' in data && data.relationshipId ? String(data.relationshipId) : undefined,
    walrusMemorySpaceId: 'walrusMemorySpaceId' in data && data.walrusMemorySpaceId ? String(data.walrusMemorySpaceId) : undefined,
  };
}

function normalizeRelationship(raw: Record<string, unknown>): RelationshipDto {
  const milestones = Array.isArray(raw['milestones']) ? raw['milestones'] as Record<string, unknown>[] : [];
  const uploads = Array.isArray(raw['deliverableUploads'])
    ? raw['deliverableUploads'] as Record<string, unknown>[]
    : [];
  const totalAmount = String(raw['totalAmount'] ?? raw['totalLockedAmount'] ?? '0');
  const releasedAmount = milestones.reduce((sum, milestone) => {
    const status = String(milestone['status'] ?? '');
    return status === 'RELEASED' ? sum + BigInt(String(milestone['amount'] ?? '0')) : sum;
  }, 0n).toString();

  const milestoneActions = (raw['milestoneActions'] as Record<string, RelationshipAction[]> | undefined) ?? {};
  const capabilities = Array.isArray(raw['capabilities']) ? raw['capabilities'] as Record<string, unknown>[] : [];
  const agentCapability = capabilities.find((capability) =>
    capability['capabilityType'] === 'AGENT' && !capability['revokedAt']);
  const agentPermissions = (agentCapability?.['permissions'] as { allowedActions?: number[] } | undefined) ?? {};
  return {
    id: String(raw['suiObjectId'] ?? raw['onChainId'] ?? raw['id']),
    onChainId: String(raw['suiObjectId'] ?? raw['onChainId'] ?? raw['id']),
    payerWallet: String(raw['payerWallet'] ?? ''),
    recipientWallet: String(raw['recipientWallet'] ?? ''),
    status: raw['status'] as RelationshipStatus,
    memo: String(raw['memo'] ?? ''),
    walrusMemorySpaceId: raw['walrusMemorySpaceId'] ? String(raw['walrusMemorySpaceId']) : null,
    totalAmount,
    releasedAmount,
    tenantId: raw['tenantId'] ? String(raw['tenantId']) : null,
    createdAt: String(raw['createdAt'] ?? new Date().toISOString()),
    updatedAt: String(raw['updatedAt'] ?? new Date().toISOString()),
    actorRole: (raw['actorRole'] ?? 'VIEWER') as RelationshipActorRole,
    availableActions: (raw['availableActions'] as RelationshipAction[] | undefined) ?? [],
    lifecycleGuidance: String(raw['lifecycleGuidance'] ?? 'No action is required right now.'),
    contractVersion: Number(raw['contractVersion'] ?? 1),
    legacyReadOnly: Boolean(raw['legacyReadOnly']),
    asset: {
      type: String(raw['assetType'] ?? ''),
      symbol: String(raw['assetSymbol'] ?? 'USDC'),
      decimals: Number(raw['assetDecimals'] ?? 6),
    },
    automation: {
      active: Boolean(agentCapability),
      expiresAt: agentCapability?.['expiresAt'] ? String(agentCapability['expiresAt']) : null,
      allowedActions: agentPermissions.allowedActions ?? [],
    },
    milestones: milestones.map((m, index) => {
      const milestoneIndex = Number(m['index'] ?? m['milestoneIndex'] ?? index);
      const latestUpload = uploads
        .filter((upload) => Number(upload['milestoneIndex']) === milestoneIndex)
        .sort((left, right) =>
          new Date(String(right['createdAt'] ?? 0)).getTime()
          - new Date(String(left['createdAt'] ?? 0)).getTime())[0];
      return {
        index: milestoneIndex,
        amount: String(m['amount'] ?? '0'),
        conditionType: m['conditionType'] as ConditionType,
        conditionValue: String(m['conditionValue'] ?? ''),
        status: m['status'] as MilestoneStatus,
        disputeStatus: m['disputeStatus'] as DisputeStatus,
        releasedAt: m['releasedAt'] ? String(m['releasedAt']) : null,
        walrusBlobId: m['walrusBlobId'] ? String(m['walrusBlobId']) : m['deliverableBlobId'] ? String(m['deliverableBlobId']) : null,
        latestAgentActionId: m['latestAgentActionId'] ? String(m['latestAgentActionId']) : null,
        releasePolicy: (m['releasePolicy'] ?? 'PAYER_APPROVAL') as ReleasePolicy,
        verificationEvidenceHash: m['verificationEvidenceHash'] ? String(m['verificationEvidenceHash']) : null,
        challengeDeadline: m['challengeDeadline'] ? String(m['challengeDeadline']) : null,
        actions: milestoneActions[String(milestoneIndex)] ?? [],
        deliverable: latestUpload ? {
          uploadId: String(latestUpload['id'] ?? ''),
          blobId: String(latestUpload['walrusBlobId'] ?? ''),
          mimeType: String(latestUpload['contentType'] ?? latestUpload['mimeType'] ?? 'application/octet-stream'),
          sizeBytes: latestUpload['sizeBytes'] === null || latestUpload['sizeBytes'] === undefined
            ? null
            : String(latestUpload['sizeBytes']),
          walrusUrl: buildWalrusBlobUrl(String(latestUpload['walrusBlobId'] ?? '')),
          verificationStatus: String(latestUpload['verificationStatus'] ?? 'UPLOADED'),
          confidence: latestUpload['verificationConfidence'] === null || latestUpload['verificationConfidence'] === undefined
            ? null
            : Number(latestUpload['verificationConfidence']),
          reason: latestUpload['verificationReason'] ? String(latestUpload['verificationReason']) : null,
          createdAt: String(latestUpload['createdAt'] ?? new Date().toISOString()),
        } : null,
      };
    }),
  };
}

export const relationshipsApi = {
  getPaymentAsset: async (): Promise<PaymentAssetPreflight> => {
    const { data } = await apiClient.get<PaymentAssetPreflight>('/relationships/asset');
    return data;
  },

  list: async (params: { page?: number; limit?: number }): Promise<PaginatedResponse<RelationshipDto>> => {
    const { data } = await apiClient.get<PaginatedResponse<Record<string, unknown>>>('/relationships', { params });
    return { ...data, data: data.data.map(normalizeRelationship) };
  },

  listAssigned: async (params: { page?: number; limit?: number }): Promise<PaginatedResponse<RelationshipDto>> => {
    const { data } = await apiClient.get<PaginatedResponse<Record<string, unknown>>>('/relationships/assigned', { params });
    return { ...data, data: data.data.map(normalizeRelationship) };
  },

  getById: async (id: string): Promise<RelationshipDto> => {
    const { data } = await apiClient.get<Record<string, unknown>>(`/relationships/${id}`);
    return normalizeRelationship(data);
  },

  getCreatePtb: async (params: {
    recipientWallet: string;
    milestones: Array<{ amount: string; conditionType: ConditionType; conditionValue: string; releasePolicy: ReleasePolicy }>;
    memo: string;
    clientRequestId: string;
  }): Promise<CreateRelationshipPtbResponse> => {
    const { data } = await apiClient.post<CreateRelationshipPtbResponse>('/relationships/ptb', params);
    return normalizePtbResponse(data, 'Create payment relationship');
  },

  checkAnomaly: async (params: {
    recipientWallet: string;
    clientRequestId: string;
    milestones: Array<{ amount: string; conditionType: ConditionType; conditionValue: string; releasePolicy: ReleasePolicy }>;
  }): Promise<AnomalyPreflightResult> => {
    const { data } = await apiClient.post<{ result: AnomalyPreflightResult; mutating: false }>('/relationships/anomaly-check', params);
    return data.result;
  },

  markPendingCreateFailed: async (relationshipId: string, error: string): Promise<void> => {
    await apiClient.post(`/relationships/pending/${relationshipId}/fail`, { error });
  },

  getRetryCreatePtb: async (relationshipId: string): Promise<CreateRelationshipPtbResponse> => {
    const { data } = await apiClient.post<CreateRelationshipPtbResponse>(`/relationships/pending/${relationshipId}/retry`);
    return normalizePtbResponse(data, 'Complete relationship setup');
  },

  getReleasePtb: async (id: string, milestoneIndex: number): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/milestones/${milestoneIndex}/release`
    );
    return normalizePtbResponse(data, `Release milestone ${milestoneIndex + 1}`);
  },

  getCancelPtb: async (id: string): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/cancel`
    );
    return normalizePtbResponse(data, 'Cancel relationship');
  },

  getSubmitDeliverablePtb: async (id: string, milestoneIndex: number, blobId: string) => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/milestones/${milestoneIndex}/submit-deliverable`,
      { blobId },
    );
    return normalizePtbResponse(data, `Submit deliverable for milestone ${milestoneIndex + 1}`);
  },

  getGrantAgentCapPtb: async (
    id: string,
    params: { agentAddress?: string; expiryDurationSeconds: number; allowedActions: number[]; maxActions: number }
  ): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/grant-agent-cap`,
      params
    );
    return normalizePtbResponse(data, 'Grant agent capability');
  },

  getRaiseDisputePtb: async (
    id: string,
    milestoneIndex: number,
    params: { reasonHash: string }
  ): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/milestones/${milestoneIndex}/raise-dispute`,
      params
    );
    return normalizePtbResponse(data, `Raise dispute for milestone ${milestoneIndex + 1}`);
  },

  uploadDisputeEvidence: async (id: string, milestoneIndex: number, reason: string) => {
    const { data } = await apiClient.post<{ reasonHash: string; walrusBlobId: string }>(
      `/relationships/${id}/milestones/${milestoneIndex}/dispute-evidence`,
      { reason },
    );
    return data;
  },

  getResolveDisputePtb: async (id: string, milestoneIndex: number, resolution: 2 | 3) => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/milestones/${milestoneIndex}/resolve-dispute`,
      { resolution },
    );
    return normalizePtbResponse(data, `Resolve dispute for milestone ${milestoneIndex + 1}`);
  },

  getRevokeAgentCapPtb: async (
    id: string,
  ): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/automation/revoke`,
    );
    return normalizePtbResponse(data, 'Revoke agent capability');
  },

  getGrantOperatorCapPtb: async (
    id: string,
    params: {
      operatorAddress: string;
      expiryDurationSeconds: number;
      canRelease: boolean;
      canCancel: boolean;
      canDispute: boolean;
    },
  ) => {
    const { data } = await apiClient.post<{ txBytes?: string; ptb?: string; description?: string; estimatedGas?: string }>(
      `/relationships/${id}/grant-operator-cap`,
      params,
    );
    return normalizePtbResponse(data, 'Grant workspace operator capability');
  },

  getAgentActions: async (
    id: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<AgentActionDto>> => {
    const { data } = await apiClient.get<PaginatedResponse<Record<string, unknown>>>(
      `/relationships/${id}/agent-actions`,
      { params }
    );
    return { ...data, data: data.data.map(normalizeAgentAction) };
  },
};
