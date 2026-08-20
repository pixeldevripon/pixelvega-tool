import type { Paginated } from '@/types/api';
import type { User, UsersQuery } from '@/types/users';

import { apiFetch } from './fetch';
import { buildQuery } from './query';

export const usersApi = {
    list(query: UsersQuery = {}): Promise<Paginated<User>> {
        return apiFetch<Paginated<User>>(
            `/users${buildQuery({
                page: query.page,
                pageSize: query.pageSize,
                sortBy: query.sortBy,
                sortOrder: query.sortOrder,
                // Repeated params rather than a joined string. The API accepts
                // both; letting `buildQuery` handle the array keeps the
                // comma-escaping question from arising.
                role: query.role,
                status: query.status,
                search: query.search,
            })}`,
        );
    },

    get(userId: string): Promise<User> {
        return apiFetch<User>(`/users/${userId}`);
    },
};
