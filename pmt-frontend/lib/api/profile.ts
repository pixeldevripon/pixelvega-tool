import type {
    ProfileOptions,
    UpdateProfilePayload,
    UserProfile,
} from '@/types/profile';

import { apiFetch } from './fetch';

/** One function per endpoint on `/profiles`. No logic, no shaping. */
export const profileApi = {
    /**
     * Reference data for the account form: the country and gender lists, every
     * role, the password policy and the two limits the copy quotes.
     *
     * Its own call rather than fields on the profile: it is identical for every
     * caller and changes only when the API is deployed, so it is cached for the
     * session instead of refetching 249 countries beside every profile read.
     */
    getOptions(): Promise<ProfileOptions> {
        return apiFetch<ProfileOptions>('/profiles/options');
    },

    getProfile(): Promise<UserProfile> {
        return apiFetch<UserProfile>('/profiles/me');
    },

    updateProfile(data: UpdateProfilePayload): Promise<UserProfile> {
        return apiFetch<UserProfile>('/profiles/me', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    /**
     * One uploader, on the backend. `POST /profiles/me/avatar` takes the file
     * itself and returns the stored profile, so there is no media-library step
     * and no URL for the client to carry between two calls.
     */
    uploadAvatar(file: File): Promise<UserProfile> {
        const body = new FormData();
        body.append('file', file);
        return apiFetch<UserProfile>('/profiles/me/avatar', {
            method: 'POST',
            body,
        });
    },

    /**
     * Its own route rather than a PATCH with `avatarUrl: null`.
     *
     * Removing an avatar destroys the stored Cloudinary asset, which is a side
     * effect outside the database, and a PATCH that otherwise only writes
     * columns should not hide one.
     */
    removeAvatar(): Promise<UserProfile> {
        return apiFetch<UserProfile>('/profiles/me/avatar', {
            method: 'DELETE',
        });
    },

    /** Only SLACK can be removed; the API refuses the credential account. */
    disconnect(provider: string): Promise<UserProfile> {
        return apiFetch<UserProfile>(
            `/profiles/me/connections/${encodeURIComponent(provider)}`,
            { method: 'DELETE' },
        );
    },

    /**
     * The typed email is not a security control (the session already proves who
     * is asking). It is a deliberate pause on an action with no undo, and the
     * API compares it against the account's own address.
     */
    deleteAccount(confirmEmail: string): Promise<{ message: string }> {
        return apiFetch<{ message: string }>('/profiles/me', {
            method: 'DELETE',
            body: JSON.stringify({ confirmEmail }),
        });
    },
};
