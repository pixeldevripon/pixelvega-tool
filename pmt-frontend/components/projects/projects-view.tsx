'use client';

import { Layers01Icon } from '@hugeicons/core-free-icons';

import { DataTableEmpty } from '@/components/data-table/data-table-empty';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import { useTableState } from '@/components/data-table/use-table-state';
import { ClientProjectsList } from '@/components/projects/client-projects-list';
import { ProjectsBoard } from '@/components/projects/projects-board';
import { ProjectsFilters } from '@/components/projects/projects-filters';
import { ProjectsList } from '@/components/projects/projects-list';
import { ProjectsTimeline } from '@/components/projects/projects-timeline';
import {
    parseProjectView,
    ProjectsViewSwitch,
    type ProjectView,
} from '@/components/projects/projects-view-switch';
import {
    TIMELINE_ZOOMS,
    type TimelineZoom,
} from '@/components/projects/timeline-scale';
import { useRole } from '@/contexts/role-context';
import { listErrorDescription } from '@/lib/api/list-error';
import { useClientNow } from '@/hooks/use-client-now';
import { useClientProjects, useProjects } from '@/hooks/projects/use-projects';
import { Permission } from '@/lib/config/rbac';
import type {
    Project,
    ProjectSortField,
    ProjectsScope,
} from '@/types/projects';

/**
 * The projects screen: one query, one set of filters, three readings of the
 * result.
 *
 * Everything that decides WHICH projects come back lives in the URL and goes to
 * the API as a query param. The API filters, sorts and pages before it answers,
 * so page one really is the first rows (D4). Switching the view re-reads the
 * same data and never re-queries.
 *
 * The three views share the pager deliberately. A board showing all 111
 * projects at once would be a wall, and a timeline would be a mile of rows: the
 * page is the unit of attention in every reading, not a table implementation
 * detail.
 */

