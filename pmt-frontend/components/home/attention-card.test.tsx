import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
    DashboardAttention,
    DashboardAttentionItem,
} from '@/types/dashboard';

import { AttentionCard } from './attention-card';

const item = (
    overrides: Partial<DashboardAttentionItem> & { key: string },
): DashboardAttentionItem => ({
    label: 'Overdue projects',
    count: 4,
    tone: { value: 'overdue', label: 'Past due', tone: 'danger' },
    ...overrides,
});

const attention = (
    items: DashboardAttentionItem[],
    total = items.reduce((sum, row) => sum + row.count, 0),
): DashboardAttention => ({
    total,
    totalLabel: `${total} waiting`,
    items,
});

describe('AttentionCard', () => {
    it('renders the rows in the order the server sent them', () => {
        // The order is a decision: sorting here would move a row every time a
        // project changed, and a reader would never learn where to look.
        render(
            <AttentionCard
                attention={attention([
                    item({ key: 'overdueProjects' }),
                    item({
                        key: 'internalReview',
                        label: 'In internal review',
                        count: 1,
                        tone: {
                            value: 'routine',
                            label: 'Moving normally',
                            tone: 'default',
                        },
                    }),
                ])}
            />,
        );

        const rows = screen.getAllByRole('link');
        expect(rows[0]).toHaveTextContent('Overdue projects');
        expect(rows[1]).toHaveTextContent('In internal review');
    });

    it('renders only what the server sent, and adds no row of its own', () => {
        // This component used to declare all six queues itself and filter them.
        render(
            <AttentionCard
                attention={attention([item({ key: 'overdueProjects' })])}
            />,
        );

        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(
            screen.queryByText('Leave to approve'),
        ).not.toBeInTheDocument();
    });

    it('renders the count the server sent', () => {
        render(
            <AttentionCard
                attention={attention([
                    item({ key: 'pendingRequirements', count: 9 }),
                ])}
            />,
        );

        expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('links each known queue to its screen', () => {
        render(
            <AttentionCard
                attention={attention([
                    item({ key: 'pendingLeaveRequests', count: 2 }),
                ])}
            />,
        );

        expect(screen.getByRole('link')).toHaveAttribute('href', '/leave');
    });

    it('renders an unknown queue without a link rather than dropping it', () => {
        // A client must never break on an API that moved forward. The number
        // still reaches the reader; this build simply does not know where a
        // queue it has never heard of lives.
        render(
            <AttentionCard
                attention={attention([
                    item({ key: 'somethingNew', label: 'Something new', count: 3 }),
                ])}
            />,
        );

        expect(screen.getByText('Something new')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('carries the tone label so colour is not the only cue', () => {
        render(
            <AttentionCard
                attention={attention([item({ key: 'overdueProjects' })])}
            />,
        );

        expect(screen.getByRole('link')).toHaveAttribute('title', 'Past due');
    });

    it('says nothing is waiting when the list is empty', () => {
        render(<AttentionCard attention={attention([])} />);

        expect(
            screen.getByText('Nothing is waiting on anyone.'),
        ).toBeInTheDocument();
    });

    it('renders the total the server sent, not a sum of the rows', () => {
        // The two are the same today. They would stop being the same the moment
        // the API bounded the row list, and the header would then be the lie.
        render(
            <AttentionCard
                attention={attention(
                    [item({ key: 'overdueProjects', count: 4 })],
                    12,
                )}
            />,
        );

        expect(screen.getByText('12 waiting')).toBeInTheDocument();
    });
});
