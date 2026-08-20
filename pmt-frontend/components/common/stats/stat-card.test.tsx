import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DashboardMetric } from '@/types/dashboard';

import { StatCard } from './stat-card';

const metric = (overrides: Partial<DashboardMetric> = {}): DashboardMetric => ({
    key: 'activeProjects',
    label: 'Active projects',
    caption: 'Last 14 days',
    value: 14,
    valueLabel: '14',
    previousValue: 11,
    changeRate: 0.2727,
    changeLabel: '+27%',
    tone: { value: 'success', label: 'Improving', tone: 'success' },
    ...overrides,
});

describe('StatCard', () => {
    it('renders the value label, never the raw value', () => {
        // `value` is minutes for an hours metric, so rendering it would put
        // "5400" on a tile that should read "90h".
        render(<StatCard metric={metric({ value: 5400, valueLabel: '90h' })} />);

        expect(screen.getByText('90h')).toBeInTheDocument();
        expect(screen.queryByText('5400')).not.toBeInTheDocument();
    });

    it('renders the caption when the server sent one', () => {
        render(<StatCard metric={metric()} />);

        expect(screen.getByText('Last 14 days')).toBeInTheDocument();
    });

    it('omits the caption line when there is none', () => {
        render(<StatCard metric={metric({ caption: null })} />);

        expect(screen.queryByText('Last 14 days')).not.toBeInTheDocument();
    });

    it('shows the delta the server decided', () => {
        render(<StatCard metric={metric()} />);

        expect(screen.getByText('+27%')).toBeInTheDocument();
        expect(screen.getByText('Improving')).toBeInTheDocument();
    });

    it('shows no delta at all when there is no comparable history', () => {
        render(
            <StatCard
                metric={metric({
                    previousValue: null,
                    changeRate: null,
                    changeLabel: null,
                })}
            />,
        );

        expect(screen.queryByText('+27%')).not.toBeInTheDocument();
    });

    it('renders the visual passed as a child', () => {
        render(
            <StatCard metric={metric()}>
                <div data-testid='strip' />
            </StatCard>,
        );

        expect(screen.getByTestId('strip')).toBeInTheDocument();
    });

    it('still renders a metric key it has no icon for', () => {
        // A client must never break on an API that grew a tile this build has
        // not heard of.
        render(
            <StatCard
                metric={metric({ key: 'somethingNew', label: 'Something new' })}
            />,
        );

        expect(screen.getByText('Something new')).toBeInTheDocument();
    });
});
