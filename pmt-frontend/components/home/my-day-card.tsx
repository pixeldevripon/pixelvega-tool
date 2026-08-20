'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Timer01Icon } from '@hugeicons/core-free-icons';

import { EnumBadge } from '@/components/common/enum-badge';
import { MiniBars } from '@/components/common/stats/mini-bars';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardMyDay } from '@/types/dashboard';

/**
 * The caller's own day: their timer, their hours, their standup, their blockers.
 *
 * Rendered only when the response includes it, which is when the caller actually
 * holds `TRACK_PROJECT_TIME`. A project manager gets no block at all rather than
 * an empty one, because an empty timer card implies a control they do not have.
 *
 * `elapsedMinutes` is a server figure and this renders it as given. Counting up
 * live would mean the browser's clock deciding how long someone has worked.
 */
export function MyDayCard({ myDay }: { myDay: DashboardMyDay }) {
    const weekShare =
        myDay.weekTargetMinutes > 0
            ? Math.min(1, myDay.thisWeek.minutes / myDay.weekTargetMinutes)
            : 0;

    return (
        <Card className='flex flex-col'>
            <CardHeader className='pb-3'>
                <CardTitle className='text-base'>My day</CardTitle>
            </CardHeader>

            <div className='flex flex-col gap-4 px-6 pb-6'>
                {myDay.activeTimer ? (
                    <div className='flex items-center gap-2.5 rounded-md border border-primary/40 bg-primary-subtle px-3 py-2.5'>
                        <HugeiconsIcon
                            icon={Timer01Icon}
                            className='size-4 shrink-0 text-primary-subtle-content'
                            strokeWidth={1.75}
                        />
                        <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-medium text-primary-subtle-content'>
                                {myDay.activeTimer.projectName ??
                                    'Meeting time'}
                            </p>
                            <p className='text-xs text-primary-subtle-content/80'>
                                {myDay.activeTimer.status.label} ·{' '}
                                {myDay.activeTimer.elapsedLabel}
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className='rounded-md bg-surface-raised px-3 py-2.5 text-sm text-content-muted'>
                        No timer running.
                    </p>
                )}

                <div className='grid grid-cols-2 gap-3'>
                    <div>
                        <p className='text-xs text-content-subtle'>Today</p>
                        <p className='text-lg font-medium tabular-nums text-content'>
                            {myDay.today.label}
                        </p>
                    </div>
                    <div>
                        <p className='text-xs text-content-subtle'>This week</p>
                        <p className='text-lg font-medium tabular-nums text-content'>
                            {myDay.thisWeek.label}
                        </p>
                    </div>
                </div>

                <div className='flex flex-col gap-1'>
                    <div className='h-1.5 overflow-hidden rounded-full bg-surface-inset'>
                        <div
                            className='h-full rounded-full bg-primary'
                            style={{ width: `${weekShare * 100}%` }}
                        />
                    </div>
                    <p className='text-2xs text-content-subtle'>
                        Against a {myDay.weekTargetMinutes / 60}h week
                    </p>
                </div>

                <MiniBars points={myDay.myHoursTrend.points} />

                <div className='flex items-center justify-between gap-2 border-t border-line pt-3 text-sm'>
                    <span className='text-content-muted'>Today’s standup</span>
                    {myDay.todayWorkReportStatus ? (
                        <EnumBadge display={myDay.todayWorkReportStatus} />
                    ) : (
                        <span className='text-xs text-content-subtle'>
                            Not started
                        </span>
                    )}
                </div>

                {myDay.myOpenBlockerCount > 0 && (
                    <div className='flex items-center justify-between gap-2 text-sm'>
                        <span className='text-content-muted'>My blockers</span>
                        <span className='font-medium tabular-nums text-danger-fg'>
                            {myDay.myOpenBlockerCount}
                        </span>
                    </div>
                )}
            </div>
        </Card>
    );
}
