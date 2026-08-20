import { apiDownload, apiRequest } from "@/lib/api/client";
import type { AppUser } from "@/types/auth";

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

function unwrapList<T>(result: T[] | PaginatedResponse<T>) {
  return Array.isArray(result) ? result : result.items;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveType = {
  id: string;
  name: string;
  defaultDaysPerYear: number;
  createdAt: string;
  updatedAt: string;
};

export type LeaveRequest = {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string | null;
  status: LeaveStatus;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leaveType?: LeaveType;
  user?: Pick<AppUser, "id" | "name" | "email" | "role">;
};

export type LeaveBalance = {
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  leaveType: LeaveType;
};

export type Holiday = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  days: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateLeaveRequestInput = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
};

export type UpsertLeaveTypeInput = {
  name: string;
  defaultDaysPerYear: number;
};

export type UpsertHolidayInput = {
  name: string;
  startDate: string;
  endDate?: string;
};

export type LeaveSummaryRole = "PROJECT_MANAGER" | "DEVELOPER" | "DESIGNER";

export type LeaveSummaryQuery = {
  startDate?: string;
  endDate?: string;
  role?: LeaveSummaryRole[];
  userId?: string;
  includeDetails?: boolean;
};

export type LeaveSummaryRequest = {
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
};

export type LeaveSummaryUser = {
  userId: string;
  name: string;
  email: string;
  role: LeaveSummaryRole;
  byLeaveType: Record<string, number>;
  totalDays: number;
  requests?: LeaveSummaryRequest[];
};

export type LeaveSummaryResponse = {
  startDate: string;
  endDate: string;
  leaveTypes: Array<{ id: string; name: string }>;
  users: LeaveSummaryUser[];
  grandTotalDays: number;
};

function buildSummaryQuery(query: LeaveSummaryQuery = {}) {
  const params = new URLSearchParams();
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  if (query.role?.length) params.set("role", query.role.join(","));
  if (query.userId) params.set("userId", query.userId);
  if (query.includeDetails) params.set("includeDetails", "true");
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const leaveApi = {
  listTypes() {
    return apiRequest<LeaveType[]>("/api/leave/types");
  },

  createType(input: UpsertLeaveTypeInput) {
    return apiRequest<LeaveType>("/api/leave/types", {
      method: "POST",
      body: input,
    });
  },

  updateType(leaveTypeId: string, input: Partial<UpsertLeaveTypeInput>) {
    return apiRequest<LeaveType>(`/api/leave/types/${leaveTypeId}`, {
      method: "PATCH",
      body: input,
    });
  },

  deleteType(leaveTypeId: string) {
    return apiRequest<{ message: string }>(`/api/leave/types/${leaveTypeId}`, {
      method: "DELETE",
    });
  },

  listHolidays() {
    return apiRequest<Holiday[]>("/api/leave/holidays");
  },

  createHoliday(input: UpsertHolidayInput) {
    return apiRequest<Holiday>("/api/leave/holidays", {
      method: "POST",
      body: input,
    });
  },

  updateHoliday(holidayId: string, input: Partial<UpsertHolidayInput>) {
    return apiRequest<Holiday>(`/api/leave/holidays/${holidayId}`, {
      method: "PATCH",
      body: input,
    });
  },

  deleteHoliday(holidayId: string) {
    return apiRequest<{ message: string }>(`/api/leave/holidays/${holidayId}`, {
      method: "DELETE",
    });
  },

  createRequest(input: CreateLeaveRequestInput) {
    return apiRequest<LeaveRequest>("/api/leave/requests", {
      method: "POST",
      body: input,
    });
  },

  listOwnRequests() {
    return apiRequest<LeaveRequest[]>("/api/leave/requests/me");
  },

  listOwnBalance() {
    return apiRequest<LeaveBalance[]>("/api/leave/balances/me");
  },

  listBalanceForUser(userId: string) {
    return apiRequest<LeaveBalance[]>(`/api/leave/requests/${userId}/balance`);
  },

  cancelRequest(requestId: string) {
    return apiRequest<LeaveRequest>(`/api/leave/requests/${requestId}/cancel`, {
      method: "PATCH",
    });
  },

  async listRequestsForReview(userId?: string) {
    const params = new URLSearchParams({ pageSize: "100" });
    if (userId) params.set("userId", userId);
    const result = await apiRequest<
      LeaveRequest[] | PaginatedResponse<LeaveRequest>
    >(`/api/leave/requests?${params.toString()}`);
    return unwrapList(result);
  },

  approveRequest(requestId: string) {
    return apiRequest<LeaveRequest>(`/api/leave/requests/${requestId}/approve`, {
      method: "PATCH",
    });
  },

  rejectRequest(requestId: string, reason?: string) {
    return apiRequest<LeaveRequest>(`/api/leave/requests/${requestId}/reject`, {
      method: "PATCH",
      body: { reason },
    });
  },

  summary(query?: LeaveSummaryQuery) {
    return apiRequest<LeaveSummaryResponse>(
      `/api/leave/requests/summary${buildSummaryQuery(query)}`,
    );
  },

  exportSummary(query?: LeaveSummaryQuery) {
    return apiDownload(
      `/api/leave/requests/summary/export${buildSummaryQuery(query)}`,
    );
  },
};
