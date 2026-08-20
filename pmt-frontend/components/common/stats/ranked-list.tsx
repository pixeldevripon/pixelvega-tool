'use client';

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
 */
export function RankedList({
    list,
    showAvatars = false,
}: {
    list: DashboardRankedList;
    showAvatars?: boolean;
}) {
    return (
        <Card className='flex flex-col'>
            <CardHeader className='pb-3'>
                <CardTitle className='text-base'>{list.label}</CardTitle>
                <p className='text-xs text-content-subtle'>{list.caption}</p>
            </CardHeader>

            <div className='flex flex-col gap-1 px-6 pb-6'>
                {list.rows.length === 0 ? (
                    <p className='py-4 text-sm text-content-subtle'>
                        No hours logged in this window.
                    </p>
                ) : (
                    list.rows.map((row) => (
                        <div key={row.id} className='relative py-2'>
                            {/* The bar sits behind the text rather than beside
                                it, so a long project name is not squeezed into
                                half the card. */}
                            <div
                                aria-hidden
                                className='absolute inset-y-1 left-0 rounded-sm bg-primary-subtle'
                                style={{ width: `${row.share * 100}%` }}
                            />
                            <div className='relative flex items-center gap-2.5'>
                                {showAvatars && (
                                    <Avatar className='size-7 shrink-0'>
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
                                )}
                                <div className='min-w-0 flex-1'>
                                    <p className='truncate text-sm font-medium text-content'>
                                        {row.name}
                                    </p>
                                    {row.subtitle && (
                                        <p className='truncate text-xs text-content-subtle'>
                                            {row.subtitle}
                                        </p>
                                    )}
                                </div>
                                <span className='shrink-0 text-sm font-medium tabular-nums text-content'>
                                    {row.valueLabel}
                                </span>
                                {row.changeLabel && (
                                    <span
                                        className={cn(
                                            'w-12 shrink-0 text-right text-xs tabular-nums',
                                            (row.changeRate ?? 0) >= 0
                                                ? 'text-success-fg'
                                                : 'text-content-muted',
                                        )}>
                                        {row.changeLabel}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}
