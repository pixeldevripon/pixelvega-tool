import {
  DailyProjectEntry,
  DailyWorkReport,
  DailyWorkReportStatus,
  Project,
  User,
} from '@prisma/client';

import {
  DAILY_WORK_REPORT_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

import {
  DailyProjectEntryResponseDto,
  DailyWorkReportResponseDto,
  ProjectDailyEntryResponseDto,
} from './dto/daily-work-report.dto';

/** A wrap up may be corrected for two hours after it is submitted. */
export const WRAP_UP_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

type ReportUser = Pick<User, 'id' | 'name' | 'email'>;

export type DailyProjectEntryWithRelations = DailyProjectEntry & {
  project?: Pick<Project, 'id' | 'name'>;
  reviewedBy?: ReportUser | null;
};

export type DailyWorkReportWithRelations = DailyWorkReport & {
  user?: ReportUser;
  entries: DailyProjectEntryWithRelations[];
};

export type WorkReportContext = {
  callerId: string;
};

// ════════════════════════════════════════════════════════════════════════════
// The edit windows
// ════════════════════════════════════════════════════════════════════════════
//
// These were private methods on DailyWorkReportService, used only to throw. A
// capability flag has to answer the same question a moment earlier, and the one
// thing that must never happen is the two disagreeing: a UI offering an edit
// that the service then refuses. So they are pure functions here, and the
// service asserts with them rather than keeping its own copy.

/** A submitted wrap up locks the plan, on the grounds that the day is over. */
export function canEditPlan(report: {
  status: DailyWorkReportStatus;
}): boolean {
  return report.status === DailyWorkReportStatus.PLAN_SUBMITTED;
}

/**
 * A wrap up is correctable for two hours, then it is history.
 *
 * `now` is a parameter rather than a call to `Date.now()` so the boundary is
 * testable at the millisecond, which is where a window like this goes wrong.
 */
export function canEditWrapUp(
  report: { status: DailyWorkReportStatus; wrapUpSubmittedAt: Date | null },
  now: number = Date.now(),
): boolean {
  if (
    report.status !== DailyWorkReportStatus.COMPLETED ||
    !report.wrapUpSubmittedAt
  ) {
    return false;
  }
  return now - report.wrapUpSubmittedAt.getTime() < WRAP_UP_EDIT_WINDOW_MS;
}

/** The wrap up is still owed while only the plan has been submitted. */
export function canSubmitWrapUp(report: {
  status: DailyWorkReportStatus;
}): boolean {
  return report.status === DailyWorkReportStatus.PLAN_SUBMITTED;
}

// ════════════════════════════════════════════════════════════════════════════
// Mappers
// ════════════════════════════════════════════════════════════════════════════

/** A `@db.Date` column is a calendar day. Render it as one, never as an instant. */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toDailyProjectEntryResponse(
  entry: DailyProjectEntryWithRelations,
  authorId: string,
  context: WorkReportContext,
): DailyProjectEntryResponseDto {
  return {
    id: entry.id,
    dailyWorkReportId: entry.dailyWorkReportId,
    projectId: entry.projectId,
    ...(entry.project && { project: entry.project }),
    plan: entry.plan,
    accomplishments: entry.accomplishments,
    hasPlan: entry.plan !== null && entry.plan !== '',
    hasWrapUp: entry.accomplishments !== null && entry.accomplishments !== '',
    reviewedBy: entry.reviewedBy ?? null,
    reviewedAt: entry.reviewedAt,
    reviewComment: entry.reviewComment,
    isReviewed: entry.reviewedAt !== null,
    capabilities: {
      // Reviewing your own work report is not a review. Whether the caller has
      // the REVIEW_WORK_REPORT permission at all is the guard's question; this
      // is the part the guard cannot answer.
      canReview: context.callerId !== authorId,
    },
  };
}

export function toDailyWorkReportResponse(
  report: DailyWorkReportWithRelations,
  context: WorkReportContext,
): DailyWorkReportResponseDto {
  const isAuthor = report.userId === context.callerId;

  return {
    id: report.id,
    userId: report.userId,
    ...(report.user && { user: report.user }),
    date: toDateOnlyString(report.date),
    status: toEnumDisplay(DAILY_WORK_REPORT_STATUS_DISPLAY, report.status),
    planSubmittedAt: report.planSubmittedAt,
    wrapUpSubmittedAt: report.wrapUpSubmittedAt,
    entries: report.entries.map((entry) =>
      toDailyProjectEntryResponse(entry, report.userId, context),
    ),
    entryCount: report.entries.length,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    capabilities: {
      // Every edit here is the author's alone. An admin correcting a locked
      // wrap up is a conversation, not a button.
      canEditPlan: isAuthor && canEditPlan(report),
      canEditWrapUp: isAuthor && canEditWrapUp(report),
      canSubmitWrapUp: isAuthor && canSubmitWrapUp(report),
    },
  };
}

/** The project scoped view lifts the report's day and author onto each entry. */
export function toProjectDailyEntryResponse(
  entry: DailyProjectEntryWithRelations & {
    dailyWorkReport: { date: Date; userId: string; user: ReportUser };
  },
  context: WorkReportContext,
): ProjectDailyEntryResponseDto {
  return {
    ...toDailyProjectEntryResponse(
      entry,
      entry.dailyWorkReport.userId,
      context,
    ),
    date: toDateOnlyString(entry.dailyWorkReport.date),
    author: entry.dailyWorkReport.user,
  };
}
