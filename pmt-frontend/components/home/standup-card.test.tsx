import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DashboardCompliance } from '@/types/dashboard';

import { StandupCard } from './standup-card';

describe('StandupCard', () => {
    const compliance = (
        overrides: Partial<DashboardCompliance> = {},
    ): DashboardCompliance => ({
        submitted: 9,
        expected: 12,
        rate: 0.75,
        rateLabel: '75%',
        ...overrides,
    });

    it('renders the rate the server computed', () => {
        render(<StandupCard compliance={compliance()} />);

        expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('renders the raw counts in the header', () => {
        render(<StandupCard compliance={compliance()} />);

        expect(screen.getByText('9 of 12 filed')).toBeInTheDocument();
    });

    it('says nobody was expected rather than drawing an empty ring', () => {
        // Null is not zero. On a day the whole team is on leave, "0%" would
        // claim the team failed to file.
        render(
            <StandupCard
                compliance={compliance({
                    submitted: 0,
                    expected: 0,
                    rate: null,
                    rateLabel: null,
                })}
            />,
        );

        expect(
            screen.getByText('Nobody was expected to file today.'),
        ).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('draws a ring at zero when people were expected and nobody filed', () => {
        // This IS a measured result, unlike the case above, and it should look
        // like one.
        render(
            <StandupCard
                compliance={compliance({
                    submitted: 0,
                    rate: 0,
                    rateLabel: '0%',
                })}
            />,
        );

        expect(screen.getByText('0%')).toBeInTheDocument();
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('spells the ring out for a screen reader without inventing a count', () => {
        render(<StandupCard compliance={compliance()} />);

        expect(
            screen.getByRole('img', {
                name: 'Filed: 9 filed, Outstanding: Not filed yet',
            }),
        ).toBeInTheDocument();
    });
});
