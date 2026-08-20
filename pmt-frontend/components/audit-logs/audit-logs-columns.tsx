'use client';

import type { ColumnDef } from '@tanstack/react-table';

import { DateCell } from '@/components/common/date-cell';
import { PersonCell } from '@/components/common/person-cell';
import type { AuditLogEntry } from '@/types/audit-logs';

/**
 * The audit log.
 *
 * Read only, always. There is no row action and there must not be one: an audit
 * trail somebody can act on from inside the trail is not a trail.
 */
export const auditLogsColumns: ColumnDef<AuditLogEntry>[] = [
    {
        id: 'createdAt',
        header: 'When',
        enableSorting: false,
        cell: ({ row }) => (
            // With the time, unlike every other list here. "Which of these two
            // happened first" is the whole question an audit log answers.
            <DateCell value={row.original.createdAt} withTime />
        ),
    },
    {
        id: 'action',
        header: 'Action',
        enableSorting: false,
        cell: ({ row }) => (
            <div className='min-w-0'>
                <p className='truncate text-sm text-content'>
                    {row.original.actionLabel}
                </p>
                {/* The exact value underneath, because somebody reading an
                    audit log may need to quote it or filter on it. */}
                <p className='truncate font-mono text-2xs text-content-subtle'>
                    {row.original.action}
                </p>
            </div>
        ),
    },
    {
        id: 'user',
        header: 'Who did it',
        enableSorting: false,
        cell: ({ row }) => (
            <PersonCell
                name={row.original.user?.name}
                secondary={row.original.user?.email}
            />
        ),
    },
    {
        id: 'target',
        header: 'What it was done to',
        enableSorting: false,
        cell: ({ row }) =>
            row.original.targetType ? (
                <div className='min-w-0'>
                    <p className='text-sm text-content'>
                        {row.original.targetType}
                    </p>
                    <p className='truncate font-mono text-2xs text-content-subtle'>
                        {row.original.targetId ?? '—'}
                    </p>
                </div>
            ) : (
                // A system action, with no row behind it. Both columns are
                // nullable and this is what that state looks like.
                <span className='text-sm text-content-subtle'>System</span>
            ),
    },
    {
        id: 'metadata',
        header: 'Detail',
        enableSorting: false,
        cell: ({ row }) => <MetadataCell value={row.original.metadata} />,
    },
];

/**
 * The free form detail, shaped per action by whatever emitted it.
 *
 * Rendered as flat `key: value` pairs rather than pretty-printed JSON, and NOT
 * interpreted: guessing at a shape this client does not own is how a renderer
 * starts throwing on the one action nobody tested.
 */
function MetadataCell({ value }: { value: Record<string, unknown> | null }) {
    if (!value || Object.keys(value).length === 0) {
        return <span className='text-sm text-content-subtle'>—</span>;
    }

    return (
        <div className='flex max-w-xs flex-col gap-0.5'>
            {Object.entries(value)
                .slice(0, 3)
                .map(([key, entry]) => (
                    <p key={key} className='truncate text-2xs'>
                        <span className='text-content-subtle'>{key}: </span>
                        <span className='text-content-muted'>
                            {typeof entry === 'object' && entry !== null
                                ? JSON.stringify(entry)
                                : String(entry)}
                        </span>
                    </p>
                ))}
            {Object.keys(value).length > 3 && (
                <p className='text-2xs text-content-subtle'>
                    +{Object.keys(value).length - 3} more
                </p>
            )}
        </div>
    );
}
