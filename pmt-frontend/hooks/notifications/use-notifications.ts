'use client';

import {
    keepPreviousData,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { notificationsApi } from '@/lib/api/notifications';
import type { NotificationsQuery } from '@/types/notifications';

/**
 * The one key factory for the notification feed. Every query and every
 * invalidation below goes through it: an inline key array drifts and silently
 * stops matching, and the symptom here is specifically nasty, a badge saying
 * three unread over a list showing none.
 */
export const notificationKeys = {
    all: ['notifications'] as const,
    lists: () => [...notificationKeys.all, 'list'] as const,
    list: (params: NotificationsQuery) =>
        [...notificationKeys.lists(), params] as const,
    feed: (params: NotificationsQuery) =>
        [...notificationKeys.all, 'feed', params] as const,
    unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

/** How long between background polls of the unread count. */
const UNREAD_POLL_MS = 60 * 1000;

/**
 * The unread count behind the bell's dot.
 *
 * Polled, and deliberately the ONLY polled query in the header: it is one
 * indexed `count` on a `(userId, readAt)` filter, so a dashboard left open on a
 * second monitor all day costs one aggregate a minute rather than a page of
 * rows. The list is a separate hook precisely so it can stay unfetched until a
 * panel opens.
 */
export function useUnreadNotificationCount() {
    return useQuery({
        queryKey: notificationKeys.unreadCount(),
        queryFn: () => notificationsApi.unreadCount(),
        refetchInterval: UNREAD_POLL_MS,
        // Poll while the tab is hidden too, so returning to the tab shows the
        // right number immediately rather than the number from when it was
        // backgrounded and then a flicker.
        refetchIntervalInBackground: true,
    });
}

/**
 * One page of notifications, for the bell's popover.
 *
 * `enabled` is the popover's open state. A closed popover must not fetch: the
 * bell is on every authenticated screen, so a query that ran on mount would be
 * a request per navigation for rows nobody asked to see.
 *
 * `keepPreviousData` so switching tabs swaps the rows rather than emptying the
 * panel to a skeleton and back.
 */
export function useNotifications(
    params: NotificationsQuery,
    enabled: boolean,
) {
    return useQuery({
        queryKey: notificationKeys.list(params),
        queryFn: () => notificationsApi.list(params),
        enabled,
        placeholderData: keepPreviousData,
    });
}

/**
 * The paginated feed behind the activity sheet.
 *
 * Offset paged rather than cursor paged because that is what the endpoint
 * serves: `{ items, total, page, pageSize }`. `getNextPageParam` therefore has
 * to compare rows seen against `total`, which is pagination plumbing rather than
 * a derived display value: nothing it computes is rendered.
 */
export function useNotificationFeed(
    params: NotificationsQuery,
    enabled: boolean,
) {
    return useInfiniteQuery({
        queryKey: notificationKeys.feed(params),
        queryFn: ({ pageParam }) =>
            notificationsApi.list({ ...params, page: pageParam }),
        enabled,
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            const seen = allPages.reduce(
                (count, page) => count + page.items.length,
                0,
            );
            return seen < lastPage.total ? lastPage.page + 1 : undefined;
        },
    });
}

/**
 * Mark one read.
 *
 * Both mutations invalidate `notificationKeys.all`, which covers the lists, the
 * feed and the count in one call. Invalidating only the list is the bug this
 * avoids: the row would grey out while the bell kept its dot until the next
 * poll, and a stale dot on a read inbox trains people to ignore the dot.
 */
export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: string) =>
            notificationsApi.markRead(notificationId),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
        // No toast on success: marking read is a side effect of opening
        // something, and a toast for it would fire on every click.
        onError: (error: Error) =>
            toast.error(error.message || 'Could not mark that as read'),
    });
}

/** Mark every unread one read. */
export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => notificationsApi.markAllRead(),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
        onError: (error: Error) =>
            toast.error(error.message || 'Could not mark those as read'),
    });
}
