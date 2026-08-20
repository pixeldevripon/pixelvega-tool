'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { standupsApi } from '@/lib/api/standups';
import type { StandupsQuery } from '@/types/standups';

export const standupKeys = {
    all: ['standups'] as const,
    lists: () => [...standupKeys.all, 'list'] as const,
    list: (query: StandupsQuery) => [...standupKeys.lists(), query] as const,
    today: () => [...standupKeys.all, 'today'] as const,
};

export function useStandups(query: StandupsQuery) {
    return useQuery({
        queryKey: standupKeys.list(query),
        queryFn: () => standupsApi.list(query),
        placeholderData: keepPreviousData,
    });
}

export function useTodayStandup() {
    return useQuery({
        queryKey: standupKeys.today(),
        queryFn: () => standupsApi.today(),
    });
}
