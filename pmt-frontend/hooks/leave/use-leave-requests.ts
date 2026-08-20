'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { leaveApi } from '@/lib/api/leave';
import type { LeaveRequestsQuery } from '@/types/leave';

export const leaveKeys = {
    all: ['leave'] as const,
    lists: () => [...leaveKeys.all, 'list'] as const,
    list: (query: LeaveRequestsQuery) => [...leaveKeys.lists(), query] as const,
    mine: (query: LeaveRequestsQuery) =>
        [...leaveKeys.all, 'mine', query] as const,
};

export function useLeaveRequests(query: LeaveRequestsQuery) {
    return useQuery({
        queryKey: leaveKeys.list(query),
        queryFn: () => leaveApi.list(query),
        placeholderData: keepPreviousData,
    });
}
