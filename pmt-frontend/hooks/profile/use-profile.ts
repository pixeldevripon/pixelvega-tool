'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { profileApi } from '@/lib/api/profile';
import type { UpdateProfilePayload, UserProfile } from '@/types/profile';

export const profileKeys = {
    all: ['profile'] as const,
    me: () => [...profileKeys.all, 'me'] as const,
    options: () => [...profileKeys.all, 'options'] as const,
};

export function useProfileQuery() {
    return useQuery({
        queryKey: profileKeys.me(),
        queryFn: () => profileApi.getProfile(),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * The country list, the gender list, the password policy and the two limits the
 * copy quotes.
 *
 * `staleTime: Infinity` because this is reference data: it is identical for
 * every caller and cannot change without a deploy, at which point the whole
 * bundle is new anyway. Refetching 249 countries on focus would be pure waste.
 */
export function useProfileOptionsQuery() {
    return useQuery({
        queryKey: profileKeys.options(),
        queryFn: () => profileApi.getOptions(),
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    });
}

/**
 * Every profile mutation returns the updated profile, so each one seeds the
 * cache with what it got back instead of invalidating and refetching.
 *
 * The `router.refresh()` is not optional and not a duplicate: the shell (the
 * sidebar identity card and the header avatar) renders from data the SERVER
 * fetched in `app/(app)/layout.tsx`, which no client cache write can reach.
 * Without it, someone changes their name and the sidebar keeps the old one
 * until a hard reload.
 */
function useProfileMutation<TArgs>(
    mutationFn: (args: TArgs) => Promise<UserProfile>,
    fallbackMessage: string,
) {
    const queryClient = useQueryClient();
    const router = useRouter();
    return useMutation({
        mutationFn,
        onSuccess: (profile) => {
            queryClient.setQueryData(profileKeys.me(), profile);
            router.refresh();
        },
        onError: (error: Error) =>
            toast.error(error.message || fallbackMessage),
    });
}

export function useUpdateProfile() {
    return useProfileMutation(
        (data: UpdateProfilePayload) => profileApi.updateProfile(data),
        'Update failed',
    );
}

export function useUpdateProfilePhoto() {
    return useProfileMutation(
        (file: File) => profileApi.uploadAvatar(file),
        'Failed to update photo',
    );
}

/**
 * Removing a photo is its own endpoint, not the same one called with null, so
 * it is its own mutation. Folding both into one `File | null` signature hid two
 * different requests behind one name.
 */
export function useRemoveProfilePhoto() {
    return useProfileMutation(
        () => profileApi.removeAvatar(),
        'Failed to remove photo',
    );
}

export function useDisconnectAccount() {
    return useProfileMutation(
        (provider: string) => profileApi.disconnect(provider),
        'Failed to disconnect',
    );
}

/**
 * Deleting your own account.
 *
 * Deliberately not a `useProfileMutation`: it returns a message rather than a
 * profile, and on success there is no cache to update because there is no
 * longer an account. The caller sends the person to the sign-in screen.
 */
export function useDeleteAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (confirmEmail: string) =>
            profileApi.deleteAccount(confirmEmail),
        onSuccess: () => {
            // Every query in the app is now about an account that no longer
            // exists. Clearing beats invalidating: an invalidation would refetch
            // them all, against a session the API has just destroyed.
            queryClient.clear();
        },
    });
}
