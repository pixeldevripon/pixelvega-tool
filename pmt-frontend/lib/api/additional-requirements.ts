import { apiRequest } from "@/lib/api/client";
import type { AppUser } from "@/types/auth";

export type AdditionalRequirementStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type AdditionalRequirement = {
  id: string;
  projectId: string;
  description: string;
  sourceChannel?: string | null;
  aiScopeAnalysis?: Record<string, unknown> | null;
  status: AdditionalRequirementStatus;
  uploadedById: string;
  uploadedBy?: Pick<AppUser, "id" | "name" | "email"> | null;
  reviewedById?: string | null;
  reviewedBy?: Pick<AppUser, "id" | "name" | "email"> | null;
  reviewedAt?: string | null;
  approvedAdditionalHours?: number | null;
  deadlineExtensionDays?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdditionalRequirementsResponse = {
  items: AdditionalRequirement[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdditionalRequirementsQuery = {
  page?: number;
  pageSize?: number;
  status?: AdditionalRequirementStatus | "ALL";
};

export type CreateAdditionalRequirementInput = {
  description: string;
  sourceChannel?: string;
};

export type ReviewAdditionalRequirementInput = {
  decision: "APPROVED" | "REJECTED";
  approvedAdditionalHours?: number;
  deadlineExtensionDays?: number;
};

function buildQuery(query: AdditionalRequirementsQuery = {}) {
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status && query.status !== "ALL") params.set("status", query.status);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const additionalRequirementsApi = {
  async list(projectId: string, query?: AdditionalRequirementsQuery) {
    return apiRequest<AdditionalRequirementsResponse>(
      `/api/projects/${projectId}/additional-requirements${buildQuery(query)}`,
    );
  },

  async create(projectId: string, input: CreateAdditionalRequirementInput) {
    return apiRequest<AdditionalRequirement>(
      `/api/projects/${projectId}/additional-requirements`,
      { method: "POST", body: input },
    );
  },

  async review(
    projectId: string,
    requirementId: string,
    input: ReviewAdditionalRequirementInput,
  ) {
    return apiRequest<AdditionalRequirement>(
      `/api/projects/${projectId}/additional-requirements/${requirementId}/review`,
      { method: "PATCH", body: input },
    );
  },
};
