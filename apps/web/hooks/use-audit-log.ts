'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface AuditEvent {
  id: string;
  type: 'audit' | 'blockchain' | 'ai_action' | 'notification' | 'transaction';
  timestamp: string;
  actor: string;
  summary: string;
  metadata: Record<string, unknown>;
}

interface AuditLogPage {
  data: AuditEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface AuditLogClientPage {
  entries: AuditEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * React Query infinite query for paginated audit log entries.
 * Uses the backend's bounded page-based pagination.
 */
export function useAuditLog(relationshipId: string | null) {
  return useInfiniteQuery({
    queryKey: ['audit-log', relationshipId],
    queryFn: async ({ pageParam }): Promise<AuditLogClientPage> => {
      if (!relationshipId) return { entries: [], nextCursor: null, hasMore: false };

      const page = typeof pageParam === 'number' ? pageParam : 1;

      const { data } = await apiClient.get<AuditLogPage>(
        `/relationships/${relationshipId}/audit-log`,
        { params: { page, limit: 20 } }
      );
      return {
        entries: data.data,
        nextCursor: page < data.pagination.totalPages ? String(page + 1) : null,
        hasMore: page < data.pagination.totalPages,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextCursor ? Number(lastPage.nextCursor) : undefined,
    enabled: !!relationshipId,
    staleTime: 30_000,
  });
}
