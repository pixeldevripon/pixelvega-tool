import { apiRequest } from "@/lib/api/client";
import type {
  AvailabilityStatus,
  EmployeeWorkStatus,
  UserProfile,
} from "@/types/auth";

export type UpdateProfileInput = {
  name?: string;
  designation?: string;
  phone?: string;
  timezone?: string;
  bio?: string;
  currentStatus?: EmployeeWorkStatus;
  availabilityStatus?: AvailabilityStatus;
  companyName?: string;
  billingEmail?: string;
};

export const profilesApi = {
  me() {
    return apiRequest<UserProfile>("/api/profiles/me");
  },

  updateMe(input: UpdateProfileInput) {
    return apiRequest<UserProfile>("/api/profiles/me", {
      method: "PATCH",
      body: input,
    });
  },

  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest<UserProfile>("/api/profiles/me/avatar", {
      method: "POST",
      body: formData,
      timeoutMs: 30_000,
    });
  },

  findByUserId(userId: string) {
    return apiRequest<UserProfile>(`/api/profiles/${userId}`);
  },
};
