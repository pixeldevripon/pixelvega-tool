'use client';

import type { ColumnDef } from '@tanstack/react-table';

import { DateCell } from '@/components/common/date-cell';
import { EnumBadge } from '@/components/common/enum-badge';
import { PersonCell } from '@/components/common/person-cell';
import type { User } from '@/types/users';

/**
 * The team list.
 *
 * `enableSorting: false` everywhere, as on every list in this app. The API sorts
 * before it pages, so the header would re-order the twenty rows it was given and
 * present them as the first twenty by that column. Sorting is a query param and
 * lives in the toolbar.
 */
export const usersColumns: ColumnDef<User>[] = [
    {
        id: 'name',
        header: 'Name',
        enableSorting: false,
        cell: ({ row }) => (
            <PersonCell
                name={row.original.name}
                secondary={row.original.email}
            />
        ),
    },
    {
        id: 'role',
        header: 'Role',
        enableSorting: false,
        cell: ({ row }) => <EnumBadge display={row.original.role} />,
    },
    {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
            <div className='flex items-center gap-1.5'>
                <EnumBadge display={row.original.status} />
                {/* An invited person who has never set a password is a
                    different state from a suspended one, and it is the state
                    somebody needs to chase. */}
                {row.original.mustResetPassword && (
                    <span className='rounded-sm bg-surface-inset px-1.5 py-0.5 text-2xs font-medium text-content-muted'>
                        Password pending
                    </span>
                )}
            </div>
        ),
    },
    {
        id: 'slack',
        header: 'Slack',
        enableSorting: false,
        cell: ({ row }) =>
            row.original.slackUserId ? (
                <span className='text-sm text-content-muted'>Linked</span>
            ) : (
                <span className='text-sm text-content-subtle'>—</span>
            ),
    },
    {
        id: 'createdAt',
        header: 'Joined',
        enableSorting: false,
        cell: ({ row }) => <DateCell value={row.original.createdAt} />,
    },
];
