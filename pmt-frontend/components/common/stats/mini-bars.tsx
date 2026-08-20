'use client';

import { cn } from '@/lib/utils';
import type { DashboardSeriesPoint } from '@/types/dashboard';

/**
 * A bar strip, for the floor of a stat tile.
 *
 * Deliberately not a charting library: a dozen divs cost nothing and a tile does
 * not need axes, a tooltip or a legend. The full chart card uses recharts.
 *
 * ── Heights are relative to the peak, and the peak is a field ──
 *
 * `isPeak` arrives on the point. This used to scan for its own `Math.max`, which
 * meant the strip and the full chart could disagree about which day was busiest
 * whenever two days tied. WHICH day is busiest is the server's answer; turning a
 * value into a height against it is geometry, and geometry is this file's job.
 *
 * The weekly off day is drawn faintly rather than omitted: a gap would imply a
 * missing day.
 */
export function MiniBars({
    points,
    className,
}: {
    points: DashboardSeriesPoint[];
    className?: string;
}) {
    const peak = points.find((point) => point.isPeak);

    return (
        <div className={cn('flex h-10 items-end gap-px', className)}>
            {points.map((point) => (
                <div
                    key={point.date}
                    title={`${point.label}: ${point.valueLabel}`}
                    className={cn(
                        // `min-h-0.5` is the floor that keeps a zero day a
                        // visible slot rather than nothing at all. A class
                        // rather than a `max()` in the style, because the floor
                        // is a constant and only the ratio is data.
                        'min-h-0.5 flex-1 rounded-t-sm transition-colors',
                        point.isPeak
                            ? 'bg-primary'
                            : point.isWorkingDay
                              ? 'bg-primary/35'
                              : 'bg-line',
                    )}
                    style={{
                        // No peak means an all-zero series, which draws as a
                        // flat row of floors.
                        height: peak
                            ? `${(point.value / peak.value) * 100}%`
                            : '0%',
                    }}
                />
            ))}
        </div>
    );
}
