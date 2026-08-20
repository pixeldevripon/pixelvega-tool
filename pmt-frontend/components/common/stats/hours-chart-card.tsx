'use client';

import {
    Bar,
    BarChart,
    CartesianGrid,
    ReferenceLine,
    XAxis,
} from 'recharts';

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardSeries } from '@/types/dashboard';

/**
 * The big chart: hours logged per day.
 *
 * Bars rather than a line, because the underlying quantity is a total per day
 * and a line implies a continuous value moving between the points. It also means
 * a zero day reads as an absent bar rather than as a dip in a trend.
 *
 * The daily target is a reference line rather than a second series: it is a
 * constant, and drawing it as data would invite reading it as something measured.
 *
 * Every value and label is on the point. The chart formats nothing.
 */

const config = {
    value: { label: 'Hours', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

export function HoursChartCard({ series }: { series: DashboardSeries }) {
    return (
        <Card className='flex flex-col'>
            <CardHeader className='pb-2'>
                <div className='flex items-baseline justify-between gap-3'>
                    <div>
                        <CardTitle className='text-base'>
                            {series.label}
                        </CardTitle>
                        <p className='text-xs text-content-subtle'>
                            Per day, against an {(series.dailyTarget ?? 0) / 60}
                            h target
                        </p>
                    </div>
                    <p className='text-2xl font-medium tabular-nums text-content'>
                        {series.totalLabel}
                    </p>
                </div>
            </CardHeader>

            <div className='px-4 pb-4'>
                <ChartContainer config={config} className='h-56 w-full'>
                    <BarChart data={series.points} margin={{ top: 8 }}>
                        <CartesianGrid
                            vertical={false}
                            stroke='var(--color-line)'
                        />
                        <XAxis
                            dataKey='label'
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={11}
                            // Every other tick: fourteen labels do not fit and
                            // rotating them costs more legibility than it buys.
                            interval={1}
                        />
                        {series.dailyTarget !== null && (
                            <ReferenceLine
                                y={series.dailyTarget}
                                stroke='var(--color-content-subtle)'
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
                                            item?.payload as {
                                                valueLabel?: string;
                                            }
                                        )?.valueLabel ?? ''
                                    }
                                />
                            }
                        />
                        <Bar
                            dataKey='value'
                            fill='var(--color-chart-1)'
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                </ChartContainer>
            </div>
        </Card>
    );
}
