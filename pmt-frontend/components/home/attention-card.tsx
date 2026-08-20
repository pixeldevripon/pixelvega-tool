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
import { cn } from '@/lib/utils';
import { useDeepLink } from '@/hooks/use-deep-link';
import type {
    DashboardAttention,
    DashboardAttentionItem,
} from '@/types/dashboard';

/**
 * The queues waiting on somebody.
 *
 * ── What this component does not decide ──
 *
 * It used to declare all six rows itself, filter out the empty ones, and pick
 * which one was red. Every part of that was a judgment about the business: which
 * queues concern this caller, whether an empty one is worth a line, and whether
 * a project past its deadline outranks one sitting in review. All three now
 * arrive on `attention.items`, already filtered and already ordered, and this
 * renders the array as it came.
 *
 * The one map left is presentation, keyed on the item's stable `key` exactly as a
 * class is keyed on a tone: which glyph a queue gets. It invents no wording and
 * makes no severity judgment. An unknown key still renders, with a generic inbox
 * glyph and no link, because a client must never break on an API that moved
 * forward.
 *
 * ── Where a row links to is no longer decided here ──
 *
 * There WAS a second map, from key to href, and three of its six entries pointed
 * at routes that do not exist: `/requirements`, `/reviews` and
 * `/client-feedback`. Half of this card was 404s. Destinations now come from
 * `lib/config/deep-links.ts`, which knows both whether a screen is built and
 * whether this caller may reach it, so an unbuilt or forbidden destination
 * renders as plain text carrying the same number.
 */

const ICON: Record<string, IconSvgElement> = {
    overdueProjects: AlarmClockIcon,
    pendingRequirements: Task01Icon,
    pendingLeaveRequests: CalendarCheckIn01Icon,
    notReadyToStart: Rocket01Icon,
    internalReview: SearchVisualIcon,
    awaitingClientFeedback: Comment01Icon,
};

export function AttentionCard({
    attention,
    className,
}: {
    attention: DashboardAttention;
    className?: string;
}) {
    return (
        <Card size='sm' className={cn('flex flex-col gap-3', className)}>
            <CardHeader className='gap-0'>
                <CardTitle className='text-sm'>Needs attention</CardTitle>
                <p className='text-2xs text-content-subtle'>
                    {attention.totalLabel}
                </p>
            </CardHeader>

            <div className='flex flex-col gap-0.5 px-3 pb-3'>
                {attention.items.length === 0 ? (
                    <p className='px-2 py-4 text-sm text-content-muted'>
                        Nothing is waiting on anyone.
                    </p>
                ) : (
                    attention.items.map((item) => (
                        <AttentionRow key={item.key} item={item} />
                    ))
                )}
            </div>
        </Card>
    );
}

/**
 * One queue.
 *
 * Its own component because `useDeepLink` is a hook, and a hook cannot be called
 * from inside a `.map` callback in the parent.
 */
function AttentionRow({ item }: { item: DashboardAttentionItem }) {
    const href = useDeepLink(item.key);

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
        'group/row flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm';

    // No href still renders the number. It is simply not a link, because either
    // this build does not know where that queue lives, its screen is not written
    // yet, or this caller may not open it.
    if (!href) {
        return (
            <div title={item.tone.label} className={shell}>
                {body}
            </div>
        );
    }

    return (
        <Link
            href={href}
            title={item.tone.label}
            className={`${shell} transition-colors hover:bg-surface-raised`}>
            {body}
        </Link>
    );
}
