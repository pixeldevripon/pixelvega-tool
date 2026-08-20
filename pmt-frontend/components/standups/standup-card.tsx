'use client';

import {
    CheckmarkCircle02Icon,
    Flag01Icon,
    CheckmarkSquare02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import { PersonCell } from '@/components/common/person-cell';
import type { Standup, StandupEntry } from '@/types/standups';

/**
 * One person's day.
 *
 * A card rather than a table row, because a standup is prose: a plan and a
 * wrap-up per project, and truncating either into a cell loses the only thing
 * worth reading. The reason a manager opens this screen is to read the words.
 */
export function StandupCard({ standup }: { standup: Standup }) {
    return (
        <article className='rounded-lg border border-line bg-surface-overlay'>
            <header className='flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3'>
                <PersonCell
                    name={standup.user?.name}
                    secondary={standup.user?.email}
                />
                <div className='flex items-center gap-2'>
                    <EnumBadge display={standup.status} />
                    <span className='text-xs tabular-nums text-content-muted'>
                        {new Date(standup.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                        })}
                    </span>
                </div>
            </header>

            <div className='divide-y divide-line'>
                {standup.entries.map((entry) => (
                    <StandupEntryRow key={entry.id} entry={entry} />
                ))}

                {standup.entries.length === 0 && (
                    <p className='px-4 py-3 text-sm text-content-muted'>
                        Nothing recorded against a project.
                    </p>
                )}
            </div>

            {/* `entryCount` is the API's count. `entries.length` is what came
                back on this page, and the two can differ when the type filter
                narrowed the entries inside a report. */}
            {standup.entryCount > standup.entries.length && (
                <footer className='border-t border-line px-4 py-2 text-2xs text-content-subtle'>
                    {standup.entryCount - standup.entries.length} more entry
                    {standup.entryCount - standup.entries.length === 1
                        ? ''
                        : 'ies'}{' '}
                    on this day, filtered out by the current view
                </footer>
            )}
        </article>
    );
}

function StandupEntryRow({ entry }: { entry: StandupEntry }) {
    return (
        <div className='px-4 py-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                {entry.project ? (
                    <Link
                        href={`/projects/${entry.project.id}`}
                        className='text-sm font-medium text-content hover:text-primary hover:underline'>
                        {entry.project.name}
                    </Link>
                ) : (
                    <span className='text-sm font-medium text-content-muted'>
                        No project
                    </span>
                )}

                {entry.isReviewed && (
                    <span className='flex items-center gap-1 text-2xs text-success-fg'>
                        <HugeiconsIcon
                            icon={CheckmarkCircle02Icon}
                            className='size-3.5'
                            strokeWidth={1.75}
                        />
                        Reviewed
                        {entry.reviewedBy && ` by ${entry.reviewedBy.name}`}
                    </span>
                )}
            </div>

            <div className='mt-2 grid gap-2 sm:grid-cols-2'>
                <StandupNote
                    icon={Flag01Icon}
                    label='Plan'
                    text={entry.plan}
                    missing='No plan filed'
                />
                <StandupNote
                    icon={CheckmarkSquare02Icon}
                    label='Wrapped up'
                    text={entry.accomplishments}
                    missing='Not wrapped up yet'
                />
            </div>

            {entry.reviewComment && (
                <p className='mt-2 rounded-md bg-surface-inset px-3 py-2 text-xs text-content-muted'>
                    <span className='font-medium text-content'>Review: </span>
                    {entry.reviewComment}
                </p>
            )}
        </div>
    );
}

/**
 * A plan or a wrap-up.
 *
 * Both are shown even when empty, and labelled with WHY they are empty. The two
 * are independent: a day can have a plan and no wrap-up (still in progress) or a
 * wrap-up and no plan (somebody forgot the morning). Hiding the absent half
 * would make those two states look identical.
 */
function StandupNote({
    icon,
    label,
    text,
    missing,
}: {
    icon: typeof Flag01Icon;
    label: string;
    text: string | null;
    missing: string;
}) {
    return (
        <div className='min-w-0'>
            <p className='flex items-center gap-1 text-2xs font-medium uppercase tracking-caps text-content-subtle'>
                <HugeiconsIcon
                    icon={icon}
                    className='size-3.5'
                    strokeWidth={1.75}
                />
                {label}
            </p>
            <p
                className={
                    text
                        ? 'mt-0.5 text-sm text-content'
                        : 'mt-0.5 text-sm italic text-content-subtle'
                }>
                {text ?? missing}
            </p>
        </div>
    );
}
