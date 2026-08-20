'use client';

import { UserGroupIcon } from '@hugeicons/core-free-icons';

import { FilterSelect } from '@/components/common/filter-select';
import { DataTable } from '@/components/data-table/data-table';
import { useTableState } from '@/components/data-table/use-table-state';
import { usersColumns } from '@/components/users/users-columns';
import { Input } from '@/components/ui/input';
import { useUsersList } from '@/hooks/users/use-users-list';
import { USER_SORT_FIELDS, type UserSortField } from '@/types/users';

/**
 * Everyone in the company.
 *
 * The role filter sends REPEATED params (`?role=DEVELOPER&role=DESIGNER`) rather
 * than a joined string, so nothing has to decide how a comma inside a value
 * would be escaped. It is single-select in the UI for now: the API matches ANY
 * of the given roles, so widening to multi-select is a control change and not a
 * contract change.
 */

const ROLE_OPTIONS = [
    { value: 'SYSTEM_ADMIN', label: 'System admin' },
    { value: 'ADMIN', label: 'Admin' },
    { value: 'PROJECT_MANAGER', label: 'Project manager' },
    { value: 'DEVELOPER', label: 'Developer' },
    { value: 'DESIGNER', label: 'Designer' },
    { value: 'CLIENT', label: 'Client' },
];

const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INVITED', label: 'Invited' },
    { value: 'SUSPENDED', label: 'Suspended' },
];

const SORT_OPTIONS: { value: UserSortField; label: string }[] = [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'createdAt', label: 'Newest first' },
];

export function UsersListView() {
    const table = useTableState();

    const sortBy = (table.filters.sortBy ?? 'name') as UserSortField;

    const query = useUsersList({
        page: table.page,
        pageSize: table.limit,
        search: table.debouncedSearch || undefined,
        // One value, sent as the array the API expects.
        role: table.filters.role ? [table.filters.role] : undefined,
        status: table.filters.status,
        sortBy,
        // Names and emails read alphabetically; a join date reads newest first.
        sortOrder: sortBy === 'createdAt' ? 'desc' : 'asc',
    });

    return (
        <DataTable
            columns={usersColumns}
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
                icon: UserGroupIcon,
                title: query.isError
                    ? 'The team could not be loaded'
                    : 'Nobody matches this view',
                description: query.isError
                    ? query.error instanceof Error
                      ? query.error.message
                      : 'Please try again.'
                    : 'Try clearing the filters, or search for a different name.',
            }}
            toolbar={() => (
                <div className='flex flex-wrap items-center gap-2'>
                    <Input
                        value={table.search}
                        onChange={(event) => table.setSearch(event.target.value)}
                        placeholder='Search name or email…'
                        aria-label='Search the team'
                        className='h-9 w-full sm:w-64'
                    />
                    <FilterSelect
                        label='Role'
                        placeholder='Any role'
                        value={table.filters.role}
                        options={ROLE_OPTIONS}
                        onChange={(value) => table.setFilter('role', value)}
                        className='w-44'
                    />
                    <FilterSelect
                        label='Status'
                        placeholder='Any status'
                        value={table.filters.status}
                        options={STATUS_OPTIONS}
                        onChange={(value) => table.setFilter('status', value)}
                    />
                    <FilterSelect
                        label='Sort by'
                        placeholder='Name'
                        value={
                            SORT_OPTIONS.some((o) => o.value === sortBy)
                                ? sortBy
                                : undefined
                        }
                        options={SORT_OPTIONS}
                        onChange={(value) => table.setFilter('sortBy', value)}
                    />
                </div>
            )}
        />
    );
}
