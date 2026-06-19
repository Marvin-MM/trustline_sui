'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { useRouter } from 'next/navigation';
import { notificationsApi } from '@/lib/api/notifications';
import { queryKeys } from '@/lib/query-keys';
import { useNotificationStore, type NotificationDto } from '@/stores/notification.store';
import { formatRelativeTime } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';

function relationshipObjectId(notification: NotificationDto): string | null {
  const value = notification.metadata['relationshipObjectId'];
  return typeof value === 'string' && value ? value : null;
}

export function NotificationPopover() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const notificationQuery = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: notificationsApi.list,
    staleTime: 25_000,
  });

  const markOne = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (_, id) => {
      markRead(id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    },
  });
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      markAllRead();
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
    },
  });

  const openNotification = (notification: NotificationDto) => {
    if (!notification.isRead) markOne.mutate(notification.id);
    const objectId = relationshipObjectId(notification);
    if (objectId) router.push(ROUTES.personalRelationshipDetail(objectId));
  };

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto p-1">
            {notificationQuery.isLoading && notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <RefreshCw className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">Loading notifications</p>
              </div>
            ) : notificationQuery.isError && notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">Notifications unavailable</p>
                <button
                  type="button"
                  onClick={() => void notificationQuery.refetch()}
                  className="mt-3 text-xs font-medium text-brand hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">No notifications yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Relationship and workspace activity will appear here.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuPrimitive.Item
                  key={notification.id}
                  onSelect={() => openNotification(notification)}
                  className="cursor-pointer rounded-lg px-3 py-3 outline-none hover:bg-muted"
                >
                  <div className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead ? 'bg-muted-foreground/30' : 'bg-brand'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{notification.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(notification.createdAt)}</p>
                    </div>
                  </div>
                </DropdownMenuPrimitive.Item>
              ))
            )}
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
