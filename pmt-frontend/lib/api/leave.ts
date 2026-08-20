import type { LeaveRequest, LeaveRequestsQuery } from '@/types/leave';
import type { Paginated } from '@/types/api';

import { apiFetch } from './fetch';
import { buildQuery } from './query';

export const leaveApi = {
    /** Every request, for whoever may read them. */
    list(query: LeaveRequestsQuery = {}): Promise<Paginated<LeaveRequest>> {
        return apiFetch<Paginated<LeaveRequest>>(
            `/leave/requests${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                status: query.status,
                userId: query.userId,
                leaveTypeId: query.leaveTypeId,
            })}`,
        );
    },

    /** The caller's own requests. A separate route, not a filter on the above. */
    mine(query: LeaveRequestsQuery = {}): Promise<Paginated<LeaveRequest>> {
        return apiFetch<Paginated<LeaveRequest>>(
            `/leave/requests/me${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                status: query.status,
                leaveTypeId: query.leaveTypeId,
            })}`,
        );
    },
};
