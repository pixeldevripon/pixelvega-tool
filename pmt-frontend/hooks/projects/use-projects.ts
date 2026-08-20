'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { projectsApi } from '@/lib/api/projects';
import type { ProjectsQuery, ProjectsScope } from '@/types/projects';

/**
 * The key factory. Every query and every invalidation goes through it: an inline
 * key array drifts and silently stops matching, so a mutation elsewhere would
 * stop refreshing this list with nothing to show why.
 */
export const projectKeys = {
    all: ['projects'] as const,
    lists: () => [...projectKeys.all, 'list'] as const,
    // The scope is part of the key, not just part of the request. The same
    // filters against `/projects` and `/projects/mine` are different answers,
    // and one cache entry for both would serve an admin's hundred projects to
    // the developer who signed in after them.
    list: (scope: ProjectsScope, query: ProjectsQuery) =>
        [...projectKeys.lists(), scope, query] as const,
    detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

/**
 * The internal list, in either of its two scopes.
 *
 * `all` reads `/projects` and needs `VIEW_ALL_PROJECTS`; `mine` reads
 * `/projects/mine` and narrows to active membership. Both answer in the full
 * internal shape, so one hook serves both.
 *
 * A CLIENT caller belongs on `useClientProjects` instead: their response is a
 * different, deliberately smaller shape, and pretending otherwise would have a
 * component read fields the API withholds.
 */
export function useProjects(
    scope: 'all' | 'mine',
    query: ProjectsQuery,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: projectKeys.list(scope, query),
        queryFn: () =>
            scope === 'all'
                ? projectsApi.list(query)
                : projectsApi.listMine(query),
        // Without this the view empties to a skeleton on every page change,
        // which reads as a failed request rather than as paging.
        placeholderData: keepPreviousData,
        enabled: options?.enabled ?? true,
    });
}

/**
 * The reduced list a CLIENT receives from the same endpoint.
 *
 * Separate because the shape is separate. It takes only paging, since the
 * backend ignores every other filter for a client caller.
 */
export function useClientProjects(
    query: ProjectsQuery,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: projectKeys.list('client', query),
        queryFn: () => projectsApi.listAsClient(query),
        placeholderData: keepPreviousData,
        enabled: options?.enabled ?? true,
    });
}
