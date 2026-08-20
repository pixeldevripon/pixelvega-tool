'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { usersApi } from '@/lib/api/users';
import type { UsersQuery } from '@/types/users';

export const userListKeys = {
    all: ['users'] as const,
    lists: () => [...userListKeys.all, 'list'] as const,
    list: (query: UsersQuery) => [...userListKeys.lists(), query] as const,
};

export function useUsersList(query: UsersQuery) {
    return useQuery({
        queryKey: userListKeys.list(query),
        queryFn: () => usersApi.list(query),
        placeholderData: keepPreviousData,
    });
}
