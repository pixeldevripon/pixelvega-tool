'use client';

import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { useState } from 'react';


import {
    DonutChart,
    type DonutSlice,
} from '@/components/common/stats/donut-chart';
import { toneSwatch } from '@/components/common/stats/tone-palette';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { DashboardBreakdown } from '@/types/dashboard';

/**
 * A breakdown, as a ring with its rows beside it.
 *
 * `share` comes from the response, so the ring always closes on the same 100%. A
 * client dividing counts by a total it also received would round differently
 * from every other client and leave a hairline gap.
 *
 * The centre carries `totalLabel`, which is a field for the same reason: a
 * component summing the slices it was given would disagree with the server the
 * moment a zero-count key was omitted from the array, which is exactly what the
 * API does.
 *
 * The rows ARE the legend, and they hold the numbers too, which is what makes
 * the ring readable at this size without a separate key.
 *
 * `variant='bar'` keeps the older stacked bar for a card too short for a ring.
 * Both read the same fields; neither computes.
 *
 * ── `sliceHref` is supplied by the caller, not decided here ──
 *
 * A slice's row is a summary of a filtered list, so it should open that list.
 * Which list depends on what the breakdown is ABOUT, and only the caller knows
 * that: a status slice opens `/projects?status=`, a severity slice opens
 * `/blockers?severity=`. Returning null for a slice leaves that one row as plain
 * text, which is what happens when its destination is not built.
 */
/**
 * No `h-full`.
 *
 * `h-full` is `height: 100%` of the GRID AREA, and a grid row is as tall as its
 * tallest item, so these cards re-stretched themselves to the tallest sibling
 * even after the grid stopped stretching them (`items-start` on the section).
 * That is how "Needs attention" ended up holding six rows of content in four
 * hundred and thirty-three pixels. The card is now as tall as what is in it.
 */
export function BreakdownCard({
    breakdown,
    variant = 'donut',
    sliceHref,
    collapseAfter,
    className,
}: {
    breakdown: DashboardBreakdown;
    variant?: 'donut' | 'bar';
    /** Where a slice's row goes. Return null to leave that row unlinked. */
    sliceHref?: (value: string) => string | null;
    /**
     * Show this many rows, and put the rest behind a toggle. Omit to show every
     * row, which is right for a breakdown with three or four keys.
     *
     * ── Slicing a list to render it is not a D4 violation ──
     *
     * The server decided the order, the counts and the shares; this chooses how
     * many of them to PAINT, which is the same class of decision as
     * `line-clamp-2` on a description. Nothing is filtered out of the data and
     * no number changes: every row is one click away, and the ring above still
     * draws every slice.
     */
    collapseAfter?: number;
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    /**
     * The rows to paint now, and the rows behind the toggle.
     *
     * Ten statuses under a ring made this the tallest card on the page. The
     * split is presentation only: the ring below still draws every slice, so
     * the shape of the distribution is complete whether or not the list is
     * expanded.
     */
    const limit = collapseAfter ?? breakdown.slices.length;
    const visible = breakdown.slices.slice(0, limit);
    const hidden = breakdown.slices.slice(limit);

    const slices: DonutSlice[] = breakdown.slices.map((slice) => ({
        value: slice.key.value,
        label: slice.key.label,
        tone: slice.key.tone,
        share: slice.share,
        detail: `${slice.count} (${slice.shareLabel})`,
    }));

    return (
        <Card size='sm' className={cn('flex flex-col gap-3', className)}>
            <CardHeader className='gap-0'>
                <CardTitle className='text-sm'>{breakdown.label}</CardTitle>
                <p className='text-xs text-content-subtle'>
                    {breakdown.totalLabel}
                </p>
            </CardHeader>

            <div className='flex flex-1 flex-col gap-3 px-4 pb-4'>
                {slices.length === 0 ? (
                    <p className='text-sm text-content-subtle'>
                        Nothing to show yet.
                    </p>
                ) : (
                    <>
                        {variant === 'donut' ? (
                            <div className='flex justify-center'>
                                <DonutChart
                                    slices={slices}
                                    centreValue={String(breakdown.total)}
                                    centreCaption='in total'
                                />
                            </div>
                        ) : (
                            <div
                                className='flex h-2 gap-0.5 overflow-hidden rounded-full'
                                role='img'
                                aria-label={slices
                                    .map(
                                        (slice) =>
                                            `${slice.label}: ${slice.detail}`,
                                    )
                                    .join(', ')}>
                                {slices.map((slice) => (
                                    <div
                                        key={slice.value}
                                        className={toneSwatch(slice.tone)}
                                        style={{
                                            width: `${slice.share * 100}%`,
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className='flex flex-col gap-0.5'>
                            {visible.map((slice) => (
                                <SliceRow
                                    key={slice.key.value}
                                    slice={slice}
                                    href={sliceHref?.(slice.key.value)}
                                />
                            ))}

                            {hidden.length > 0 && (
                                <Collapsible open={open} onOpenChange={setOpen}>
                                    <CollapsibleContent className='flex flex-col gap-0.5'>
                                        {hidden.map((slice) => (
                                            <SliceRow
                                                key={slice.key.value}
                                                slice={slice}
                                                href={sliceHref?.(
                                                    slice.key.value,
                                                )}
                                            />
                                        ))}
                                    </CollapsibleContent>

                                    {/* Below the content, so the control sits
                                        at the end of the list it grows rather
                                        than jumping down past the rows it just
                                        revealed. */}
                                    <CollapsibleTrigger className='mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-2xs font-medium text-content-muted transition-colors hover:bg-surface-raised hover:text-primary'>
                                        {open
                                            ? 'Show less'
                                            : `${hidden.length} more`}
                                        <HugeiconsIcon
                                            aria-hidden
                                            icon={ArrowDown01Icon}
                                            className={cn(
                                                'size-3.5 transition-transform',
                                                open && 'rotate-180',
                                            )}
                                            strokeWidth={1.75}
                                        />
                                    </CollapsibleTrigger>
                                </Collapsible>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

/** One legend row, which is also the door to the list it summarises. */
function SliceRow({
    slice,
    href,
}: {
    slice: DashboardBreakdown['slices'][number];
    href: string | null | undefined;
}) {
    const body = (
        <>
            <span
                aria-hidden
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    toneSwatch(slice.key.tone),
                )}
            />
            <span className='min-w-0 flex-1 truncate text-content-muted'>
                {slice.key.label}
            </span>
            <span className='shrink-0 font-medium tabular-nums text-content'>
                {slice.count}
            </span>
            <span className='w-9 shrink-0 text-right text-xs tabular-nums text-content-subtle'>
                {slice.shareLabel}
            </span>
        </>
    );

    const shell = 'flex items-center gap-2 rounded-md px-1.5 py-1 text-sm';

    if (!href) return <div className={shell}>{body}</div>;

    return (
        <Link
            href={href}
            className={`${shell} transition-colors hover:bg-surface-raised`}>
            {body}
        </Link>
    );
}