export function ProjectsView() {
    const table = useTableState();
    const { can } = useRole();

    /**
     * Which list this caller reads, and therefore which shape comes back.
     *
     * Three answers, from two permissions:
     *
     *   - `VIEW_ALL_PROJECTS` (SYSTEM_ADMIN, ADMIN, PROJECT_MANAGER) reads
     *     `/projects`, the whole company's work.
     *   - `VIEW_PROJECT_MEMBERS` without it (DEVELOPER, DESIGNER) reads
     *     `/projects/mine` in the internal shape.
     *   - Neither is a CLIENT, who reads the same endpoint and gets nine fields.
     *
     * Without this branch the screen answered 403 to every developer, designer
     * and client, which is most of the company, and then crashed for the client
     * on a `priority` the response does not carry.
     *
     * ── Why `VIEW_PROJECT_MEMBERS` is the discriminator ──
     *
     * A permission, never a role string (D2). A CLIENT and a DEVELOPER both hold
     * `VIEW_OWN_PROJECTS`, so that one cannot tell them apart. What separates
     * them is that every internal read belongs to staff, and this list's
     * internal shape IS the roster: the permission for seeing who is on a
     * project is exactly the permission for seeing this version of the screen.
     *
     * All of it is UX. The backend picks the projection itself from the caller's
     * role, so a client who forced the internal scope would still receive nine
     * fields.
     */
    const scope: ProjectsScope = can(Permission.VIEW_ALL_PROJECTS)
        ? 'all'
        : can(Permission.VIEW_PROJECT_MEMBERS)
          ? 'mine'
          : 'client';
    // Null for the first frame, which is why the timeline is the one view that
    // waits for it. Nothing else here needs a clock: every date, countdown and
    // overdue flag was decided by the server's.
    const nowMs = useClientNow();

    const view = parseProjectView(table.filters.view);
    /**
     * The sort column, or undefined.
     *
     * Undefined is meaningful on `/projects/mine`: it asks for the dashboard's
     * ordering (priority, then deadline, then planned start), which is the order
     * the work should be picked up in rather than a column somebody clicked. On
     * `/projects` there is no such default, so it falls back to newest first.
     */
    const sortBy = (table.filters.sortBy ??
        (scope === 'all' ? 'createdAt' : undefined)) as
        ProjectSortField | undefined;
    const zoom = parseZoom(table.filters.zoom);

    const isClient = scope === 'client';

    // Two hooks, one of them disabled. React rules forbid calling a hook
    // conditionally, and the shapes differ enough that one hook returning a
    // union would push the branch into every consumer instead.
    const internalQuery = useProjects(
        isClient ? 'mine' : scope,
        {
            page: table.page,
            pageSize: table.limit,
            search: table.debouncedSearch || undefined,
            status: table.filters.status,
            priority: table.filters.priority,
            sortBy,
            // Deadline ascending puts the soonest first, which is the only
            // useful direction for it. Everything else reads best newest-first.
            sortOrder:
                sortBy === 'deadline' || sortBy === 'name' ? 'asc' : 'desc',
        },
        { enabled: !isClient },
    );

    const clientQuery = useClientProjects(
        { page: table.page, pageSize: table.limit },
        { enabled: isClient },
    );

    const query = isClient ? clientQuery : internalQuery;
    const isEmpty = !query.isPending && (query.data?.items.length ?? 0) === 0;

    return (
        <div className='flex flex-col gap-4'>
            {/* A client gets neither: the backend ignores every filter for
                them, and both the board and the timeline group by the manager
                carrying the work, which is not their business. */}
            {!isClient && (
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <ProjectsFilters
                        search={table.search}
                        onSearchChange={table.setSearch}
                        status={table.filters.status}
                        priority={table.filters.priority}
                        sortBy={sortBy}
                        // Only the scoped list has a meaningful "no column" option,
                        // so only it offers one.
                        allowDefaultSort={scope === 'mine'}
                        onFilterChange={table.setFilter}
                    />
                    <ProjectsViewSwitch
                        view={view}
                        onChange={(next) => table.setFilter('view', next)}
                    />
                </div>
            )}

            {query.isPending && <DataTableSkeleton rows={8} columns={6} />}

            {isEmpty && (
                <DataTableEmpty
                    icon={Layers01Icon}
                    title={
                        query.isError
                            ? 'Projects could not be loaded'
                            : 'No projects match this view'
                    }
                    description={
                        query.isError
                            ? // `ApiError.message` is written to be shown
                              // verbatim: raw technical text never reaches a
                              // user.
                              listErrorDescription(query.error)
                            : 'Try clearing the filters, or search for a different name.'
                    }
                />
            )}

            {!query.isPending && !isEmpty && (
                <>
                    {isClient && clientQuery.data && (
                        <ClientProjectsList projects={clientQuery.data.items} />
                    )}

                    {!isClient && internalQuery.data && (
                        <InternalViews
                            view={view}
                            projects={internalQuery.data.items}
                            zoom={zoom}
                            nowMs={nowMs}
                            onZoomChange={(next) =>
                                table.setFilter('zoom', next)
                            }
                        />
                    )}

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

/** The three internal readings. Split out so the shell stays readable. */
function InternalViews({
    view,
    projects,
    zoom,
    nowMs,
    onZoomChange,
}: {
    view: ProjectView;
    projects: Project[];
    zoom: TimelineZoom;
    nowMs: number | null;
    onZoomChange: (zoom: TimelineZoom) => void;
}) {
    return (
        <>
            {view === 'list' && <ProjectsList projects={projects} />}
            {view === 'board' && <ProjectsBoard projects={projects} />}
            {view === 'timeline' &&
                (nowMs === null ? (
                    <DataTableSkeleton rows={8} columns={6} />
                ) : (
                    <ProjectsTimeline
                        projects={projects}
                        zoom={zoom}
                        onZoomChange={onZoomChange}
                        nowMs={nowMs}
                    />
                ))}
        </>
    );
}

/** An unknown zoom is a stale link, and month is the reading that fits most. */
function parseZoom(value: string | undefined): TimelineZoom {
    return TIMELINE_ZOOMS.some((option) => option.value === value)
        ? (value as TimelineZoom)
        : 'month';
}
