import { apiRequest } from "@/lib/api/client";

export type DailyWorkReportStatus = "PLAN_SUBMITTED" | "COMPLETED";
export type DailyEntryType = "PLAN" | "WRAP_UP";

export type DailyReportProject = {
  id: string;
  name: string;
};

export type DailyWorkEntry = {
  id: string;
  projectId: string;
  project: DailyReportProject;
  plan?: string | null;
  accomplishments?: string | null;
  reviewedById?: string | null;
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
};

export type DailyWorkReport = {
  id: string;
  userId: string;
  date: string;
  status: DailyWorkReportStatus;
  planSubmittedAt?: string | null;
  wrapUpSubmittedAt?: string | null;
  entries: DailyWorkEntry[];
};

export type DailyWorkReportsResponse = {
  items: DailyWorkReport[];
  total: number;
  page: number;
  pageSize: number;
};

export type DailyWorkReportsQuery = {
  page?: number;
  pageSize?: number;
  userId?: string;
  startDate?: string;
  endDate?: string;
  type?: DailyEntryType | "ALL";
};

export type ProjectDailyWorkEntry = {
  id: string;
  projectId: string;
  plan?: string | null;
  accomplishments?: string | null;
  reviewedById?: string | null;
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  dailyWorkReport: {
    date: string;
    status: DailyWorkReportStatus;
    userId: string;
    user?: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
};

export type ProjectDailyWorkEntriesResponse = {
  items: ProjectDailyWorkEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProjectDailyWorkEntriesQuery = {
  page?: number;
  pageSize?: number;
  userId?: string;
  startDate?: string;
  endDate?: string;
  type?: DailyEntryType | "ALL";
};

export type DailyPlanEntryInput = {
  projectId: string;
  plan: string;
};

export type DailyWrapUpEntryInput = {
  projectId: string;
  accomplishments: string;
};

function buildQuery(query: DailyWorkReportsQuery = {}) {
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.userId) params.set("userId", query.userId);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  if (query.type && query.type !== "ALL") params.set("type", query.type);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const dailyWorkReportsApi = {
  today() {
    return apiRequest<DailyWorkReport | null>("/api/daily-work-reports/today");
  },

  list(query?: DailyWorkReportsQuery) {
    return apiRequest<DailyWorkReportsResponse>(
      `/api/daily-work-reports${buildQuery(query)}`,
    );
  },

  projectHistory(
    projectId: string,
    query?: ProjectDailyWorkEntriesQuery,
  ) {
    return apiRequest<ProjectDailyWorkEntriesResponse>(
      `/api/projects/${projectId}/daily-work-reports${buildQuery(query)}`,
    );
  },

  submitPlan(entries: DailyPlanEntryInput[]) {
    return apiRequest<DailyWorkReport>("/api/daily-work-reports", {
      method: "POST",
      body: { entries },
    });
  },

  updatePlan(reportId: string, entries: DailyPlanEntryInput[]) {
    return apiRequest<DailyWorkReport>(
      `/api/daily-work-reports/${reportId}/plan`,
      { method: "PATCH", body: { entries } },
    );
  },

  submitWrapUp(reportId: string, entries: DailyWrapUpEntryInput[]) {
    return apiRequest<DailyWorkReport>(
      `/api/daily-work-reports/${reportId}/wrap-up`,
      { method: "POST", body: { entries } },
    );
  },

  updateWrapUp(reportId: string, entries: DailyWrapUpEntryInput[]) {
    return apiRequest<DailyWorkReport>(
      `/api/daily-work-reports/${reportId}/wrap-up`,
      { method: "PATCH", body: { entries } },
    );
  },

  reviewEntry(
    reportId: string,
    entryId: string,
    reviewComment?: string,
  ) {
    return apiRequest<DailyWorkEntry>(
      `/api/daily-work-reports/${reportId}/entries/${entryId}/review`,
      {
        method: "PATCH",
        body: { reviewComment: reviewComment || undefined },
      },
    );
  },
};
