'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { profileSessionsApi } from '@/lib/api/profile-sessions';
import { profileKeys } from '@/hooks/profile/use-profile';

export const sessionKeys = {
    all: [...profileKeys.all, 'sessions'] as const,
};

/**
 * `staleTime: 0` and a refetch on focus, unlike everything else on this screen.
 *
 * A session list is the one thing here that changes without this tab doing
 * anything: signing in on a phone adds a row. Coming back to the tab and seeing
 * a stale list is the failure mode that matters on a security screen, so this
 * is the one query that pays for a refetch.
 */
export function useProfileSessionsQuery() {
    return useQuery({
        queryKey: sessionKeys.all,
        queryFn: () => profileSessionsApi.list(),
        staleTime: 0,
        refetchOnWindowFocus: true,
    });
}

export function useRevokeSession() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (sessionId: string) => profileSessionsApi.revoke(sessionId),
        // The endpoint returns what is left, so the list updates from the
        // response rather than from a second round trip.
        onSuccess: (sessions) => {
            queryClient.setQueryData(sessionKeys.all, sessions);
            toast.success('That device was signed out.');
        },
        onError: (error: Error) =>
            toast.error(error.message || 'Could not sign that device out'),
    });
}

export function useRevokeOtherSessions() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => profileSessionsApi.revokeOthers(),
        onSuccess: async (result) => {
            // The server counts, writes the sentence and gets the plural right,
            // so this renders it verbatim rather than assembling one.
            toast.success(result.message);
            await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        },
        onError: (error: Error) =>
            toast.error(error.message || 'Could not sign the other devices out'),
    });
}
