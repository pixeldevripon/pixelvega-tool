import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '@/types/notifications';

import { ActivitySheet } from './activity-sheet';

const feed = vi.fn();
const fetchNextPage = vi.fn();
const markRead = vi.fn();
const markAllRead = vi.fn();
let unreadCount = 0;

vi.mock('@/hooks/notifications/use-notifications', () => ({
    useUnreadNotificationCount: () => ({ data: { count: unreadCount } }),
    useNotificationFeed: (...args: unknown[]) => feed(...args),
    useMarkNotificationRead: () => ({ mutate: markRead }),
    useMarkAllNotificationsRead: () => ({
        mutate: markAllRead,
        isPending: false,
    }),
}));

const row = (id: string): NotificationItem => ({
    id,
    userId: 'user-1',
    type: {
        value: 'DEADLINE_APPROACHING',
        label: 'Deadline approaching',
        tone: 'warning',
    },
    title: `Notification ${id}`,
    message: null,
    metadata: null,
    readAt: null,
    createdAt: new Date().toISOString(),
});

const pages = (
    items: NotificationItem[][],
    overrides: Record<string, unknown> = {},
) => ({
    data: {
        pages: items.map((pageItems, index) => ({
            items: pageItems,
            total: 100,
            page: index + 1,
            pageSize: 20,
        })),
    },
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    unreadCount = 0;
    feed.mockReturnValue(pages([[row('a')]]));
});

describe('the activity sheet', () => {
    it('fetches nothing while it is closed', () => {
        render(<ActivitySheet open={false} onOpenChange={vi.fn()} />);

        // Second argument is `enabled`, which is the sheet's own open state.
        expect(feed).toHaveBeenCalledWith({ pageSize: 20 }, false);
    });

    it('is titled Activity and lists the feed once open', () => {
        render(<ActivitySheet open onOpenChange={vi.fn()} />);

        expect(feed).toHaveBeenCalledWith({ pageSize: 20 }, true);
        expect(screen.getByText('Activity')).toBeInTheDocument();
        expect(screen.getByText('Notification a')).toBeInTheDocument();
    });

    it('renders every loaded page, in the order the API returned them', () => {
        feed.mockReturnValue(pages([[row('a'), row('b')], [row('c')]]));
        render(<ActivitySheet open onOpenChange={vi.fn()} />);

        const titles = screen
            .getAllByText(/^Notification /)
            .map((node) => node.textContent);
        expect(titles).toEqual([
            'Notification a',
            'Notification b',
            'Notification c',
        ]);
    });

    it('hides Load more on the last page', () => {
        const { unmount } = render(
            <ActivitySheet open onOpenChange={vi.fn()} />,
        );
        expect(
            screen.queryByRole('button', { name: 'Load more' }),
        ).not.toBeInTheDocument();
        unmount();
    });

    it('appends the next page when Load more is pressed', async () => {
        feed.mockReturnValue(pages([[row('a')]], { hasNextPage: true }));
        render(<ActivitySheet open onOpenChange={vi.fn()} />);

        await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('says what the panel is for when it is empty', () => {
        feed.mockReturnValue(pages([[]]));
        render(<ActivitySheet open onOpenChange={vi.fn()} />);

        expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
    });

    it('surfaces a failed load with the message the API layer wrote', () => {
        feed.mockReturnValue(
            pages([[]], {
                data: undefined,
                isError: true,
                error: new Error('We could not load your activity.'),
            }),
        );
        render(<ActivitySheet open onOpenChange={vi.fn()} />);

        expect(
            screen.getByText('We could not load your activity.'),
        ).toBeInTheDocument();
    });

    it('offers no Mark all read when nothing is unread', () => {
        const { unmount } = render(
            <ActivitySheet open onOpenChange={vi.fn()} />,
        );
        expect(
            screen.queryByRole('button', { name: /mark all read/i }),
        ).not.toBeInTheDocument();
        unmount();
    });

    it('marks everything read from the header', async () => {
        unreadCount = 4;
        render(<ActivitySheet open onOpenChange={vi.fn()} />);

        await userEvent.click(
            screen.getByRole('button', { name: /mark all read/i }),
        );

        expect(markAllRead).toHaveBeenCalledTimes(1);
    });

    it('marks one row read with that row id', async () => {
        render(<ActivitySheet open onOpenChange={vi.fn()} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Mark as read: Notification a' }),
        );

        expect(markRead).toHaveBeenCalledWith('a');
    });
});
