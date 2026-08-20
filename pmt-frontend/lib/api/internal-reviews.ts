import { apiRequest } from "@/lib/api/client";
import type { AppUser } from "@/types/auth";

export type InternalReviewDecision = "APPROVED" | "CHANGES_REQUIRED";

export type InternalReview = {
  id: string;
  projectId: string;
  reviewedById: string;
  reviewedBy?: Pick<AppUser, "id" | "name" | "email"> | null;
  decision: InternalReviewDecision;
  comments?: string | null;
  reviewRound: number;
  createdAt: string;
};

export type InternalReviewsResponse = {
  items: InternalReview[];
  total: number;
  page: number;
  pageSize: number;
};

export const internalReviewsApi = {
  list(projectId: string, page = 1, pageSize = 20) {
    return apiRequest<InternalReviewsResponse>(
      `/api/projects/${projectId}/reviews/internal?page=${page}&pageSize=${pageSize}`,
    );
  },

  create(
    projectId: string,
    input: { decision: InternalReviewDecision; comments?: string },
  ) {
    return apiRequest<InternalReview>(
      `/api/projects/${projectId}/reviews/internal`,
      { method: "POST", body: input },
    );
  },
};
