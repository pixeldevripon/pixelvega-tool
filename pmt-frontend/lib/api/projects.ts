import type { Paginated } from '@/types/api';
import type {
    ClientProject,
    Project,
    ProjectsQuery,
} from '@/types/projects';

import { apiFetch } from './fetch';
import { buildQuery } from './query';

/**
 * Projects.
 *
 * Sorting, filtering and paging are query params, applied by the API BEFORE
 * pagination, so page one really does hold the first rows. The client never
 * re-sorts a page it was given.
 *
 * ── Two endpoints, one screen ──
 *
 * `/projects` is gated on `VIEW_ALL_PROJECTS`, which only SYSTEM_ADMIN, ADMIN
 * and PROJECT_MANAGER hold. A developer, a designer or a client calling it gets
 * a 403, so the screen picked its endpoint from a permission rather than
 * assuming everyone may read the whole company's work. `/projects/mine` is the
 * scoped read they hold instead, and it applies the identical filters.
 *
 * The decision is `listFor()`, which takes the answer rather than working it
 * out, because the backend is the control either way: `mine` narrows by
 * membership in its own where clause, so calling the wrong one is a failed
 * request and never a disclosure.
 */
export const projectsApi = {
    list(query: ProjectsQuery = {}): Promise<Paginated<Project>> {
        return apiFetch<Paginated<Project>>(
            `/projects${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
                status: query.status,
                priority: query.priority,
                clientId: query.clientId,
                // Repeated params rather than a joined string: the API accepts
                // both, and letting `buildQuery` handle the array keeps the
                // comma-escaping question from arising at all.
                projectTypes: query.projectTypes,
                archived: query.archived,
                search: query.search,
            })}`,
        );
    },

    /**
     * Only the projects the caller is an active member of.
     *
     * `clientId` is not sent: filtering your own projects by client is a
     * question nobody asks, and the endpoint does not accept it. Everything else
     * is the same, including `sortBy`, whose absence means the dashboard's
     * ordering rather than a column.
     */
    listMine(query: ProjectsQuery = {}): Promise<Paginated<Project>> {
        return apiFetch<Paginated<Project>>(
            `/projects/mine${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
                status: query.status,
                priority: query.priority,
                projectTypes: query.projectTypes,
                archived: query.archived,
                search: query.search,
            })}`,
        );
    },

    /**
     * The same endpoint as `listMine`, in the reduced shape a CLIENT receives.
     *
     * A separate function rather than a generic, because the two return types
     * have almost nothing in common and a caller must choose which it is
     * parsing. Only paging is sent: the backend ignores every other filter for a
     * client caller, so offering them would be a control that does nothing.
     */
    listAsClient(query: ProjectsQuery = {}): Promise<Paginated<ClientProject>> {
        return apiFetch<Paginated<ClientProject>>(
            `/projects/mine${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
            })}`,
        );
    },

    get(projectId: string): Promise<Project> {
        return apiFetch<Project>(`/projects/${projectId}`);
    },
};
