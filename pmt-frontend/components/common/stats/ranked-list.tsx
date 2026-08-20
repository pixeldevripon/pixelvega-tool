'use client';

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
 */
export function RankedList({
    list,
    showAvatars = false,
    emptyLabel = 'No hours logged in this window.',
}: {
    list: DashboardRankedList;
    showAvatars?: boolean;
    emptyLabel?: string;
}) {
    return (
        <Card className='flex h-full flex-col gap-4'>
            <CardHeader className='gap-0'>
                <CardTitle className='text-base'>{list.label}</CardTitle>
                <p className='text-xs text-content-subtle'>{list.caption}</p>
            </CardHeader>

            <div className='flex flex-col gap-1 px-4 pb-4'>
                {list.rows.length === 0 ? (
                    <p className='px-2 py-4 text-sm text-content-subtle'>
                        {emptyLabel}
                    </p>
                ) : (
                    list.rows.map((row, index) => (
                        <div
                            key={row.id}
                            className='relative overflow-hidden rounded-md px-2 py-2'>
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
                                    <Avatar className='size-8 shrink-0'>
                                        {row.avatarUrl && (
                                            <AvatarImage
                                                src={row.avatarUrl}
                                                alt=''
                                            />
                                        )}
                                        <AvatarFallback className='text-2xs'>
                                            {row.name.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                ) : (
                                    <span
                                        aria-hidden
                                        className='inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-inset font-heading text-xs font-medium tabular-nums text-content-muted'>
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
                                    )}>
                                    {row.valueLabel}
                                </span>
                                <DeltaPill
                                    changeLabel={row.changeLabel}
                                    changeRate={row.changeRate}
                                    tone={row.tone}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}
