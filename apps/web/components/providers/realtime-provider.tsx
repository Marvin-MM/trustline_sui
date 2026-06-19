'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';

/**
 * RealtimeProvider — stable event transport facade.
 *
 * Current transport:
 * - React Query polling every 30 seconds for notifications.
 *
 * TODO(production): upgrade to SSE
 * Future transport:
 * - Connect EventSource to GET /api/v1/notifications/stream
 * - Keep this provider API and store writes unchanged
 * - Retain polling as a fallback when SSE disconnects or times out
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setNotifications = useNotificationStore((s) => s.setNotifications);

  const { data } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: notificationsApi.list,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  useEffect(() => {
    if (data) setNotifications(data);
  }, [data, setNotifications]);

  return <>{children}</>;
}
