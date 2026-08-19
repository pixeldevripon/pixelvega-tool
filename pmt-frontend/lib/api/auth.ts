import { apiRequest } from "@/lib/api/client";
import type { AppUser, LoginResult } from "@/types/auth";

type LoginResponse = {
  user: AppUser;
};

type SessionResponse = {
  user: AppUser | null;
};

export const authApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const result = await apiRequest<LoginResponse>("/api/auth/sign-in/email", {
      method: "POST",
      body: { email, password },
    });

    return {
      user: result.user,
      requiresPasswordChange: result.user.mustResetPassword,
    };
  },

  async logout() {
    await apiRequest("/api/auth/sign-out", { method: "POST" });
  },

  async getSessionUser() {
    const result = await apiRequest<SessionResponse>("/api/auth/get-session");
    return result.user;
  },

  async requestPasswordOtp(email: string) {
    return apiRequest<{ message: string }>("/api/auth-flows/forgot-password", {
      method: "POST",
      body: { email },
    });
  },

  async verifyOtp(email: string, code: string) {
    return apiRequest<{ resetToken: string }>(
      "/api/auth-flows/verify-reset-code",
      {
        method: "POST",
        body: { email, code },
      },
    );
  },

  async resetPassword(resetToken: string, newPassword: string) {
    return apiRequest<{ message: string }>("/api/auth-flows/reset-password", {
      method: "POST",
      body: { resetToken, newPassword },
    });
  },
};
