'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { blockersApi } from '@/lib/api/blockers';
import type { BlockersQuery } from '@/types/blockers';

export const blockerKeys = {
    all: ['blockers'] as const,
    lists: () => [...blockerKeys.all, 'list'] as const,
    list: (query: BlockersQuery) => [...blockerKeys.lists(), query] as const,
};

export function useBlockers(query: BlockersQuery) {
    return useQuery({
        queryKey: blockerKeys.list(query),
        queryFn: () => blockersApi.list(query),
        placeholderData: keepPreviousData,
    });
}
