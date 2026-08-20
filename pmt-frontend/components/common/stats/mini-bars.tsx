'use client';

import { cn } from '@/lib/utils';
import type { DashboardSeriesPoint } from '@/types/dashboard';

/**
 * A bar strip, for the bottom of a stat tile.
 *
 * Deliberately not a charting library: a dozen divs cost nothing and a tile does
 * not need axes, a tooltip or a legend. The full chart card uses recharts.
 *
 * Heights are a share of the largest bar rather than of a target, so a quiet
 * fortnight still shows its own shape instead of a flat line. The weekly off day
 * is drawn faintly rather than omitted, because a gap would imply a missing day.
 */
export function MiniBars({
    points,
    className,
}: {
    points: DashboardSeriesPoint[];
    className?: string;
}) {
    const peak = Math.max(...points.map((point) => point.value), 1);

    return (
        <div className={cn('flex h-10 items-end gap-0.5', className)}>
            {points.map((point) => (
                <div
                    key={point.date}
                    title={`${point.label}: ${point.valueLabel}`}
                    className={cn(
                        'flex-1 rounded-sm',
                        point.isWorkingDay
                            ? 'bg-primary/70'
                            : 'bg-line',
                    )}
                    style={{
                        // A floor of 2px so a zero day is still a visible slot
                        // rather than nothing at all.
                        height: `${Math.max(2, (point.value / peak) * 100)}%`,
                    }}
                />
            ))}
        </div>
    );
}
