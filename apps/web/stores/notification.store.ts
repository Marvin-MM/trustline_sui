/**
 * Notification store — populated by React Query refetch, not by polling here.
 *
 * TODO(production): upgrade to SSE
 * Current approach: React Query polls GET /api/v1/notifications every 30 seconds
 * (refetchInterval: 30000 in the useNotifications hook). This is an explicitly
 * hackathon-appropriate solution.
 *
 * Production upgrade path:
 * 1. Backend exposes GET /api/v1/notifications/stream returning text/event-stream
 * 2. Client connects with EventSource (or a library like @microsoft/fetch-event-source
 *    for POST-based SSE with auth headers)
 * 3. On each SSE event, call setNotifications() to update this store
 * 4. React Query polling can be disabled or kept as a fallback
 * 5. No schema changes required — only the transport layer changes
 *
 * Note: SSE doesn't work through corporate proxies. Add a fallback polling
 * mechanism that activates when the EventSource connection fails after 30s.
 */

import { create } from 'zustand';
import type { NotificationType } from '@bondflow/types';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface NotificationState {
  notifications: NotificationDto[];
  unreadCount: number;
  lastFetchedAt: number | null;

  setNotifications: (notifications: NotificationDto[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  lastFetchedAt: null,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
      lastFetchedAt: Date.now(),
    }),

  markRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.isRead).length,
      };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
}));
