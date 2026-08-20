'use client';

import { AlertDiamondIcon } from '@hugeicons/core-free-icons';

import { blockersColumns } from '@/components/blockers/blockers-columns';
import { FilterSelect } from '@/components/common/filter-select';
import { DataTable } from '@/components/data-table/data-table';
import { useTableState } from '@/components/data-table/use-table-state';
import { Input } from '@/components/ui/input';
import { useBlockers } from '@/hooks/blockers/use-blockers';

/**
 * Blockers across every project.
 *
 * Scope is the backend's: a DEVELOPER or DESIGNER sees only blockers on projects
 * they are an active member of, enforced in the service's where clause. This
 * screen asks the same question for everyone and the answer differs by caller.
 */

const STATUS_OPTIONS = [
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'Being worked on' },
    { value: 'RESOLVED', label: 'Resolved' },
];

const SEVERITY_OPTIONS = [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
];

export function BlockersListView() {
    const table = useTableState();

    const query = useBlockers({
        page: table.page,
        pageSize: table.limit,
        search: table.debouncedSearch || undefined,
        status: table.filters.status,
        severity: table.filters.severity,
    });

    return (
        <DataTable
            columns={blockersColumns}
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
                icon: AlertDiamondIcon,
                title: query.isError
                    ? 'Blockers could not be loaded'
                    : 'Nothing is blocked',
                description: query.isError
                    ? // `ApiError.message` is written to be shown verbatim.
                      query.error instanceof Error
                      ? query.error.message
                      : 'Please try again.'
                    : 'No blocker matches this view, which on an unfiltered screen is good news.',
            }}
            toolbar={() => (
                <div className='flex flex-wrap items-center gap-2'>
                    <Input
                        value={table.search}
                        onChange={(event) => table.setSearch(event.target.value)}
                        placeholder='Search blockers…'
                        aria-label='Search blockers'
                        className='h-9 w-full sm:w-64'
                    />
                    <FilterSelect
                        label='Status'
                        placeholder='Any status'
                        value={table.filters.status}
                        options={STATUS_OPTIONS}
                        onChange={(value) => table.setFilter('status', value)}
                        className='w-44'
                    />
                    <FilterSelect
                        label='Severity'
                        placeholder='Any severity'
                        value={table.filters.severity}
                        options={SEVERITY_OPTIONS}
                        onChange={(value) => table.setFilter('severity', value)}
                    />
                </div>
            )}
        />
    );
}
