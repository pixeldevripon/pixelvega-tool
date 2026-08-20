import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { DashboardBreakdown } from '@/types/dashboard';

import { BreakdownCard } from './breakdown-card';

const slice = (label: string, count: number) => ({
    key: { value: label.toUpperCase(), label, tone: 'default' },
    count,
    share: 0.1,
    shareLabel: '10%',
});

const breakdown = (labels: string[]): DashboardBreakdown => ({
    label: 'Projects by status',
    total: labels.length,
    totalLabel: `${labels.length} projects`,
    slices: labels.map((l, i) => slice(l, i + 1)),
});

const TEN = [
    'Planning',
    'Scheduled',
    'Ready for work',
    'In progress',
    'On hold',
    'Internal review',
    'Ready for client',
    'Waiting for feedback',
    'Completed',
    'Cancelled',
];

describe('BreakdownCard', () => {
    it('shows every row when no limit is given', () => {
        // The three-key severity breakdown must not grow a toggle.
        render(<BreakdownCard breakdown={breakdown(['Low', 'High'])} />);

        expect(screen.getByText('Low')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows no toggle when the list is shorter than the limit', () => {
        render(
            <BreakdownCard
                breakdown={breakdown(['Low', 'High'])}
                collapseAfter={5}
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('names how many rows are behind the toggle', () => {
        // EIGHT rows with a limit of five, so hidden (3) and visible (5)
        // differ. With ten and five they are both five, and a label counting
        // the wrong one reads correctly by coincidence.
        render(
            <BreakdownCard
                breakdown={breakdown(TEN.slice(0, 8))}
                collapseAfter={5}
            />,
        );

        expect(
            screen.getByRole('button', { name: /3 more/ }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /5 more/ })).toBeNull();
    });

    it('reveals the rest on click and offers to collapse again', async () => {
        const user = userEvent.setup();
        render(
            <BreakdownCard breakdown={breakdown(TEN)} collapseAfter={5} />,
        );

        await user.click(screen.getByRole('button', { name: /5 more/ }));

        expect(
            screen.getByRole('button', { name: /Show less/ }),
        ).toBeInTheDocument();
    });

    it('keeps every row in the ring, collapsed or not', () => {
        /**
         * The split is presentation. The chart's accessible description is
         * built from every slice, so the shape of the distribution is complete
         * whether or not the list is expanded, and no number changes.
         */
        render(
            <BreakdownCard
                breakdown={breakdown(TEN)}
                variant='bar'
                collapseAfter={5}
            />,
        );

        const chart = screen.getByRole('img');
        for (const label of TEN) {
            expect(chart.getAttribute('aria-label')).toContain(label);
        }
    });

    it('links a row when the caller supplies an href', () => {
        render(
            <BreakdownCard
                breakdown={breakdown(['Planning'])}
                sliceHref={(value) => `/projects?status=${value}`}
            />,
        );

        expect(
            screen.getByRole('link', { name: /Planning/ }),
        ).toHaveAttribute('href', '/projects?status=PLANNING');
    });

    it('leaves a row unlinked when the caller returns null', () => {
        render(
            <BreakdownCard
                breakdown={breakdown(['Planning'])}
                sliceHref={() => null}
            />,
        );

        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByText('Planning')).toBeInTheDocument();
    });
});
