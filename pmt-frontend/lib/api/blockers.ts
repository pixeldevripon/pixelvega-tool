import type { Blocker, BlockersQuery } from '@/types/blockers';
import type { Paginated } from '@/types/api';

import { apiFetch } from './fetch';
import { buildQuery } from './query';

/**
 * Blockers across every project.
 *
 * `GET /blockers` is the cross-project read and takes `projectId` as a FILTER,
 * never as a path segment. Creating and changing one lives under
 * `/projects/:projectId/blockers`, because a blocker always belongs to a project.
 */
export const blockersApi = {
    list(query: BlockersQuery = {}): Promise<Paginated<Blocker>> {
        return apiFetch<Paginated<Blocker>>(
            `/blockers${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                status: query.status,
                severity: query.severity,
                projectId: query.projectId,
                assignedToId: query.assignedToId,
                search: query.search,
            })}`,
        );
    },
};
