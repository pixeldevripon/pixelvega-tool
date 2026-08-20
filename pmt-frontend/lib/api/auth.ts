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

  // better-auth's own route. The /auth-flows controller this used to call was
  // deleted along with its bespoke PasswordResetCode table.
  async requestPasswordReset(email: string) {
    return apiRequest<{ status: boolean; message: string }>(
      "/api/auth/request-password-reset",
      { method: "POST", body: { email } },
    );
  },

  // NOTE: there is no verify-code step any more. The API emails a single use
  // LINK carrying a token, so the flow is: request a reset, follow the link to
  // /reset-password?token=..., submit the new password with that token. The
  // /enter-otp screen and the code entry it drives are dead, and a
  // /reset-password page does not exist yet. Both are frontend work.
  async resetPassword(token: string, newPassword: string) {
    return apiRequest<{ status: boolean }>("/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
    });
  },
};
