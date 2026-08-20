'use client';

import type { ColumnDef } from '@tanstack/react-table';

import { DateCell } from '@/components/common/date-cell';
import { EnumBadge } from '@/components/common/enum-badge';
import { PersonCell } from '@/components/common/person-cell';
import type { LeaveRequest } from '@/types/leave';

/**
 * The leave queue.
 *
 * Approve and reject are NOT here. They are mutations gated per row by
 * `capabilities.canApprove` / `canReject`, which the API decides: a
 * PROJECT_MANAGER holds VIEW_LEAVE_REQUESTS but not REVIEW_LEAVE_REQUEST, so
 * they read this queue and cannot act on it, and nobody may review their own
 * request whatever their role. The row actions land with the review mutations.
 */
export const leaveColumns: ColumnDef<LeaveRequest>[] = [
    {
        id: 'user',
        header: 'Who',
        enableSorting: false,
        cell: ({ row }) => (
            <PersonCell
                name={row.original.user?.name}
                // The role, not the email: covering for a project manager's
                // absence is a different problem from covering for a
                // developer's, and that is what a reviewer is weighing.
                secondary={row.original.user?.role?.label}
            />
        ),
    },
    {
        id: 'leaveType',
        header: 'Type',
        enableSorting: false,
        cell: ({ row }) => (
            <span className='text-sm text-content'>
                {row.original.leaveType?.name ?? '—'}
            </span>
        ),
    },
    {
        id: 'dates',
        header: 'Dates',
        enableSorting: false,
        cell: ({ row }) => {
            // A one-day leave read "Dec 21, 2026 to Dec 21, 2026", which parses
            // as a mistake before it parses as a range. Comparing the date-only
            // strings the API sends, not parsed Dates: the API sends leave dates
            // as calendar days precisely so no timezone gets a say, and
            // comparing two `Date` objects would reintroduce one.
            const isSingleDay =
                row.original.startDate.slice(0, 10) ===
                row.original.endDate.slice(0, 10);

            if (isSingleDay) {
                return <DateCell value={row.original.startDate} />;
            }

            return (
                <div className='flex items-center gap-1.5'>
                    <DateCell value={row.original.startDate} />
                    <span className='text-content-subtle'>to</span>
                    <DateCell value={row.original.endDate} />
                </div>
            );
        },
    },
    {
        id: 'days',
        header: 'Days',
        enableSorting: false,
        cell: ({ row }) => (
            // Counted by the API, inclusive of both ends. Counting it here from
            // two dates is a second implementation of the same rule, and the
            // two would disagree about weekends and holidays.
            <span className='text-sm tabular-nums text-content'>
                {row.original.days}
            </span>
        ),
    },
    {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => <EnumBadge display={row.original.status} />,
    },
    {
        id: 'reviewedBy',
        header: 'Decided by',
        enableSorting: false,
        cell: ({ row }) =>
            row.original.isPending ? (
                <span className='text-sm text-content-subtle'>Waiting</span>
            ) : (
                <div>
                    <PersonCell name={row.original.reviewedBy?.name} />
                    <DateCell value={row.original.reviewedAt} />
                </div>
            ),
    },
    {
        id: 'reason',
        header: 'Reason',
        enableSorting: false,
        cell: ({ row }) => (
            <p className='max-w-xs truncate text-sm text-content-muted'>
                {row.original.reason ?? '—'}
            </p>
        ),
    },
];
