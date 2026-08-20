import { apiRequest } from "@/lib/api/client";
import type { AppUser, InviteUserInput } from "@/types/auth";

type BackendUser = AppUser;
type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

function unwrapList<T>(result: T[] | PaginatedResponse<T>) {
  return Array.isArray(result) ? result : result.items;
}

export const usersApi = {
  async me() {
    return apiRequest<BackendUser>("/api/users/me");
  },

  async list() {
    const result = await apiRequest<BackendUser[] | PaginatedResponse<BackendUser>>(
      "/api/users?pageSize=100",
    );
    return unwrapList(result);
  },

  async findOne(userId: string) {
    return apiRequest<BackendUser>(`/api/users/${userId}`);
  },

  async invite(input: InviteUserInput) {
    return apiRequest<BackendUser>("/api/users/invite", {
      method: "POST",
      body: input,
    });
  },

  async update(userId: string, updates: Partial<AppUser>) {
    return apiRequest<BackendUser>(`/api/users/${userId}`, {
      method: "PATCH",
      body: {
        name: updates.name,
        role: updates.role === "SYSTEM_ADMIN" ? undefined : updates.role,
        status: updates.status,
        slackUserId: updates.slackUserId?.trim() || undefined,
      },
    });
  },

  async remove(userId: string) {
    return apiRequest<{ message: string }>(`/api/users/${userId}`, {
      method: "DELETE",
    });
  },

  // better-auth's own route. The PATCH /users/me/password wrapper that used to
  // back this was deleted: it was a second door onto one action with different
  // security properties. An after hook on the API side clears
  // mustResetPassword and writes the audit entry.
  async changePassword(currentPassword: string, newPassword: string) {
    return apiRequest<{ user: unknown }>("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },
};
