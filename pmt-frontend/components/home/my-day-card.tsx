'use client';

import {
    AlertDiamondIcon,
    Note04Icon,
    Timer01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { EnumBadge } from '@/components/common/enum-badge';
import { IconTile } from '@/components/common/stats/icon-tile';
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
 *
 * ── The personal sparkline is gone ──
 *
 * `myHoursTrend` still arrives and is still the honest per-person series (it is
 * the one place `dailyTarget` means anything), but a strip of bars here was a
 * third chart on a page whose widest card is already the team's hours. Dropping
 * it is what let this card match the two beside it: at 433 pixels it was the
 * tallest thing in its row and held both of them open with a hole in each. Every
 * figure it summarised is still here as a number.
 *
 * ── The week bar clips, it does not clamp ──
 *
 * `weekProgressRate` is uncapped: sixty hours into a forty eight hour week reads
 * as 125%, and that is the point. The bar's track is `overflow-hidden`, so the
 * overflow is the browser's problem and the number keeps its meaning. This used
 * to be a `Math.min(1, minutes / target)` here, which threw the fact away and
 * put a second copy of the target arithmetic in a component.
 */
export function MyDayCard({ myDay }: { myDay: DashboardMyDay }) {
    return (
        <Card size='sm' className='flex flex-col gap-3'>
            <CardHeader className='gap-0'>
                <CardTitle className='text-sm'>My day</CardTitle>
                <p className='text-xs text-content-subtle'>
                    Against a {myDay.weekTargetLabel} week
                </p>
            </CardHeader>

            <div className='flex flex-1 flex-col gap-3 px-4 pb-4'>
                {myDay.activeTimer ? (
                    <div className='flex items-center gap-2.5 rounded-md border border-primary/40 bg-primary-subtle px-3 py-2.5'>
                        <HugeiconsIcon
                            aria-hidden
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
                    <div className='rounded-md bg-surface-raised px-3 py-2.5'>
                        <p className='text-2xs text-content-subtle'>Today</p>
                        <p className='mt-0.5 font-heading text-lg font-medium tabular-nums text-content'>
                            {myDay.today.label}
                        </p>
                    </div>
                    <div className='rounded-md bg-surface-raised px-3 py-2.5'>
                        <p className='text-2xs text-content-subtle'>
                            This week
                        </p>
                        <p className='mt-0.5 font-heading text-lg font-medium tabular-nums text-content'>
                            {myDay.thisWeek.label}
                        </p>
                    </div>
                </div>

                {/* No bar at all when the rate is null. Null says there is no
                    target to measure against, and an empty track would claim a
                    measured result of nothing, which is the one thing a rate
                    field is careful never to say. */}
                {myDay.weekProgressRate !== null && (
                    <div className='flex flex-col gap-1.5'>
                        <div className='flex items-baseline justify-between text-2xs'>
                            <span className='text-content-subtle'>
                                Week progress
                            </span>
                            <span className='font-medium tabular-nums text-content-muted'>
                                {myDay.weekProgressLabel}
                            </span>
                        </div>
                        <div className='h-1.5 overflow-hidden rounded-full bg-surface-inset'>
                            <div
                                className='h-full rounded-full bg-primary'
                                style={{
                                    width: `${myDay.weekProgressRate * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className='mt-auto flex flex-col gap-2 border-t border-line pt-3'>
                    <div className='flex items-center gap-2.5 text-sm'>
                        <IconTile icon={Note04Icon} size='sm' />
                        <span className='min-w-0 flex-1 truncate text-content-muted'>
                            Today’s standup
                        </span>
                        {myDay.todayWorkReportStatus ? (
                            <EnumBadge
                                display={myDay.todayWorkReportStatus}
                            />
                        ) : (
                            <span className='text-xs text-content-subtle'>
                                Not started
                            </span>
                        )}
                    </div>

                    {myDay.myOpenBlockerCount > 0 && (
                        <div className='flex items-center gap-2.5 text-sm'>
                            <IconTile
                                icon={AlertDiamondIcon}
                                tone='danger'
                                size='sm'
                            />
                            <span className='min-w-0 flex-1 truncate text-content-muted'>
                                My blockers
                            </span>
                            <span className='font-heading font-medium tabular-nums text-danger-fg'>
                                {myDay.myOpenBlockerCount}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
