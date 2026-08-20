'use client';

import { FilterSelect } from '@/components/common/filter-select';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { ProjectSortField } from '@/types/projects';

/**
 * What decides WHICH projects come back. Shared by all three views, because a
 * filter that resets when you switch to the board would make the board a
 * different screen rather than another reading of this one.
 *
 * ── Why these option lists are hardcoded ──
 *
 * The labels duplicate the API's own `{ value, label }` for two enums, which is
 * a compromise worth naming. The alternative is an extra request per list screen
 * for values that change only when the schema does. If a third screen needs
 * them, they should come from an endpoint rather than a third copy.
 */

const STATUS_OPTIONS = [
    { value: 'PLANNING', label: 'Planning' },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'READY_FOR_WORK', label: 'Ready for work' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'ON_HOLD', label: 'On hold' },
    { value: 'INTERNAL_REVIEW', label: 'Internal review' },
    { value: 'READY_FOR_CLIENT', label: 'Ready for client' },
    { value: 'WAITING_FOR_FEEDBACK', label: 'Waiting for feedback' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'URGENT', label: 'Urgent' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
];

const SORT_OPTIONS: { value: ProjectSortField; label: string }[] = [
    { value: 'createdAt', label: 'Newest first' },
    { value: 'deadline', label: 'Deadline' },
    { value: 'name', label: 'Name' },
    { value: 'plannedStartDate', label: 'Planned start' },
    { value: 'updatedAt', label: 'Recently updated' },
];

/**
 * Sentinel for "no sort column", which is a real choice on `/projects/mine`: it
 * asks for the dashboard's ordering rather than a column. Its own sentinel,
 * separate from the one `FilterSelect` uses for "no filter", so a reader is not
 * left wondering whether an unsorted list is also an unfiltered one.
 */
const DEFAULT_ORDER = '__default__';

export function ProjectsFilters({
    search,
    onSearchChange,
    status,
    priority,
    sortBy,
    allowDefaultSort = false,
    onFilterChange,
}: {
    search: string;
    onSearchChange: (value: string) => void;
    status: string | undefined;
    priority: string | undefined;
    sortBy: ProjectSortField | undefined;
    /** Offer "Priority order", which only the scoped list supports. */
    allowDefaultSort?: boolean;
    onFilterChange: (key: string, value: string | undefined) => void;
}) {
    return (
        <div className='flex flex-wrap items-center gap-2'>
            <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder='Search projects…'
                aria-label='Search projects'
                className='h-9 w-full sm:w-56'
            />

            <FilterSelect
                label='Status'
                placeholder='Any status'
                value={status}
                options={STATUS_OPTIONS}
                onChange={(value) => onFilterChange('status', value)}
                className='w-44'
            />

            <FilterSelect
                label='Priority'
                placeholder='Any priority'
                value={priority}
                options={PRIORITY_OPTIONS}
                onChange={(value) => onFilterChange('priority', value)}
                className='w-40'
            />

            <Select
                value={sortBy ?? DEFAULT_ORDER}
                onValueChange={(value) =>
                    onFilterChange(
                        'sortBy',
                        value === DEFAULT_ORDER ? undefined : value,
                    )
                }>
                <SelectTrigger className='h-9 w-44' aria-label='Sort by'>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {allowDefaultSort && (
                        <SelectItem value={DEFAULT_ORDER}>
                            Priority order
                        </SelectItem>
                    )}
                    {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
