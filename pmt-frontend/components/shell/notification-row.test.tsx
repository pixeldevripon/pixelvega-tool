import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '@/types/notifications';

import { NotificationRow } from './notification-row';

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
    id: 'notif-1',
    userId: 'user-1',
    type: {
        value: 'BLOCKER_ASSIGNED',
        label: 'Blocker assigned',
        tone: 'danger',
    },
    title: 'A blocker was assigned to you',
    message: 'Checkout page will not build',
    metadata: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
});

describe('NotificationRow', () => {
    it('renders the API label rather than a label of its own', () => {
        // If this ever needs a map in the browser, the API stopped sending the
        // label and the fix belongs on the server (D4).
        render(<NotificationRow item={item()} onMarkRead={vi.fn()} />);

        expect(
            screen.getByText('A blocker was assigned to you'),
        ).toBeInTheDocument();
        expect(screen.getByText('Blocker assigned')).toBeInTheDocument();
        expect(
            screen.getByText('Checkout page will not build'),
        ).toBeInTheDocument();
    });

    it('omits the message line when there is no message', () => {
        render(
            <NotificationRow item={item({ message: null })} onMarkRead={vi.fn()} />,
        );

        expect(
            screen.queryByText('Checkout page will not build'),
        ).not.toBeInTheDocument();
    });

    it('is a control while unread, and marks THAT row read', async () => {
        const onMarkRead = vi.fn();
        render(
            <NotificationRow
                item={item({ id: 'notif-42' })}
                onMarkRead={onMarkRead}
            />,
        );

        const button = screen.getByRole('button', {
            name: 'Mark as read: A blocker was assigned to you',
        });
        await userEvent.click(button);

        expect(onMarkRead).toHaveBeenCalledWith('notif-42');
    });

    it('is NOT a control once read', () => {
        // A read row has nothing left to do. Rendering it as a button anyway
        // puts a focus stop on every row of a long history and promises an
        // action that does not happen.
        render(
            <NotificationRow
                item={item({ readAt: '2026-08-20T09:00:00.000Z' })}
                onMarkRead={vi.fn()}
            />,
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('tints an unread row and leaves a read one plain', () => {
        const { container, unmount } = render(
            <NotificationRow item={item()} onMarkRead={vi.fn()} />,
        );
        expect(container.querySelector('button')?.className).toContain(
            'bg-primary-subtle/40',
        );
        unmount();

        const read = render(
            <NotificationRow
                item={item({ readAt: '2026-08-20T09:00:00.000Z' })}
                onMarkRead={vi.fn()}
            />,
        );
        expect(read.container.innerHTML).not.toContain('bg-primary-subtle/40');
    });
});
