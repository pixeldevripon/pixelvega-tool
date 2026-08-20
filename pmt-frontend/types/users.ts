import type { EnumDisplay } from '@/contexts/role-context';

/** `GET /users`, mirrored from the backend's user DTO. */
export type User = {
    id: string;
    name: string;
    email: string;
    role: EnumDisplay;
    status: EnumDisplay;
    /** True until an invited account replaces its temporary password. */
    mustResetPassword: boolean;
    slackUserId: string | null;
    createdById: string | null;
    createdAt: string;
    updatedAt: string;
};

/**
 * What `GET /users` accepts. Exactly the declared set: an extra query param is
 * a 400, because the API runs `forbidNonWhitelisted`.
 */
export type UsersQuery = {
    page?: number;
    pageSize?: number;
    sortBy?: UserSortField;
    sortOrder?: 'asc' | 'desc';
    /** ANY of these roles, not all. Sent as repeated params. */
    role?: string[];
    status?: string;
    /** Matches the name OR the email, case insensitively. */
    search?: string;
};

/** The columns the API will sort by. Anything else is a 400. */
export const USER_SORT_FIELDS = ['name', 'email', 'createdAt'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
