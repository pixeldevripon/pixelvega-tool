import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notificationsApi } from '@/lib/api/notifications';
import type { PaginatedNotifications } from '@/types/notifications';

import {
    notificationKeys,
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useNotificationFeed,
    useNotifications,
    useUnreadNotificationCount,
} from './use-notifications';

vi.mock('@/lib/api/notifications', () => ({
    notificationsApi: {
        list: vi.fn(),
        unreadCount: vi.fn(),
        markRead: vi.fn(),
        markAllRead: vi.fn(),
    },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const api = vi.mocked(notificationsApi);

const page = (
    overrides: Partial<PaginatedNotifications> = {},
): PaginatedNotifications => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    ...overrides,
});

function harness() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
    return { queryClient, invalidate, wrapper };
}

beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue(page());
    api.unreadCount.mockResolvedValue({ count: 0 });
    api.markRead.mockResolvedValue(undefined);
    api.markAllRead.mockResolvedValue({ updatedCount: 0 });
});

describe('notificationKeys', () => {
    it('nests every key under one root, so one invalidation reaches them all', () => {
        expect(notificationKeys.all).toEqual(['notifications']);
        expect(notificationKeys.unreadCount()).toEqual([
            'notifications',
            'unread-count',
        ]);
        expect(notificationKeys.list({ pageSize: 10, unreadOnly: true })).toEqual(
            ['notifications', 'list', { pageSize: 10, unreadOnly: true }],
        );
        expect(notificationKeys.feed({ pageSize: 20 })).toEqual([
            'notifications',
            'feed',
            { pageSize: 20 },
        ]);
    });

    it('gives the two panels different keys for the same params', () => {
        // The bell holds one page and the sheet holds many. Sharing a key would
        // let the bell's single page overwrite the sheet's accumulated pages.
        expect(notificationKeys.list({ pageSize: 20 })).not.toEqual(
            notificationKeys.feed({ pageSize: 20 }),
        );
    });
});

describe('useNotifications', () => {
    it('fires NOTHING while the panel is closed', async () => {
        const { wrapper } = harness();
        renderHook(() => useNotifications({ pageSize: 10 }, false), { wrapper });

        // The bell is on every authenticated screen, so a query that ran on
        // mount would be a request per navigation for rows nobody opened.
        await waitFor(() => expect(api.list).not.toHaveBeenCalled());
    });

    it('sends the tab through as unreadOnly once the panel is open', async () => {
        const { wrapper } = harness();
        renderHook(
            () => useNotifications({ pageSize: 10, unreadOnly: true }, true),
            { wrapper },
        );

        await waitFor(() =>
            expect(api.list).toHaveBeenCalledWith({
                pageSize: 10,
                unreadOnly: true,
            }),
        );
    });

    it('sends unreadOnly false for the all tab, so the server does the filtering', async () => {
        const { wrapper } = harness();
        renderHook(
            () => useNotifications({ pageSize: 10, unreadOnly: false }, true),
            { wrapper },
        );

        await waitFor(() =>
            expect(api.list).toHaveBeenCalledWith({
                pageSize: 10,
                unreadOnly: false,
            }),
        );
    });
});

describe('useUnreadNotificationCount', () => {
    it('reads the count without waiting for a panel to open', async () => {
        const { wrapper } = harness();
        const { result } = renderHook(() => useUnreadNotificationCount(), {
            wrapper,
        });
        api.unreadCount.mockResolvedValue({ count: 7 });

        await waitFor(() => expect(api.unreadCount).toHaveBeenCalled());
        await waitFor(() => expect(result.current.data).toBeDefined());
    });
});

describe('useNotificationFeed', () => {
    it('asks for page 1 first', async () => {
        const { wrapper } = harness();
        renderHook(() => useNotificationFeed({ pageSize: 20 }, true), {
            wrapper,
        });

        await waitFor(() =>
            expect(api.list).toHaveBeenCalledWith({ pageSize: 20, page: 1 }),
        );
    });

    it('offers another page while fewer rows have been seen than the total', async () => {
        api.list.mockResolvedValue(
            page({ items: rows(20), total: 25, page: 1, pageSize: 20 }),
        );
        const { wrapper } = harness();
        const { result } = renderHook(
            () => useNotificationFeed({ pageSize: 20 }, true),
            { wrapper },
        );

        await waitFor(() => expect(result.current.hasNextPage).toBe(true));

        api.list.mockResolvedValue(
            page({ items: rows(5), total: 25, page: 2, pageSize: 20 }),
        );
        await act(async () => {
            await result.current.fetchNextPage();
        });

        expect(api.list).toHaveBeenCalledWith({ pageSize: 20, page: 2 });
        // 20 + 5 === total, so there is nothing left to offer.
        await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    });

    it('offers no next page when the first page is the whole list', async () => {
        api.list.mockResolvedValue(
            page({ items: rows(3), total: 3, page: 1, pageSize: 20 }),
        );
        const { wrapper } = harness();
        const { result } = renderHook(
            () => useNotificationFeed({ pageSize: 20 }, true),
            { wrapper },
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.hasNextPage).toBe(false);
    });
});

describe('the mark-read mutations', () => {
    it('marks ONE read by the id it was handed', async () => {
        const { wrapper } = harness();
        const { result } = renderHook(() => useMarkNotificationRead(), {
            wrapper,
        });

        await act(async () => {
            await result.current.mutateAsync('notif-7');
        });

        expect(api.markRead).toHaveBeenCalledWith('notif-7');
    });

    it('invalidates the WHOLE notification root, not just the list', async () => {
        // Invalidating only the list is the bug this pins: the row would grey
        // out while the bell kept its dot until the next poll, and a stale dot
        // on a read inbox trains people to ignore the dot.
        const { wrapper, invalidate } = harness();
        const { result } = renderHook(() => useMarkNotificationRead(), {
            wrapper,
        });

        await act(async () => {
            await result.current.mutateAsync('notif-7');
        });

        expect(invalidate).toHaveBeenCalledWith({
            queryKey: notificationKeys.all,
        });
    });

    it('marks all read and invalidates the same root', async () => {
        const { wrapper, invalidate } = harness();
        const { result } = renderHook(() => useMarkAllNotificationsRead(), {
            wrapper,
        });

        await act(async () => {
            await result.current.mutateAsync();
        });

        expect(api.markAllRead).toHaveBeenCalledTimes(1);
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: notificationKeys.all,
        });
    });
});

/** `count` placeholder rows. Only the length is ever asserted on. */
function rows(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        id: `n-${index}`,
        userId: 'u-1',
        type: { value: 'PROJECT_CREATED', label: 'Project created', tone: 'default' },
        title: `Row ${index}`,
        message: null,
        metadata: null,
        readAt: null,
        createdAt: '2026-08-20T10:00:00.000Z',
    }));
}
