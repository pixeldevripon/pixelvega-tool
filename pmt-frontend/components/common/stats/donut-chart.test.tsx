import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DonutChart, type DonutSlice } from './donut-chart';

const slice = (overrides: Partial<DonutSlice> & { value: string }): DonutSlice => ({
    label: 'In progress',
    tone: 'primary',
    share: 0.5,
    detail: '6 (50%)',
    ...overrides,
});

describe('DonutChart', () => {
    it('renders the centre figure it was given, not a sum of the slices', () => {
        // The server sends the total alongside the shares precisely so the
        // middle and the ring cannot disagree when a zero-count key is omitted.
        render(
            <DonutChart
                slices={[
                    slice({ value: 'IN_PROGRESS', share: 0.6 }),
                    slice({
                        value: 'COMPLETED',
                        label: 'Completed',
                        tone: 'success',
                        share: 0.4,
                    }),
                ]}
                centreValue='14'
            />,
        );

        expect(screen.getByText('14')).toBeInTheDocument();
    });

    it('renders the centre caption when there is one', () => {
        render(
            <DonutChart
                slices={[slice({ value: 'IN_PROGRESS' })]}
                centreValue='14'
                centreCaption='in total'
            />,
        );

        expect(screen.getByText('in total')).toBeInTheDocument();
    });

    it('omits the caption when there is none', () => {
        render(
            <DonutChart
                slices={[slice({ value: 'IN_PROGRESS' })]}
                centreValue='14'
            />,
        );

        expect(screen.queryByText('in total')).not.toBeInTheDocument();
    });

    it('still labels a track slice for a screen reader', () => {
        // happy-dom has no layout engine, so recharts draws no slice paths and
        // the FILL cannot be asserted here: `tone-palette.test.ts` pins that
        // instead. What this component owns either way is the label.
        render(
            <DonutChart
                slices={[
                    slice({ value: 'submitted', label: 'Filed', detail: '0 filed' }),
                    slice({
                        value: 'outstanding',
                        label: 'Outstanding',
                        tone: 'default',
                        detail: 'Not filed yet',
                        isTrack: true,
                    }),
                ]}
                centreValue='0%'
            />,
        );

        expect(
            screen.getByRole('img', {
                name: 'Filed: 0 filed, Outstanding: Not filed yet',
            }),
        ).toBeInTheDocument();
    });

    it('spells the slices out for a screen reader', () => {
        // A ring conveys nothing without this, and the legend beside it is not
        // always rendered.
        render(
            <DonutChart
                slices={[
                    slice({ value: 'IN_PROGRESS', detail: '6 (60%)' }),
                    slice({
                        value: 'COMPLETED',
                        label: 'Completed',
                        detail: '4 (40%)',
                    }),
                ]}
                centreValue='10'
            />,
        );

        expect(
            screen.getByRole('img', {
                name: 'In progress: 6 (60%), Completed: 4 (40%)',
            }),
        ).toBeInTheDocument();
    });
});
