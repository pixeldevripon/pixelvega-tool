import type { EnumDisplay } from '@/contexts/role-context';

/**
 * The notification shapes the API returns, from
 * `notifications/dto/notification.dto.ts`.
 *
 * One row per RECIPIENT, not one shared row several people read, which is why
 * every field here is personal: `readAt` is when YOU read it, and there is no
 * actor on the payload at all.
 */

/** One row of `GET /notifications`. */
export interface NotificationItem {
    id: string;
    userId: string;
    /** `{ value, label, tone }` (ADR 0001). Branch on `value`, render `label`. */
    type: EnumDisplay;
    title: string;
    message: string | null;
    /**
     * Ids the client could deep link from, shaped per notification type.
     *
     * `unknown` rather than a record on purpose: there is no endpoint that says
     * which ids a given type carries, so anything reading this has to narrow it
     * itself. Nothing in the header panels does, and a screen that wants to
     * should get a `url` on the response instead (D4).
     */
    metadata: unknown;
    /** Null until the recipient reads it. */
    readAt: string | null;
    createdAt: string;
}

/** `GET /notifications`. The API's paginated envelope. */
export interface PaginatedNotifications {
    items: NotificationItem[];
    total: number;
    page: number;
    pageSize: number;
}

/** `GET /notifications/unread-count`. */
export interface UnreadCount {
    count: number;
}

/**
 * `PATCH /notifications/read-all`.
 *
 * `updatedCount`, which is what `NotificationsService.markAllRead` returns.
 * The DTO in the backend names the field `count`, and the service is the one
 * that ships, so nothing here reads it: the mutation invalidates and the fresh
 * count arrives from `unread-count`. Typed anyway so a caller that wants the
 * number is not tempted to guess.
 */
export interface MarkAllReadResult {
    updatedCount: number;
}

/** Query params `GET /notifications` accepts. */
export interface NotificationsQuery {
    page?: number;
    pageSize?: number;
    /** Only rows whose `readAt` is null. Omitted, never `false`, for "all". */
    unreadOnly?: boolean;
}
