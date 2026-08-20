'use client';

import { SecurityCheckIcon } from '@hugeicons/core-free-icons';

import { auditLogsColumns } from '@/components/audit-logs/audit-logs-columns';
import { DataTable } from '@/components/data-table/data-table';
import { useTableState } from '@/components/data-table/use-table-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listErrorDescription } from '@/lib/api/list-error';
import { useAuditLogs } from '@/hooks/audit-logs/use-audit-logs';

/**
 * The audit log.
 *
 * ── Why a date range and not a search box ──
 *
 * `action` is an equality match, not a substring one, because audit actions are
 * stable dotted strings written by the code that emits them: a partial match
 * would quietly include actions the reader did not mean to ask about. So the
 * filter people actually need is "around when", and an audit log without one is
 * unusable at any real size.
 *
 * Typing an exact action is still possible, and the table prints the exact value
 * under each label so there is something to copy.
 */
export function AuditLogsListView() {
    const table = useTableState();

    const query = useAuditLogs({
        page: table.page,
        pageSize: table.limit,
        action: table.filters.action,
        startDate: table.filters.startDate,
        endDate: table.filters.endDate,
    });

    return (
        <DataTable
            columns={auditLogsColumns}
            data={query.data?.items ?? []}
            isLoading={query.isPending}
            getRowId={(row) => row.id}
            skeletonRows={table.limit > 10 ? 10 : table.limit}
            pagination={{
                total: query.data?.total ?? 0,
                page: table.page,
                limit: table.limit,
                onPageChange: table.setPage,
                onLimitChange: table.setLimit,
            }}
            empty={{
                icon: SecurityCheckIcon,
                title: query.isError
                    ? 'The audit log could not be loaded'
                    : 'Nothing recorded in this range',
                description: query.isError
                    ? listErrorDescription(query.error)
                    : 'Try widening the dates, or clearing the action.',
            }}
            toolbar={() => (
                <div className='flex flex-wrap items-end gap-2'>
                    <div className='flex flex-col gap-1'>
                        <Label
                            htmlFor='audit-action'
                            className='text-2xs text-content-muted'
                        >
                            Action
                        </Label>
                        <Input
                            id='audit-action'
                            value={table.filters.action ?? ''}
                            onChange={(event) =>
                                table.setFilter(
                                    'action',
                                    event.target.value || undefined,
                                )
                            }
                            placeholder='user.password_changed'
                            className='h-9 w-full font-mono text-xs sm:w-56'
                        />
                    </div>

                    <DateFilter
                        id='audit-from'
                        label='From'
                        value={table.filters.startDate}
                        onChange={(value) =>
                            table.setFilter('startDate', value)
                        }
                    />
                    <DateFilter
                        id='audit-to'
                        label='To'
                        value={table.filters.endDate}
                        onChange={(value) => table.setFilter('endDate', value)}
                    />
                </div>
            )}
        />
    );
}

/**
 * A native date input, deliberately.
 *
 * The API takes a date-only string and reads `endDate` to the END of that day,
 * so there is nothing here a calendar popover would add except a dependency and
 * a timezone to get wrong: `<input type="date">` already produces exactly the
 * `YYYY-MM-DD` the endpoint wants.
 */
function DateFilter({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}) {
    return (
        <div className='flex flex-col gap-1'>
            <Label htmlFor={id} className='text-2xs text-content-muted'>
                {label}
            </Label>
            <Input
                id={id}
                type='date'
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value || undefined)}
                className='h-9 w-40'
            />
        </div>
    );
}
