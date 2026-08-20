'use client';

import { Beach02Icon } from '@hugeicons/core-free-icons';

import { FilterSelect } from '@/components/common/filter-select';
import { DataTable } from '@/components/data-table/data-table';
import { useTableState } from '@/components/data-table/use-table-state';
import { leaveColumns } from '@/components/leave/leave-columns';
import { listErrorDescription } from '@/lib/api/list-error';
import { useLeaveRequests } from '@/hooks/leave/use-leave-requests';

/**
 * The leave queue.
 *
 * ── Why it opens on Pending ──
 *
 * A reviewer comes here to answer "what is waiting for me", and 420 requests of
 * which most are already decided is not that screen. The default is a real URL
 * value rather than a hidden one, so clearing it is possible and a link still
 * says what it shows.
 *
 * ── The statuses a caller may filter to are not all of them ──
 *
 * A PROJECT_MANAGER may never see a REJECTED request: they can approve leave but
 * not learn that somebody's was turned down. The backend intersects the filter
 * with what the role may see, so asking for Rejected as a PM returns an empty
 * page rather than an error. That is the safe direction, and this screen does
 * not try to predict it: predicting it here would be a second copy of the rule.
 */

const STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

export function LeaveListView() {
    const table = useTableState();

    // Undefined means "the URL said nothing", which is the first visit. An
    // explicit empty string is a deliberate "show me everything".
    const status = table.filters.status ?? 'PENDING';

    const query = useLeaveRequests({
        page: table.page,
        pageSize: table.limit,
        status: status === 'all' ? undefined : status,
    });

    return (
        <DataTable
            columns={leaveColumns}
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
                icon: Beach02Icon,
                title: query.isError
                    ? 'Leave requests could not be loaded'
                    : status === 'PENDING'
                      ? 'Nothing is waiting'
                      : 'No request matches this view',
                description: query.isError
                    ? listErrorDescription(query.error)
                    : status === 'PENDING'
                      ? 'Every request has been decided.'
                      : 'Try a different status.',
            }}
            toolbar={() => (
                <div className='flex flex-wrap items-center gap-2'>
                    <FilterSelect
                        label='Status'
                        placeholder='Any status'
                        value={status === 'all' ? undefined : status}
                        options={STATUS_OPTIONS}
                        onChange={(value) =>
                            // `all` rather than clearing the key: without a
                            // value in the URL this screen re-applies its
                            // Pending default, so "show me everything" needs
                            // something to write down.
                            table.setFilter('status', value ?? 'all')
                        }
                        className='w-44'
                    />
                </div>
            )}
        />
    );
}
