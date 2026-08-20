'use client';

import Link from 'next/link';

import { DeltaPill } from '@/components/common/stats/delta-pill';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardRankedList } from '@/types/dashboard';

/**
 * A "top N by X" card.
 *
 * `share` decides the bar width and arrives on the row, so every client draws
 * the same bar. Computing it here from a value and a total would round
 * differently in each consumer.
 *
 * The rank number is the row's POSITION IN THE ARRAY, which is not a derivation:
 * the response is documented as already ordered, so this renders the order it
 * was given. Sorting it here is what would be wrong.
 *
 * ── `rowHref` is supplied by the caller ──
 *
 * A row is a project or a person depending on the list, and only the caller
 * knows which. Neither has a detail screen yet, so what it points at today is
 * the list filtered to that one record; returning null leaves the row as plain
 * text.
 */
export function RankedList({
    list,
    showAvatars = false,
    rowHref,
    emptyLabel = 'No hours logged in this window.',
    className,
}: {
    list: DashboardRankedList;
    showAvatars?: boolean;
    /** Where a row goes. Return null to leave that row unlinked. */
    rowHref?: (row: DashboardRankedList['rows'][number]) => string | null;
    emptyLabel?: string;
    className?: string;
}) {
    return (
        <Card size='sm' className={cn('flex flex-col gap-3', className)}>
            <CardHeader className='gap-0'>
                <CardTitle className='text-sm'>{list.label}</CardTitle>
                <p className='text-xs text-content-subtle'>{list.caption}</p>
            </CardHeader>

            <div className='flex flex-col gap-0.5 px-3 pb-3'>
                {list.rows.length === 0 ? (
                    <p className='px-2 py-4 text-sm text-content-subtle'>
                        {emptyLabel}
                    </p>
                ) : (
                    list.rows.map((row, index) => {
                        const href = rowHref?.(row);
                        const shell =
                            'relative block overflow-hidden rounded-md px-2 py-1.5';
                        const body = (
                            <>
                                {/* The bar sits behind the text rather than beside
                                it, so a long project name is not squeezed into
                                half the card. */}
                                <div
                                    aria-hidden
                                    className='absolute inset-y-0 left-0 bg-primary-subtle'
                                    style={{ width: `${row.share * 100}%` }}
                                />
                                <div className='relative flex items-center gap-2.5'>
                                    {showAvatars ? (
                                        <Avatar className='size-7 shrink-0'>
                                            {row.avatarUrl && (
                                                <AvatarImage
                                                    src={row.avatarUrl}
                                                    alt=''
                                                />
                                            )}
                                            <AvatarFallback className='text-2xs'>
                                                {row.name
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <span
                                            aria-hidden
                                            className='inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-inset font-heading text-2xs font-medium tabular-nums text-content-muted'
                                        >
                                            {index + 1}
                                        </span>
                                    )}
                                    <div className='min-w-0 flex-1'>
                                        <p className='truncate text-sm font-medium text-content'>
                                            {row.name}
                                        </p>
                                        {row.subtitle && (
                                            <p className='truncate text-2xs text-content-subtle'>
                                                {row.subtitle}
                                            </p>
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            'shrink-0 text-sm font-medium tabular-nums text-content',
                                        )}
                                    >
                                        {row.valueLabel}
                                    </span>
                                    <DeltaPill
                                        changeLabel={row.changeLabel}
                                        changeRate={row.changeRate}
                                        tone={row.tone}
                                    />
                                </div>
                            </>
                        );

                        return href ? (
                            <Link
                                key={row.id}
                                href={href}
                                className={`${shell} transition-colors hover:bg-surface-raised`}
                            >
                                {body}
                            </Link>
                        ) : (
                            <div key={row.id} className={shell}>
                                {body}
                            </div>
                        );
                    })
                )}
            </div>
        </Card>
    );
}
