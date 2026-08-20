'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { toneToVariant } from '@/components/common/enum-badge';
import { cn } from '@/lib/utils';
import type { DashboardBreakdown } from '@/types/dashboard';

/**
 * A segmented bar with its rows underneath.
 *
 * `share` comes from the response, so the segments always sum to the same 100%.
 * A client dividing counts by a total it also received would round differently
 * from every other client and the bar would not quite fill.
 *
 * A stacked bar rather than a donut: at this size a donut needs a legend to be
 * readable, and the legend then carries the information the chart was supposed
 * to. The rows below ARE the legend, and they hold the numbers too.
 */

const SEGMENT_CLASS: Record<string, string> = {
    neutral: 'bg-content-subtle',
    info: 'bg-primary',
    success: 'bg-success-solid',
    warning: 'bg-warning-solid',
    danger: 'bg-danger-solid',
};

export function BreakdownCard({
    breakdown,
    className,
}: {
    breakdown: DashboardBreakdown;
    className?: string;
}) {
    return (
        <Card className={cn('flex flex-col', className)}>
            <CardHeader className='pb-3'>
                <CardTitle className='text-base'>{breakdown.label}</CardTitle>
                <p className='text-2xl font-medium tabular-nums text-content'>
                    {breakdown.totalLabel}
                </p>
            </CardHeader>

            <div className='flex flex-col gap-3 px-6 pb-6'>
                {breakdown.slices.length === 0 ? (
                    <p className='text-sm text-content-subtle'>
                        Nothing to show yet.
                    </p>
                ) : (
                    <>
                        <div
                            className='flex h-2 gap-0.5 overflow-hidden rounded-full'
                            role='img'
                            aria-label={breakdown.slices
                                .map(
                                    (slice) =>
                                        `${slice.key.label}: ${slice.count}`,
                                )
                                .join(', ')}>
                            {breakdown.slices.map((slice) => (
                                <div
                                    key={slice.key.value}
                                    className={cn(
                                        SEGMENT_CLASS[
                                            toneToVariant(slice.key.tone)
                                        ] ?? SEGMENT_CLASS.neutral,
                                    )}
                                    style={{ width: `${slice.share * 100}%` }}
                                />
                            ))}
                        </div>

                        <div className='flex flex-col gap-1.5'>
                            {breakdown.slices.map((slice) => (
                                <div
                                    key={slice.key.value}
                                    className='flex items-center gap-2 text-sm'>
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-2 shrink-0 rounded-full',
                                            SEGMENT_CLASS[
                                                toneToVariant(slice.key.tone)
                                            ] ?? SEGMENT_CLASS.neutral,
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
