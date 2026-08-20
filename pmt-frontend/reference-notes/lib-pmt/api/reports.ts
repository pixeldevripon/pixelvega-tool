import { apiRequest } from "@/lib/api/client";

export type ReportRange = {
  startDate: string;
  endDate: string;
};

export type DeveloperReportQuery = ReportRange & {
  userId?: string;
  projectId?: string;
};

export type ProjectReportQuery = ReportRange;

export type DeveloperReport = {
  userId: string;
  projectId: string | null;
  range: ReportRange;
  projectHours: number;
  meetingHours: number;
  totalHours: number;
  hoursByProject: Array<{
    projectId: string;
    projectName: string | null;
    totalMinutes: number;
    totalHours: number;
  }>;
  hoursByDay: Array<{
    date: string;
    projectMinutes: number;
    meetingMinutes: number;
    totalMinutes: number;
  }>;
  workingDaysInRange: number;
  hoursGoalRate: number | null;
  dailyWorkReportCompliance: {
    daysPlanned: number;
    daysWrappedUp: number;
    planFollowThroughRate: number | null;
    openPlansWithoutWrapUp: number;
    planningCoverageRate: number | null;
  };
  blockersReported: number;
  blockersResolved: number;
  averageResolutionMinutes: number | null;
  leaveDaysTaken: number;
  projectsTouched: Array<{
    projectId: string;
    projectName: string | null;
    active: boolean;
  }>;
};

export type ProjectReport = {
  status: string;
  priority: string;
  estimatedHours: number | null;
  actualHours: number;
  remainingHours: number | null;
  plannedStartDate: string | null;
  deadline: string | null;
  roster: Array<{ userId: string; name: string; role: string }>;
  internalReviewFirstRoundApproved: boolean | null;
  clientFeedbackFirstRoundApproved: boolean | null;
  range: ReportRange;
  hoursByMember: Array<{ userId: string; name: string; hours: number }>;
  statusChanges: Array<{
    changedAt: string;
    from: string | null;
    to: string | null;
  }>;
  staffingChanges: { joined: number; left: number };
  blockers: {
    openedCount: number;
    resolvedCount: number;
    openedBySeverity: Record<string, number>;
    resolvedBySeverity: Record<string, number>;
    averageResolutionMinutes: number | null;
    currentlyOpenCount: number;
    currentlyOpenAverageDaysOpen: number | null;
    deadlineExtensionCount: number;
  };
  additionalRequirements: {
    receivedCount: number;
    approvedCount: number;
    rejectedCount: number;
    totalApprovedAdditionalHours: number;
    totalDeadlineExtensionDays: number;
  };
  internalReview: { approvedCount: number; changesRequiredCount: number };
  clientFeedback: { approvedCount: number; changesRequestedCount: number };
  workingDaysInRange: number;
  dailyWorkReportCompliance: {
    daysPlanned: number;
    daysWrappedUp: number;
    planFollowThroughRate: number | null;
    planningCoverageRate: number | null;
  };
};

function buildQuery(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const reportsApi = {
  developer(query: DeveloperReportQuery) {
    return apiRequest<DeveloperReport>(
      `/api/reports/developers${buildQuery(query)}`,
    );
  },

  project(projectId: string, query: ProjectReportQuery) {
    return apiRequest<ProjectReport>(
      `/api/projects/${projectId}/reports${buildQuery(query)}`,
    );
  },
};
