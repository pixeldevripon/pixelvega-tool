import type { Paginated } from '@/types/api';
import type {
    MarkAllReadResult,
    NotificationsQuery,
    PaginatedNotifications,
    UnreadCount,
} from '@/types/notifications';

import { apiFetch, buildQuery } from './fetch';

/**
 * The notifications API, one function per route on
 * `notifications.controller.ts`. Every route there is self scoped: no role ever
 * reads another person's notifications, so nothing here takes a user id.
 */
export const notificationsApi = {
    /**
     * `unreadOnly` is spread rather than passed as `false`, because the backend
     * reads it with `@ToBoolean()` and the whole point of that decorator is that
     * `'false'` is a real value. Sending `unreadOnly=false` would be honest, but
     * omitting the param is what "no filter" means, and `buildQuery` would
     * serialise the boolean either way.
     */
    list(query: NotificationsQuery = {}): Promise<PaginatedNotifications> {
        const qs = buildQuery({
            page: query.page,
            pageSize: query.pageSize,
            ...(query.unreadOnly ? { unreadOnly: true } : {}),
        });
        return apiFetch<PaginatedNotifications>(`/notifications${qs}`);
    },

    unreadCount(): Promise<UnreadCount> {
        return apiFetch<UnreadCount>('/notifications/unread-count');
    },

    markRead(notificationId: string): Promise<void> {
        return apiFetch<void>(`/notifications/${notificationId}/read`, {
            method: 'PATCH',
        });
    },

    markAllRead(): Promise<MarkAllReadResult> {
        return apiFetch<MarkAllReadResult>('/notifications/read-all', {
            method: 'PATCH',
        });
    },
};
