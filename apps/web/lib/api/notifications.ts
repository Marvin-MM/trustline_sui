import apiClient from '@/lib/api-client';
import type { NotificationDto } from '@/stores/notification.store';

export const notificationsApi = {
  list: async (): Promise<NotificationDto[]> => {
    const { data } = await apiClient.get<NotificationDto[]>('/notifications');
    return data;
  },
  markRead: async (notificationId: string): Promise<void> => {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await apiClient.post('/notifications/read-all', {});
  },
};
