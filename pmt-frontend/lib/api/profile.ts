import type { UpdateProfilePayload, UserProfile } from '@/types/profile';

import { apiFetch } from './fetch';

/**
 * Profile page API. Deliberately thin since the 2026-07-28 redesign: the page
 * shows name/avatar/email/account-details only, so one `/users/me` read and
 * one PATCH cover it.
 */
export const profileApi = {
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
   * Clear the avatar.
   *
   * A PATCH rather than a DELETE on the avatar route: the backend deletes the
   * stored Cloudinary asset as a side effect of the profile update, and there
   * is no separate avatar resource to remove.
   */
  removeAvatar(): Promise<UserProfile> {
    return apiFetch<UserProfile>('/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl: null }),
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
};
