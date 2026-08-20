import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DashboardSeriesPoint } from '@/types/dashboard';

import { MiniBars } from './mini-bars';

const point = (
    overrides: Partial<DashboardSeriesPoint> & { date: string },
): DashboardSeriesPoint => ({
    label: 'Mon 17',
    value: 0,
    valueLabel: '0m',
    isWorkingDay: true,
    isPeak: false,
    ...overrides,
});

/** The strip's own children. `div > div` would also match the strip itself. */
const bars = (container: HTMLElement) =>
    Array.from(
        container.firstElementChild?.children ?? [],
    ) as HTMLElement[];

describe('MiniBars', () => {
    it('scales every bar against the peak the server flagged', () => {
        // Half the peak is half the height. The peak itself is the reference,
        // which is why it is not scanned for here.
        const { container } = render(
            <MiniBars
                points={[
                    point({ date: '2026-08-17', value: 480, isPeak: true }),
                    point({ date: '2026-08-18', value: 240 }),
                ]}
            />,
        );

        const [peak, half] = bars(container);
        expect(peak.style.height).toBe('100%');
        expect(half.style.height).toBe('50%');
    });

    it('emphasises the peak bar and only the peak bar', () => {
        const { container } = render(
            <MiniBars
                points={[
                    point({ date: '2026-08-17', value: 120 }),
                    point({ date: '2026-08-18', value: 480, isPeak: true }),
                ]}
            />,
        );

        const [quiet, peak] = bars(container);
        expect(peak.className).toContain('bg-primary');
        expect(peak.className).not.toContain('bg-primary/35');
        expect(quiet.className).toContain('bg-primary/35');
    });

    it('draws the weekly off day faintly rather than omitting it', () => {
        // A gap would imply a missing day rather than the team's day off.
        const { container } = render(
            <MiniBars
                points={[
                    point({ date: '2026-08-21', isWorkingDay: false }),
                    point({ date: '2026-08-22', value: 300, isPeak: true }),
                ]}
            />,
        );

        const [off] = bars(container);
        expect(off.className).toContain('bg-line');
    });

    it('draws no height at all for every day when the series is zero', () => {
        // The server flags no peak on a flat series. The `min-h-0.5` floor is
        // what keeps the slots visible, so the inline height is left at nothing.
        const { container } = render(
            <MiniBars
                points={[
                    point({ date: '2026-08-17' }),
                    point({ date: '2026-08-18' }),
                ]}
            />,
        );

        expect(bars(container).map((bar) => bar.style.height)).toEqual([
            '0%',
            '0%',
        ]);
    });

    it('leaves a zero day to the floor class inside a series with a peak', () => {
        const { container } = render(
            <MiniBars
                points={[
                    point({ date: '2026-08-17', value: 480, isPeak: true }),
                    point({ date: '2026-08-18' }),
                ]}
            />,
        );

        expect(bars(container)[1].style.height).toBe('0%');
    });

    it('titles each bar with the label and the readable value', () => {
        const { container } = render(
            <MiniBars
                points={[
                    point({
                        date: '2026-08-17',
                        label: 'Mon 17',
                        value: 450,
                        valueLabel: '7h 30m',
                        isPeak: true,
                    }),
                ]}
            />,
        );

        expect(bars(container)[0].title).toBe('Mon 17: 7h 30m');
    });
});
