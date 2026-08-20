'use client';

import { Cell, Pie, PieChart } from 'recharts';

import {
    toneFill,
    TRACK_FILL,
} from '@/components/common/stats/tone-palette';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

/**
 * A ring with a figure in the middle.
 *
 * The centre value is a FIELD, never a sum of the slices: the server sends the
 * total alongside the shares precisely so the middle and the ring can never
 * disagree, which they would the moment one slice was filtered out of the array.
 *
 * Slice angles come from `share`. Recharts would happily divide the values
 * itself, and it would round differently from every other consumer of the same
 * response, so the pre-decided share is what is handed to it.
 *
 * The ring is `role="img"` with the slices spelled out in its label: a donut
 * conveys nothing to a screen reader, and the legend beside it is not always
 * rendered.
 */

export type DonutSlice = {
    /** Stable, and the React key. */
    value: string;
    label: string;
    tone: string;
    /** Already decided by the server. Never a count divided by a total. */
    share: number;
    /** What the tooltip should read. */
    detail: string;
    /**
     * The unmeasured rest of a gauge, drawn as a plain track.
     *
     * Only a gauge needs this. A breakdown's slices are all measured, and giving
     * one of them the track would claim it means nothing.
     */
    isTrack?: boolean;
};

const config = {
    share: { label: 'Share' },
} satisfies ChartConfig;

export function DonutChart({
    slices,
    centreValue,
    centreCaption,
    className,
}: {
    slices: DonutSlice[];
    centreValue: string;
    centreCaption?: string;
    className?: string;
}) {
    return (
        <div className={cn('relative', className)}>
            <ChartContainer
                config={config}
                role='img'
                aria-label={slices
                    .map((slice) => `${slice.label}: ${slice.detail}`)
                    .join(', ')}
                className='aspect-square h-40 w-40'>
                <PieChart>
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                hideLabel
                                formatter={(_value, _name, item) =>
                                    (item?.payload as DonutSlice | undefined)
                                        ?.detail ?? ''
                                }
                            />
                        }
                    />
                    <Pie
                        data={slices}
                        dataKey='share'
                        nameKey='label'
                        // A ring rather than a pie, so the centre can carry the
                        // total. `paddingAngle` keeps two adjacent slices of the
                        // same tone from reading as one.
                        innerRadius='68%'
                        outerRadius='100%'
                        paddingAngle={slices.length > 1 ? 2 : 0}
                        strokeWidth={0}
                        // Clockwise from twelve o'clock, which is how the
                        // declared order reads.
                        startAngle={90}
                        endAngle={-270}>
                        {slices.map((slice) => (
                            <Cell
                                key={slice.value}
                                fill={
                                    slice.isTrack
                                        ? TRACK_FILL
                                        : toneFill(slice.tone)
                                }
                            />
                        ))}
                    </Pie>
                </PieChart>
            </ChartContainer>

            {/* Absolutely placed rather than an SVG label, so it inherits the
                page's type scale instead of recharts' font handling. */}
            <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5'>
                <span className='font-heading text-xl font-medium tabular-nums text-content'>
                    {centreValue}
                </span>
                {centreCaption && (
                    <span className='text-2xs text-content-subtle'>
                        {centreCaption}
                    </span>
                )}
            </div>
        </div>
    );
}
