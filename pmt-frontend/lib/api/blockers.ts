import { apiRequest } from "@/lib/api/client";
import type { AppUser } from "@/types/auth";

export type BlockerStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type BlockerSeverity = "LOW" | "MEDIUM" | "HIGH";

export type BlockerReason = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Blocker = {
  id: string;
  projectId: string;
  project?: { id: string; name: string; slackChannelId?: string | null } | null;
  description: string;
  status: BlockerStatus;
  severity: BlockerSeverity;
  reasonId: string;
  reason?: BlockerReason | null;
  reportedById: string;
  reportedBy?: Pick<AppUser, "id" | "name" | "email"> | null;
  assignedToId?: string | null;
  assignedTo?: Pick<AppUser, "id" | "name" | "email"> | null;
  assignedAt?: string | null;
  resolvedById?: string | null;
  resolvedBy?: Pick<AppUser, "id" | "name" | "email"> | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  deadlineExtensionDays?: number | null;
  createdAt: string;
  updatedAt: string;
  resolutionTime?: number;
  daysOpen?: number;
  causedDeadlineExtension?: boolean;
};

export type BlockerListResponse = {
  items: Blocker[];
  total: number;
  page: number;
  pageSize: number;
};

export type BlockerQuery = {
  page?: number;
  pageSize?: number;
  status?: BlockerStatus | "ALL";
  severity?: BlockerSeverity | "ALL";
  projectId?: string;
  assignedToId?: string;
};

export type CreateBlockerInput = {
  projectId: string;
  description: string;
  severity?: BlockerSeverity;
  reasonId?: string;
};

export type UpdateBlockerInput = {
  description?: string;
  severity?: BlockerSeverity;
  reasonId?: string;
  status?: BlockerStatus;
  assignedToId?: string;
  resolutionNotes?: string;
  deadlineExtensionDays?: number;
};

function buildQuery(query: BlockerQuery = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  if (query.severity && query.severity !== "ALL") {
    params.set("severity", query.severity);
  }
  if (query.projectId) params.set("projectId", query.projectId);
  if (query.assignedToId) params.set("assignedToId", query.assignedToId);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const blockersApi = {
  async list(query?: BlockerQuery) {
    return apiRequest<BlockerListResponse>(`/api/blockers${buildQuery(query)}`);
  },

  async listForProject(projectId: string, query?: Omit<BlockerQuery, "projectId">) {
    return apiRequest<BlockerListResponse>(
      `/api/projects/${projectId}/blockers${buildQuery(query)}`,
    );
  },

  async deadlineImpact(projectId: string) {
    return apiRequest<{
      resolvedCount: number;
      totalResolutionMinutes: number;
      totalDeadlineExtensionDays: number;
      blockersWithExtension: number;
    }>(`/api/projects/${projectId}/blockers/deadline-impact`);
  },

  async create(input: CreateBlockerInput) {
    return apiRequest<Blocker>("/api/blockers", {
      method: "POST",
      body: input,
    });
  },

  async update(blockerId: string, input: UpdateBlockerInput) {
    return apiRequest<Blocker>(`/api/blockers/${blockerId}`, {
      method: "PATCH",
      body: input,
    });
  },

  async reasons() {
    return apiRequest<BlockerReason[]>("/api/blocker-reasons");
  },

  async createReason(name: string) {
    return apiRequest<BlockerReason>("/api/blocker-reasons", {
      method: "POST",
      body: { name },
    });
  },

  async updateReason(reasonId: string, name: string) {
    return apiRequest<BlockerReason>(`/api/blocker-reasons/${reasonId}`, {
      method: "PATCH",
      body: { name },
    });
  },

  async removeReason(reasonId: string) {
    return apiRequest<{ message: string }>(`/api/blocker-reasons/${reasonId}`, {
      method: "DELETE",
    });
  },
};

