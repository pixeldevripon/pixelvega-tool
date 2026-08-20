'use client';

import Link from 'next/link';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardAttention } from '@/types/dashboard';

/**
 * The queues waiting on somebody.
 *
 * A row is hidden when its count is zero: a list of noughts is noise on a screen
 * whose job is to say what needs doing. A row is also hidden when its count is
 * NULL, which is different: null means the caller may not act on it, and the
 * pending leave count is null for anyone who cannot approve one. Showing it would
 * offer work they cannot do.
 */
export function AttentionCard({
    attention,
}: {
    attention: DashboardAttention;
}) {
    const rows: {
        label: string;
        count: number | null;
        href: string;
        urgent?: boolean;
    }[] = [
        {
            label: 'Overdue projects',
            count: attention.overdueProjectCount,
            href: '/projects?overdue=true',
            urgent: true,
        },
        {
            label: 'Requirements to review',
            count: attention.pendingRequirementCount,
            href: '/requirements',
        },
        {
            label: 'In internal review',
            count: attention.internalReviewCount,
            href: '/reviews',
        },
        {
            label: 'Awaiting client feedback',
            count: attention.awaitingClientFeedbackCount,
            href: '/client-feedback',
        },
        {
            label: 'Not ready to start',
            count: attention.notReadyToStartCount,
            href: '/projects?status=PLANNING',
        },
        {
            label: 'Leave to approve',
            count: attention.pendingLeaveRequestCount,
            href: '/leave',
        },
    ];

    const visible = rows.filter((row) => row.count !== null && row.count > 0);

    return (
        <Card className='flex flex-col'>
            <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Needs attention</CardTitle>
            </CardHeader>

            <div className='flex flex-col px-6 pb-6'>
                {visible.length === 0 ? (
                    <p className='text-sm text-content-muted'>
                        Nothing is waiting on anyone.
                    </p>
                ) : (
                    visible.map((row) => (
                        <Link
                            key={row.label}
                            href={row.href}
                            className='flex items-center justify-between gap-2 border-b border-line py-2.5 text-sm last:border-b-0 hover:text-primary'>
                            <span className='text-content-muted'>
                                {row.label}
                            </span>
                            <span
                                className={cn(
                                    'font-medium tabular-nums',
                                    row.urgent
                                        ? 'text-danger-fg'
                                        : 'text-content',
                                )}>
                                {row.count}
                            </span>
                        </Link>
                    ))
                )}
            </div>
        </Card>
    );
}
