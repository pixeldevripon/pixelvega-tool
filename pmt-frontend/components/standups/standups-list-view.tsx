'use client';

import { Task01Icon } from '@hugeicons/core-free-icons';

import { DataTableEmpty } from '@/components/data-table/data-table-empty';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { useTableState } from '@/components/data-table/use-table-state';
import { FilterSelect } from '@/components/common/filter-select';
import { StandupCard } from '@/components/standups/standup-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { listErrorDescription } from '@/lib/api/list-error';
import { useStandups } from '@/hooks/standups/use-standups';
import type { StandupsQuery } from '@/types/standups';

/**
 * The standups screen.
 *
 * ── Whose standups ──
 *
 * Decided by the API from the caller's role, not here. A developer or designer
 * gets their own; a manager or admin gets the whole team. There is no toggle,
 * because there is no choice to offer: a developer asking for somebody else is a
 * 403 by design.
 *
 * ── Not a table ──
 *
 * A standup is prose. The plan and the wrap-up are the only things worth
 * reading, and a cell truncates both. Cards, paged by the same server-driven
 * pager every other list uses.
 */

const TYPE_OPTIONS = [
    { value: 'PLAN', label: 'Has a plan' },
    { value: 'WRAP_UP', label: 'Wrapped up' },
];

export function StandupsListView() {
    const table = useTableState({ defaultLimit: 10 });

    const query = useStandups({
        page: table.page,
        pageSize: table.limit,
        startDate: table.filters.startDate,
        endDate: table.filters.endDate,
        type: table.filters.type as StandupsQuery['type'],
    });

    const standups = query.data?.items ?? [];
    const isEmpty = !query.isPending && standups.length === 0;

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex flex-wrap items-end gap-2'>
                <DateFilter
                    id='standups-from'
                    label='From'
                    value={table.filters.startDate}
                    onChange={(value) => table.setFilter('startDate', value)}
                />
                <DateFilter
                    id='standups-to'
                    label='To'
                    value={table.filters.endDate}
                    onChange={(value) => table.setFilter('endDate', value)}
                />
                <div className='flex flex-col gap-1'>
                    <span className='text-2xs text-content-muted'>Entries</span>
                    <FilterSelect
                        label='Entry type'
                        placeholder='Plan and wrap-up'
                        value={table.filters.type}
                        options={TYPE_OPTIONS}
                        onChange={(value) => table.setFilter('type', value)}
                        className='w-48'
                    />
                </div>
            </div>

            {query.isPending && (
                <div className='flex flex-col gap-3'>
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className='h-40 w-full' />
                    ))}
                </div>
            )}

            {isEmpty && (
                <DataTableEmpty
                    icon={Task01Icon}
                    title={
                        query.isError
                            ? 'Standups could not be loaded'
                            : 'No standup in this range'
                    }
                    description={
                        query.isError
                            ? listErrorDescription(query.error)
                            : 'Try widening the dates, or clearing the entry filter.'
                    }
                />
            )}

            {!query.isPending && standups.length > 0 && (
                <>
                    <div className='flex flex-col gap-3'>
                        {standups.map((standup) => (
                            <StandupCard key={standup.id} standup={standup} />
                        ))}
                    </div>
                    <DataTablePagination
                        isLoading={query.isFetching}
                        pagination={{
                            total: query.data?.total ?? 0,
                            page: table.page,
                            limit: table.limit,
                            onPageChange: table.setPage,
                            onLimitChange: table.setLimit,
                        }}
                    />
                </>
            )}
        </div>
    );
}

/**
 * A native date input. The API takes a date-only string, which is exactly what
 * `<input type="date">` produces, so a calendar popover would add a dependency
 * and a timezone to get wrong for nothing.
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
