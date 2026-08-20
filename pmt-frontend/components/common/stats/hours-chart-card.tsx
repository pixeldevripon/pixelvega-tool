'use client';

import { Bar, BarChart, Cell, LabelList, ReferenceLine, XAxis } from 'recharts';

import { IconTile } from '@/components/common/stats/icon-tile';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { ChartLineData01Icon } from '@hugeicons/core-free-icons';
import type { DashboardSeries, DashboardSeriesPoint } from '@/types/dashboard';
import { cn } from '@/lib/utils';

/**
 * The big chart: hours logged per day.
 *
 * Bars rather than a line, because the underlying quantity is a total per day
 * and a line implies a continuous value moving between the points. It also means
 * a zero day reads as an absent bar rather than as a dip in a trend.
 *
 * ── The peak carries the label, and only the peak ──
 *
 * The reference writes a value above every bar, and that works at eight bars
 * with "52K" in each. Here a bar is a day and a value is "161h 38m", which does
 * not fit a fourteenth of the card: recharts wraps it onto two lines and the
 * result is fourteen stacked fragments over bars of near-identical height. So
 * the emphasis is kept and the noise is not: the busiest day is filled solid and
 * captioned, the rest are a pale tint, and every other value is a hover away.
 *
 * WHICH day is the peak is `isPeak` on the point, never a scan for the maximum
 * here. Two components scanning for their own would disagree whenever two days
 * tie.
 *
 * The daily target is a reference line rather than a second series: it is a
 * constant, and drawing it as data would invite reading it as something measured.
 * It is absent from the team-wide series, because an eight hour target belongs to
 * a person.
 */

const config = {
    value: { label: 'Hours', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

export function HoursChartCard({
    series,
    className,
}: {
    series: DashboardSeries;
    className?: string;
}) {
    return (
        <Card size='sm' className={cn('flex flex-col gap-3', className)}>
            <CardHeader className='gap-0'>
                <div className='flex items-start justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        <IconTile icon={ChartLineData01Icon} tone='primary' />
                        <div>
                            <CardTitle className='text-base'>
                                {series.label}
                            </CardTitle>
                            <p className='text-xs text-content-subtle'>
                                Per day, busiest called out
                                {series.dailyTarget !== null &&
                                    ', against the dashed target'}
                            </p>
                        </div>
                    </div>
                    <div className='text-right'>
                        <p className='font-heading text-2xl font-medium tracking-tight tabular-nums text-content'>
                            {series.totalLabel}
                        </p>
                        <p className='text-2xs text-content-subtle'>
                            in this window
                        </p>
                    </div>
                </div>
            </CardHeader>

            {/* Grows to fill the row, with a floor.

                `flex-1` and `h-full` are right HERE, and were wrong before only
                because of `aspect-video` below: the RATIO, not the growth, is
                what made this card 962 pixels tall. With the ratio gone, filling
                the row is what keeps this card from sitting under an empty band
                when the breakdown beside it is taller, and a chart is the one
                thing on this page that genuinely reads better with more height.

                `aspect-auto` cancels `ChartContainer`'s own `aspect-video`, and
                that is what made this card the tallest thing on the page.
                Sixteen-by-nine reads as a ratio until the card is two thirds of
                a wide screen: at 945px across it made the chart 531px tall. A
                fortnight of bars needs height for the tallest bar and its
                caption, not a share of the width. */}
            <div className='flex-1 px-2 pb-1'>
                <ChartContainer
                    config={config}
                    className='aspect-auto h-full min-h-48 w-full'>
                    <BarChart
                        data={series.points}
                        // Headroom for the peak's caption. The peak bar always
                        // reaches the top of the domain, by definition, so
                        // without this its label has nowhere to go and is
                        // clipped: it is not a quirk of one day's data.
                        margin={{ top: 32, left: 4, right: 4 }}>
                        <XAxis
                            dataKey='label'
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            fontSize={10}
                            // Every other tick: fourteen labels do not fit and
                            // rotating them costs more legibility than it buys.
                            interval={1}
                        />
                        {series.dailyTarget !== null && (
                            <ReferenceLine
                                y={series.dailyTarget}
                                stroke='var(--color-line-strong)'
                                strokeDasharray='4 4'
                            />
                        )}
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    // The point already carries its readable
                                    // form, so nothing is formatted here.
                                    formatter={(_value, _name, item) =>
                                        (
                                            item?.payload as
                                                | DashboardSeriesPoint
                                                | undefined
                                        )?.valueLabel ?? ''
                                    }
                                />
                            }
                        />
                        <Bar dataKey='value' radius={[6, 6, 0, 0]} maxBarSize={34}>
                            {series.points.map((point) => (
                                <Cell
                                    key={point.date}
                                    fill={
                                        point.isPeak
                                            ? 'var(--color-chart-1)'
                                            : 'var(--color-primary-subtle)'
                                    }
                                />
                            ))}
                            <LabelList
                                position='top'
                                offset={10}
                                fontSize={11}
                                className='fill-content font-medium'
                                // Reads the POINT rather than the rendered
                                // label, so the test is a flag and a minute
                                // count, never a string comparison against
                                // "0m". A peak of zero cannot happen (the
                                // server flags none on a flat series) but the
                                // guard costs nothing and says so.
                                valueAccessor={(entry) => {
                                    const point = entry.payload as
                                        | DashboardSeriesPoint
                                        | undefined;
                                    return point?.isPeak && point.value > 0
                                        ? point.valueLabel
                                        : '';
                                }}
                            />
                        </Bar>
                    </BarChart>
                </ChartContainer>
            </div>
        </Card>
    );
}
