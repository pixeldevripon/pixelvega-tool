import type { Paginated } from '@/types/api';
import type { Standup, StandupsQuery } from '@/types/standups';

import { apiFetch } from './fetch';
import { buildQuery } from './query';

/**
 * Daily work reports, which the UI calls standups.
 *
 * `/daily-work-reports` is the cross-person read. Whose reports come back
 * depends on the caller: a developer or designer gets their own, and a manager
 * or admin gets the whole team unless they name somebody.
 */
export const standupsApi = {
    list(query: StandupsQuery = {}): Promise<Paginated<Standup>> {
        return apiFetch<Paginated<Standup>>(
            `/daily-work-reports${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                userId: query.userId,
                startDate: query.startDate,
                endDate: query.endDate,
                type: query.type,
            })}`,
        );
    },

    /** The caller's own report for today, or null if they have not started one. */
    today(): Promise<Standup | null> {
        return apiFetch<Standup | null>('/daily-work-reports/today');
    },
};
