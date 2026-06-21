import apiClient from '@/lib/api-client';
import type { TransactionStatus } from '@bondflow/types';

export interface WebhookTransactionResultDto {
  transactionDigest: string;
  status: TransactionStatus;
  txType?: string;
  relationshipId?: string;
  gasUsed?: string;
  error?: string;
  eventData?: Record<string, unknown>;
}

export const webhooksApi = {
  /**
   * Submit client-observed transaction status to the authenticated transaction API.
   * The server-to-server webhook remains HMAC-protected and is not called by browsers.
   */
  submitTransactionResult: async (params: WebhookTransactionResultDto): Promise<void> => {
    await apiClient.post('/transactions/client-status', params, {
      // Confirmed transactions reconcile Sui events, factual memory, and
      // lifecycle jobs. Keep the global API timeout strict for normal calls.
      timeout: params.status === 'CONFIRMED' ? 40_000 : 30_000,
    });
  },
};
