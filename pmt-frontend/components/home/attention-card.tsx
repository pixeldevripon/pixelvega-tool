'use client';

import {
    AlarmClockIcon,
    ArrowRight01Icon,
    CalendarCheckIn01Icon,
    Comment01Icon,
    InboxIcon,
    Rocket01Icon,
    SearchVisualIcon,
    Task01Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { IconTile } from '@/components/common/stats/icon-tile';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardAttention } from '@/types/dashboard';

/**
 * The queues waiting on somebody.
 *
 * ── What this component no longer decides ──
 *
 * It used to declare all six rows itself, filter out the empty ones, and pick
 * which one was red. Every part of that was a judgment about the business: which
 * queues concern this caller, whether an empty one is worth a line, and whether
 * a project past its deadline outranks one sitting in review. All three now
 * arrive on `attention.items`, already filtered and already ordered, and this
 * renders the array as it came.
 *
 * The two maps left are presentation, keyed on the item's stable `key` exactly as
 * a class is keyed on a tone: which glyph a queue gets, and which screen it links
 * to. Neither invents wording and neither makes a severity judgment. An unknown
 * key still renders, with a generic inbox glyph and no link, because a client
 * must never break on an API that moved forward.
 */

const ICON: Record<string, IconSvgElement> = {
    overdueProjects: AlarmClockIcon,
    pendingRequirements: Task01Icon,
    pendingLeaveRequests: CalendarCheckIn01Icon,
    notReadyToStart: Rocket01Icon,
    internalReview: SearchVisualIcon,
    awaitingClientFeedback: Comment01Icon,
};

const HREF: Record<string, string> = {
    overdueProjects: '/projects?overdue=true',
    pendingRequirements: '/requirements',
    pendingLeaveRequests: '/leave',
    notReadyToStart: '/projects?status=PLANNING',
    internalReview: '/reviews',
    awaitingClientFeedback: '/client-feedback',
};

export function AttentionCard({
    attention,
}: {
    attention: DashboardAttention;
}) {
    return (
        <Card className='flex h-full flex-col gap-4'>
            <CardHeader className='gap-0'>
                <CardTitle className='text-base'>Needs attention</CardTitle>
                <p className='text-xs text-content-subtle'>
                    {attention.totalLabel}
                </p>
            </CardHeader>

            <div className='flex flex-col gap-1 px-4 pb-4'>
                {attention.items.length === 0 ? (
                    <p className='px-2 py-4 text-sm text-content-muted'>
                        Nothing is waiting on anyone.
                    </p>
                ) : (
                    attention.items.map((item) => {
                        const href = HREF[item.key];
                        const body = (
                            <>
                                <IconTile
                                    icon={ICON[item.key] ?? InboxIcon}
                                    tone={item.tone.tone}
                                    size='sm'
                                />
                                <span className='min-w-0 flex-1 truncate text-content-muted'>
                                    {item.label}
                                </span>
                                <span className='shrink-0 font-heading font-medium tabular-nums text-content'>
                                    {item.count}
                                </span>
                                {href && (
                                    <HugeiconsIcon
                                        aria-hidden
                                        icon={ArrowRight01Icon}
                                        className='size-4 shrink-0 text-content-subtle transition-transform group-hover/row:translate-x-0.5'
                                        strokeWidth={1.75}
                                    />
                                )}
                            </>
                        );

                        const shell =
                            'group/row flex items-center gap-2.5 rounded-md px-2 py-2 text-sm';

                        // An unknown key still renders its number. It simply is
                        // not a link, because this build does not know where a
                        // queue it has never heard of lives.
                        return href ? (
                            <Link
                                key={item.key}
                                href={href}
                                title={item.tone.label}
                                className={`${shell} transition-colors hover:bg-surface-raised`}>
                                {body}
                            </Link>
                        ) : (
                            <div
                                key={item.key}
                                title={item.tone.label}
                                className={shell}>
                                {body}
                            </div>
                        );
                    })
                )}
            </div>
        </Card>
    );
}
