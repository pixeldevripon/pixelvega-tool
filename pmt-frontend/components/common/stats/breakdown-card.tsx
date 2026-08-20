'use client';

import {
    DonutChart,
    type DonutSlice,
} from '@/components/common/stats/donut-chart';
import { toneSwatch } from '@/components/common/stats/tone-palette';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardBreakdown } from '@/types/dashboard';

/**
 * A breakdown, as a ring with its rows beside it.
 *
 * `share` comes from the response, so the ring always closes on the same 100%. A
 * client dividing counts by a total it also received would round differently
 * from every other client and leave a hairline gap.
 *
 * The centre carries `totalLabel`, which is a field for the same reason: a
 * component summing the slices it was given would disagree with the server the
 * moment a zero-count key was omitted from the array, which is exactly what the
 * API does.
 *
 * The rows ARE the legend, and they hold the numbers too, which is what makes
 * the ring readable at this size without a separate key.
 *
 * `variant='bar'` keeps the older stacked bar for a card too short for a ring.
 * Both read the same fields; neither computes.
 */
export function BreakdownCard({
    breakdown,
    variant = 'donut',
    className,
}: {
    breakdown: DashboardBreakdown;
    variant?: 'donut' | 'bar';
    className?: string;
}) {
    const slices: DonutSlice[] = breakdown.slices.map((slice) => ({
        value: slice.key.value,
        label: slice.key.label,
        tone: slice.key.tone,
        share: slice.share,
        detail: `${slice.count} (${slice.shareLabel})`,
    }));

    return (
        <Card className={cn('flex h-full flex-col gap-4', className)}>
            <CardHeader className='gap-0'>
                <CardTitle className='text-base'>{breakdown.label}</CardTitle>
                <p className='text-xs text-content-subtle'>
                    {breakdown.totalLabel}
                </p>
            </CardHeader>

            <div className='flex flex-1 flex-col gap-4 px-6 pb-6'>
                {slices.length === 0 ? (
                    <p className='text-sm text-content-subtle'>
                        Nothing to show yet.
                    </p>
                ) : (
                    <>
                        {variant === 'donut' ? (
                            <div className='flex justify-center'>
                                <DonutChart
                                    slices={slices}
                                    centreValue={String(breakdown.total)}
                                    centreCaption='in total'
                                />
                            </div>
                        ) : (
                            <div
                                className='flex h-2 gap-0.5 overflow-hidden rounded-full'
                                role='img'
                                aria-label={slices
                                    .map(
                                        (slice) =>
                                            `${slice.label}: ${slice.detail}`,
                                    )
                                    .join(', ')}>
                                {slices.map((slice) => (
                                    <div
                                        key={slice.value}
                                        className={toneSwatch(slice.tone)}
                                        style={{
                                            width: `${slice.share * 100}%`,
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className='flex flex-col gap-2'>
                            {breakdown.slices.map((slice) => (
                                <div
                                    key={slice.key.value}
                                    className='flex items-center gap-2 text-sm'>
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-2 shrink-0 rounded-full',
                                            toneSwatch(slice.key.tone),
                                        )}
                                    />
                                    <span className='min-w-0 flex-1 truncate text-content-muted'>
                                        {slice.key.label}
                                    </span>
                                    <span className='shrink-0 font-medium tabular-nums text-content'>
                                        {slice.count}
                                    </span>
                                    <span className='w-10 shrink-0 text-right text-xs tabular-nums text-content-subtle'>
                                        {slice.shareLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}
