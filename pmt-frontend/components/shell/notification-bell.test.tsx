import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '@/types/notifications';

import { NotificationBell } from './notification-bell';

/**
 * The hooks are mocked, not the transport: what this file is about is what the
 * bell DOES with a count and a page of rows. The hooks' own wiring is pinned in
 * `hooks/notifications/use-notifications.test.tsx`.
 */
const useNotifications = vi.fn();
const markRead = vi.fn();
const markAllRead = vi.fn();
let unreadCount = 0;

vi.mock('@/hooks/notifications/use-notifications', () => ({
    useUnreadNotificationCount: () => ({ data: { count: unreadCount } }),
    useNotifications: (...args: unknown[]) => useNotifications(...args),
    useMarkNotificationRead: () => ({ mutate: markRead }),
    useMarkAllNotificationsRead: () => ({
        mutate: markAllRead,
        isPending: false,
    }),
}));

const row = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
    id: 'notif-1',
    userId: 'user-1',
    type: { value: 'PROJECT_ON_HOLD', label: 'Project on hold', tone: 'warning' },
    title: 'Aurora is on hold',
    message: null,
    metadata: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
});

/** The shape `useNotifications` hands back. */
const loaded = (items: NotificationItem[]) => ({
    data: { items, total: items.length, page: 1, pageSize: 10 },
    isLoading: false,
    isError: false,
    error: null,
});

beforeEach(() => {
    vi.clearAllMocks();
    unreadCount = 0;
    useNotifications.mockReturnValue(loaded([row()]));
});

describe('the bell trigger', () => {
    it('states the unread count in its accessible name', () => {
        unreadCount = 3;
        render(<NotificationBell onOpenActivity={vi.fn()} />);

        expect(
            screen.getByRole('button', { name: 'Notifications, 3 unread' }),
        ).toBeInTheDocument();
    });

    it('says only "Notifications" when nothing is unread', () => {
        unreadCount = 0;
        render(<NotificationBell onOpenActivity={vi.fn()} />);

        expect(
            screen.getByRole('button', { name: 'Notifications' }),
        ).toBeInTheDocument();
    });

    it('does not request the list until the popover opens', () => {
        render(<NotificationBell onOpenActivity={vi.fn()} />);

        // Second argument is the `enabled` flag, which IS the open state.
        expect(useNotifications).toHaveBeenCalledWith(
            { pageSize: 10, unreadOnly: true },
            false,
        );
    });
});

describe('the popover', () => {
    it('opens on the unread tab and asks the server to filter', async () => {
        unreadCount = 1;
        render(<NotificationBell onOpenActivity={vi.fn()} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications, 1 unread' }),
        );

        expect(useNotifications).toHaveBeenLastCalledWith(
            { pageSize: 10, unreadOnly: true },
            true,
        );
        expect(screen.getByText('Aurora is on hold')).toBeInTheDocument();
    });

    it('drops unreadOnly when the All tab is picked, rather than filtering rows here', async () => {
        render(<NotificationBell onOpenActivity={vi.fn()} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications' }),
        );

        await userEvent.click(screen.getByRole('tab', { name: 'All' }));

        expect(useNotifications).toHaveBeenLastCalledWith(
            { pageSize: 10, unreadOnly: false },
            true,
        );
    });

    it('shows the count pill and Mark all read only when something is unread', async () => {
        unreadCount = 8;
        render(<NotificationBell onOpenActivity={vi.fn()} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications, 8 unread' }),
        );

        expect(screen.getByText('8 new')).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole('button', { name: /mark all read/i }),
        );
        expect(markAllRead).toHaveBeenCalledTimes(1);
    });

    it('offers no Mark all read on an inbox with nothing unread', async () => {
        unreadCount = 0;
        render(<NotificationBell onOpenActivity={vi.fn()} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications' }),
        );

        expect(
            screen.queryByRole('button', { name: /mark all read/i }),
        ).not.toBeInTheDocument();
    });

    it('caps a three digit count so the pill cannot stretch the panel', async () => {
        unreadCount = 240;
        render(<NotificationBell onOpenActivity={vi.fn()} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications, 240 unread' }),
        );

        expect(screen.getByText('99+ new')).toBeInTheDocument();
    });

    it('says the inbox is empty, and says it differently per tab', async () => {
        useNotifications.mockReturnValue(loaded([]));
        render(<NotificationBell onOpenActivity={vi.fn()} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications' }),
        );

        expect(screen.getByText('Nothing unread.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('tab', { name: 'All' }));
        expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
    });

    it('surfaces a failed load with the message the API layer wrote', async () => {
        // `ApiError.message` is built to be shown verbatim, which is why it is
        // rendered rather than replaced with copy of our own.
        useNotifications.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('We could not load your notifications.'),
        });
        render(<NotificationBell onOpenActivity={vi.fn()} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications' }),
        );

        expect(
            screen.getByText('We could not load your notifications.'),
        ).toBeInTheDocument();
    });

    it('marks a row read with that row id', async () => {
        render(<NotificationBell onOpenActivity={vi.fn()} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications' }),
        );

        await userEvent.click(
            screen.getByRole('button', {
                name: 'Mark as read: Aurora is on hold',
            }),
        );

        expect(markRead).toHaveBeenCalledWith('notif-1');
    });

    it('hands the activity sheet over and closes itself', async () => {
        const onOpenActivity = vi.fn();
        render(<NotificationBell onOpenActivity={onOpenActivity} />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Notifications' }),
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Open activity' }),
        );

        expect(onOpenActivity).toHaveBeenCalledTimes(1);
        // Closed, which is why the sheet is mounted a level up in
        // `HeaderActions` rather than inside this popover's subtree.
        expect(
            screen.queryByRole('button', { name: 'Open activity' }),
        ).not.toBeInTheDocument();
    });
});
