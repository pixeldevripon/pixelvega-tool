import type { ProfileSession, RevokedSessions } from '@/types/profile';

import { apiFetch } from './fetch';

/**
 * Where the caller is signed in.
 *
 * A separate client file from `profile.ts` because it is a separate resource:
 * a profile describes a person, a session is a live credential, and the only
 * thing they share is the screen that reads them.
 */
export const profileSessionsApi = {
    list(): Promise<ProfileSession[]> {
        return apiFetch<ProfileSession[]>('/profiles/me/sessions');
    },

    /** Returns the remaining sessions, so the list does not need a refetch. */
    revoke(sessionId: string): Promise<ProfileSession[]> {
        return apiFetch<ProfileSession[]>(
            `/profiles/me/sessions/${encodeURIComponent(sessionId)}`,
            { method: 'DELETE' },
        );
    },

    /** Everywhere except here. Signing out of THIS device is the sign-out button. */
    revokeOthers(): Promise<RevokedSessions> {
        return apiFetch<RevokedSessions>('/profiles/me/sessions/others', {
            method: 'DELETE',
        });
    },
};
