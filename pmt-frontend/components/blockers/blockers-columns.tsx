'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

import { DateCell } from '@/components/common/date-cell';
import { EnumBadge } from '@/components/common/enum-badge';
import { PersonCell } from '@/components/common/person-cell';
import type { Blocker } from '@/types/blockers';

/**
 * The blockers queue.
 *
 * `enableSorting: false` on every column, and that is not an oversight.
 * `GET /blockers` offers no sort param: blockers come back newest first, which
 * is the order a triage queue wants. A sortable header here would re-order the
 * PAGE, presenting twenty of 325 rows as though they were the extremes.
 */
export const blockersColumns: ColumnDef<Blocker>[] = [
    {
        id: 'description',
        header: 'Blocker',
        enableSorting: false,
        cell: ({ row }) => (
            <div className='min-w-0 max-w-md'>
                <p className='truncate text-sm text-content'>
                    {row.original.description}
                </p>
                <div className='mt-0.5 flex items-center gap-1.5'>
                    {row.original.project && (
                        <Link
                            href={`/projects/${row.original.project.id}`}
                            className='truncate text-2xs text-content-muted hover:text-primary hover:underline'>
                            {row.original.project.name}
                        </Link>
                    )}
                    {row.original.reason && (
                        <span className='rounded-sm bg-surface-inset px-1.5 py-0.5 text-2xs font-medium text-content-muted'>
                            {row.original.reason.name}
                        </span>
                    )}
                </div>
            </div>
        ),
    },
    {
        id: 'severity',
        header: 'Severity',
        enableSorting: false,
        cell: ({ row }) => <EnumBadge display={row.original.severity} />,
    },
    {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => <EnumBadge display={row.original.status} />,
    },
    {
        id: 'assignedTo',
        header: 'Assigned to',
        enableSorting: false,
        cell: ({ row }) => (
            <PersonCell
                name={row.original.assignedTo?.name}
                secondary={row.original.assignedTo?.email}
            />
        ),
    },
    {
        id: 'age',
        header: 'Open for',
        enableSorting: false,
        cell: ({ row }) => (
            // `ageLabel` and `resolutionLabel` are phrased by the API against
            // the server clock. Deriving either here would put a browser's idea
            // of "now" beside the server's.
            <span className='whitespace-nowrap text-sm tabular-nums text-content-muted'>
                {row.original.isResolved
                    ? (row.original.resolutionLabel ?? '—')
                    : row.original.ageLabel}
            </span>
        ),
    },
    {
        id: 'reportedBy',
        header: 'Reported',
        enableSorting: false,
        cell: ({ row }) => (
            <div>
                <DateCell value={row.original.createdAt} />
                {row.original.reportedBy && (
                    <p className='truncate text-2xs text-content-muted'>
                        {row.original.reportedBy.name}
                    </p>
                )}
            </div>
        ),
    },
];
