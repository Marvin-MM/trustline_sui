import apiClient from '@/lib/api-client';
import { buildWalrusBlobUrl } from '@/lib/walrus';
import type { DeliverableVerificationStatus, ScanStatus } from '@bondflow/types';

export interface DeliverableDto {
  id: string;
  relationshipId: string;
  milestoneIndex: number;
  walrusBlobId: string;
  walrusUrl: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: ScanStatus;
  verificationResult: {
    verified: boolean;
    confidence: number;
    reason: string;
    blobIdMatch: boolean;
  } | null;
  verificationStatus: DeliverableVerificationStatus;
  createdAt: string;
}

export interface UploadDeliverableResponse {
  blobId: string;
  walrusUrl: string;
  sizeBytes: number;
  uploadId?: string;
  verificationStatus?: DeliverableVerificationStatus;
}

export const deliverablesApi = {
  getById: async (id: string): Promise<DeliverableDto> => {
    const { data } = await apiClient.get<DeliverableDto>(`/deliverables/${id}`);
    return data;
  },

  upload: async (
    relationshipId: string,
    milestoneIndex: number,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadDeliverableResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('relationshipId', relationshipId);
    formData.append('milestoneIndex', String(milestoneIndex));

    const { data } = await apiClient.post<UploadDeliverableResponse & { uploadId?: string }>('/deliverables/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });
    return {
      blobId: data.blobId,
      walrusUrl: data.walrusUrl ?? buildWalrusBlobUrl(data.blobId),
      sizeBytes: data.sizeBytes ?? file.size,
      uploadId: data.uploadId,
      verificationStatus: data.verificationStatus,
    };
  },

  getSubmitPtb: async (params: {
    relationshipId: string;
    milestoneIndex: number;
    blobId: string;
  }): Promise<{ ptb: string; description: string; estimatedGas: string }> => {
    const { data } = await apiClient.post<{ ptb: string; description: string; estimatedGas: string }>(
      '/deliverables/submit/ptb',
      params
    );
    return data;
  },

  queueVerification: async (params: {
    relationshipId: string;
    milestoneIndex: number;
    blobId: string;
    retry?: boolean;
  }) => {
    const { data } = await apiClient.post<{
      message: string;
      jobId: string | null;
      verificationStatus: DeliverableVerificationStatus;
    }>('/deliverables/verify', params);
    return data;
  },

  getByRelationship: async (relationshipId: string): Promise<DeliverableDto[]> => {
    const { data } = await apiClient.get<DeliverableDto[]>(`/deliverables`, {
      params: { relationshipId },
    });
    return data;
  },
};
