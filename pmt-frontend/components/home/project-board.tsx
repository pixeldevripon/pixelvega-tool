'use client';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { toneToVariant } from '@/components/common/enum-badge';
import { statusDot } from '@/components/common/status-badge';
import { ProjectBoardCard } from '@/components/home/project-board-card';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import { cn } from '@/lib/utils';
import type {
    DashboardProjectBoard,
    DashboardProjectColumn,
} from '@/types/dashboard';

/**
 * The projects, as a board. The first thing on the overview.
 *
 * ── Columns are phases, and the phases came from the server ──
 *
 * Four lanes rather than ten status columns, and which status belongs to which
 * lane is a judgment about the business (`ON_HOLD` counts as started,
 * `CANCELLED` counts as finished), so it is decided once in the backend and
 * shipped. There is no `.filter` or `.reduce` in this file: the columns arrive
 * grouped, ordered, counted and labelled (D4).
 *
 * ── Every column renders, including the empty ones ──
 *
 * A board that drops its empty lanes changes shape as work moves through it,
 * and a reader loses the place they learned to look. An empty lane is also
 * information: nothing in review is a fact worth seeing.
 *
 * ── Nothing here is draggable ──
 *
 * Moving a card would mean changing a project's status, which has its own
 * permission and its own audit entry. That belongs on the project rather than in
 * a gesture that is easy to make by accident.
 */
export function ProjectBoard({ board }: { board: DashboardProjectBoard }) {
    // The lanes overflow on anything narrower than a desktop, and a
    // vertical-wheel mouse has no other way to reach the fourth one.
    const scrollRef = useDragScroll<HTMLDivElement>();

    return (
        <div
            ref={scrollRef}
            /**
             * Columns FILL the width, and scroll only when they cannot.
             *
             * `grid-flow-col` with `auto-cols-[minmax(17.5rem,1fr)]` rather
             * than fixed-width flex children: `1fr` spends the whole row on
             * however many columns arrived, and the `17.5rem` floor is what
             * makes it overflow into a scroller on a narrow screen instead of
             * crushing four lanes into slivers. Fixed `w-[17.5rem]` children
             * left a quarter of a wide screen empty.
             *
             * Column count is not hardcoded here. The API sends four phases
             * today, and an implicit-column grid spends the row on five without
             * this file changing.
             */
            className='-mx-1 grid auto-cols-[minmax(17.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-2'>
            {board.columns.map((column) => (
                <BoardColumn key={column.phase.value} column={column} />
            ))}
        </div>
    );
}

function BoardColumn({ column }: { column: DashboardProjectColumn }) {
    return (
        <section className='flex flex-col gap-2.5 rounded-xl bg-surface-raised/60 p-2.5'>
            <header className='flex items-center gap-2 px-0.5'>
                <span
                    aria-hidden
                    className={cn(
                        'size-2 shrink-0 rounded-full',
                        statusDot[toneToVariant(column.phase.tone)],
                    )}
                />
                <h3 className='text-sm font-medium text-content'>
                    {column.phase.label}
                </h3>
                {/* The TRUE total, not the number of cards below it. A header
                    reading "4" over four cards when nineteen projects are in
                    the lane is the specific lie the API's two fields avoid. */}
                <span
                    className='rounded-full bg-surface-inset px-1.5 py-0.5 text-2xs font-medium tabular-nums text-content-muted'
                    title={column.totalLabel}>
                    {column.total}
                </span>
            </header>

            <div className='flex flex-col gap-2'>
                {column.projects.map((project) => (
                    <ProjectBoardCard key={project.id} project={project} />
                ))}

                {column.projects.length === 0 && (
                    <p className='rounded-lg border border-dashed border-line px-3 py-6 text-center text-2xs text-content-subtle'>
                        Nothing here
                    </p>
                )}
            </div>

            {/* Rendered off `hiddenLabel` being non-null rather than off a
                comparison here, so the card and the API agree on when there is
                more to see. The phase token is the same one the projects list
                accepts, so this lands on exactly the projects this column
                counted. */}
            {column.hiddenLabel && (
                <Link
                    href={`/projects?phase=${column.phase.value}`}
                    className='group/more flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-2xs font-medium text-content-muted transition-colors hover:bg-surface-inset hover:text-primary'>
                    {column.hiddenLabel}
                    <HugeiconsIcon
                        aria-hidden
                        icon={ArrowRight01Icon}
                        className='size-3.5 transition-transform group-hover/more:translate-x-0.5'
                        strokeWidth={1.75}
                    />
                </Link>
            )}
        </section>
    );
}
