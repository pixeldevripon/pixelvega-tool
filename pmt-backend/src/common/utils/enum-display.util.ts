import {
  AdditionalRequirementStatus,
  AiJobStatus,
  AiJobType,
  AiTemplateKind,
  AvailabilityStatus,
  BlockerSeverity,
  BlockerStatus,
  ClientFeedbackDecision,
  DailyWorkReportStatus,
  EmployeeWorkStatus,
  InternalReviewDecision,
  LeaveStatus,
  NotificationType,
  ProjectActivityType,
  ProjectDocumentFormat,
  ProjectDocumentType,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
  ProjectType,
  Role,
  TimeEntryStatus,
  UserStatus,
} from '@prisma/client';

import { DisplayTone, EnumDisplayDto } from '@/common/dto/display.dto';

/**
 * The vocabulary: how every enum reads, and how severely it reads (ADR 0001).
 *
 * This file is the single place either question is answered. A screen that shows
 * a status shows what is written here, and a second API consumer gets the same
 * wording without re-deriving it.
 *
 * ── Why each map is typed `Record<TheEnum, EnumDisplayEntry>` ──
 * So that adding a member to a Prisma enum FAILS THE BUILD until someone decides
 * how it reads. A runtime spec could check the same thing, but only if whoever
 * added the member also remembered to extend the spec, which is the same
 * omission one level removed. The compiler does not forget.
 *
 * ── The tones are not invented here ──
 * They were read off the frontend's existing tone functions, which is where this
 * judgment already lived. Where the frontend had no opinion the tone is stated
 * fresh and the reasoning is in a comment.
 */
/**
 * Exported so a consumer can accept "any display map" without widening `tone`
 * to `string`, which would silently drop the closed five-tone union and let a
 * caller invent a sixth.
 */
export type EnumDisplayEntry = { label: string; tone: DisplayTone };

// ════════════════════════════════════════════════════════════════════════════
// Projects
// ════════════════════════════════════════════════════════════════════════════

/**
 * Tones lifted from `getStatusTone` in `projects-view.tsx`.
 *
 * The distinction worth keeping: ON_HOLD and WAITING_FOR_FEEDBACK are both
 * `warning` because both mean the project is stalled on someone. The difference
 * between them is whose turn it is, which the label carries, not the tone.
 */
export const PROJECT_STATUS_DISPLAY: Record<ProjectStatus, EnumDisplayEntry> = {
  [ProjectStatus.PLANNING]: { label: 'Planning', tone: 'default' },
  [ProjectStatus.SCHEDULED]: { label: 'Scheduled', tone: 'default' },
  [ProjectStatus.READY_FOR_WORK]: { label: 'Ready for work', tone: 'primary' },
  [ProjectStatus.IN_PROGRESS]: { label: 'In progress', tone: 'primary' },
  [ProjectStatus.ON_HOLD]: { label: 'On hold', tone: 'warning' },
  [ProjectStatus.INTERNAL_REVIEW]: {
    label: 'Internal review',
    tone: 'default',
  },
  [ProjectStatus.READY_FOR_CLIENT]: {
    label: 'Ready for client',
    tone: 'default',
  },
  [ProjectStatus.WAITING_FOR_FEEDBACK]: {
    label: 'Waiting for feedback',
    tone: 'warning',
  },
  [ProjectStatus.COMPLETED]: { label: 'Completed', tone: 'success' },
  [ProjectStatus.CANCELLED]: { label: 'Cancelled', tone: 'danger' },
};

/** Tones lifted from `getPriorityTone` in `projects-view.tsx`. */
export const PROJECT_PRIORITY_DISPLAY: Record<
  ProjectPriority,
  EnumDisplayEntry
> = {
  [ProjectPriority.LOW]: { label: 'Low', tone: 'default' },
  [ProjectPriority.MEDIUM]: { label: 'Medium', tone: 'primary' },
  [ProjectPriority.HIGH]: { label: 'High', tone: 'warning' },
  [ProjectPriority.URGENT]: { label: 'Urgent', tone: 'danger' },
  [ProjectPriority.CRITICAL]: { label: 'Critical', tone: 'danger' },
};

/**
 * Every project type is `default`.
 *
 * A type is what the work is, not how it is going, so tone would be noise. The
 * labels are the real payload here: `MERN_STACK` and `SEO` are the reason a
 * generic word splitter was never good enough.
 */
export const PROJECT_TYPE_DISPLAY: Record<ProjectType, EnumDisplayEntry> = {
  [ProjectType.WORDPRESS]: { label: 'WordPress', tone: 'default' },
  [ProjectType.WEBFLOW]: { label: 'Webflow', tone: 'default' },
  [ProjectType.WIX]: { label: 'Wix', tone: 'default' },
  [ProjectType.FRAMER]: { label: 'Framer', tone: 'default' },
  [ProjectType.FIGMA]: { label: 'Figma', tone: 'default' },
  [ProjectType.MERN_STACK]: { label: 'MERN stack', tone: 'default' },
  [ProjectType.SEO]: { label: 'SEO', tone: 'default' },
};

export const PROJECT_ROLE_DISPLAY: Record<ProjectRole, EnumDisplayEntry> = {
  [ProjectRole.PROJECT_MANAGER]: { label: 'Project manager', tone: 'default' },
  [ProjectRole.DEVELOPER]: { label: 'Developer', tone: 'default' },
  [ProjectRole.DESIGNER]: { label: 'Designer', tone: 'default' },
};

/**
 * `CREDENTIAL` is the only document type with a tone.
 *
 * It warns because the row holds secrets, so a reviewer should notice it in a
 * list. The rest are just kinds of file.
 */
export const PROJECT_DOCUMENT_TYPE_DISPLAY: Record<
  ProjectDocumentType,
  EnumDisplayEntry
> = {
  [ProjectDocumentType.PRD]: { label: 'PRD', tone: 'default' },
  [ProjectDocumentType.REQUIREMENT]: { label: 'Requirement', tone: 'default' },
  [ProjectDocumentType.MEETING_NOTE]: {
    label: 'Meeting note',
    tone: 'default',
  },
  [ProjectDocumentType.CREDENTIAL]: { label: 'Credential', tone: 'warning' },
  [ProjectDocumentType.ASSET]: { label: 'Asset', tone: 'default' },
  [ProjectDocumentType.DELIVERABLE]: { label: 'Deliverable', tone: 'success' },
};

export const PROJECT_DOCUMENT_FORMAT_DISPLAY: Record<
  ProjectDocumentFormat,
  EnumDisplayEntry
> = {
  [ProjectDocumentFormat.TEXT]: { label: 'Text', tone: 'default' },
  [ProjectDocumentFormat.FILE]: { label: 'File', tone: 'default' },
};

// ════════════════════════════════════════════════════════════════════════════
// People
// ════════════════════════════════════════════════════════════════════════════

/**
 * SYSTEM_ADMIN reads as `danger` and ADMIN as `primary`.
 *
 * Not because either is bad, but because a role badge in a user list is a
 * privilege warning: the eye should catch the root account before it catches
 * anything else on the row.
 */
export const ROLE_DISPLAY: Record<Role, EnumDisplayEntry> = {
  [Role.SYSTEM_ADMIN]: { label: 'System admin', tone: 'danger' },
  [Role.ADMIN]: { label: 'Admin', tone: 'primary' },
  [Role.PROJECT_MANAGER]: { label: 'Project manager', tone: 'default' },
  [Role.DEVELOPER]: { label: 'Developer', tone: 'default' },
  [Role.DESIGNER]: { label: 'Designer', tone: 'default' },
  [Role.CLIENT]: { label: 'Client', tone: 'default' },
};

/** Tones lifted from `statusTone` in `users-admin.tsx`. */
export const USER_STATUS_DISPLAY: Record<UserStatus, EnumDisplayEntry> = {
  [UserStatus.INVITED]: { label: 'Invited', tone: 'warning' },
  [UserStatus.ACTIVE]: { label: 'Active', tone: 'success' },
  [UserStatus.SUSPENDED]: { label: 'Suspended', tone: 'danger' },
};

export const EMPLOYEE_WORK_STATUS_DISPLAY: Record<
  EmployeeWorkStatus,
  EnumDisplayEntry
> = {
  [EmployeeWorkStatus.WORKING]: { label: 'Working', tone: 'success' },
  [EmployeeWorkStatus.ON_LEAVE]: { label: 'On leave', tone: 'warning' },
};

export const AVAILABILITY_STATUS_DISPLAY: Record<
  AvailabilityStatus,
  EnumDisplayEntry
> = {
  [AvailabilityStatus.AVAILABLE]: { label: 'Available', tone: 'success' },
  [AvailabilityStatus.BUSY]: { label: 'Busy', tone: 'warning' },
  [AvailabilityStatus.UNAVAILABLE]: { label: 'Unavailable', tone: 'danger' },
};

/** Tones lifted from `statusTone` in `leave-requests-view.tsx`. */
export const LEAVE_STATUS_DISPLAY: Record<LeaveStatus, EnumDisplayEntry> = {
  [LeaveStatus.PENDING]: { label: 'Pending', tone: 'warning' },
  [LeaveStatus.APPROVED]: { label: 'Approved', tone: 'success' },
  [LeaveStatus.REJECTED]: { label: 'Rejected', tone: 'danger' },
  [LeaveStatus.CANCELLED]: { label: 'Cancelled', tone: 'default' },
};

// ════════════════════════════════════════════════════════════════════════════
// Delivery
// ════════════════════════════════════════════════════════════════════════════

export const TIME_ENTRY_STATUS_DISPLAY: Record<
  TimeEntryStatus,
  EnumDisplayEntry
> = {
  [TimeEntryStatus.RUNNING]: { label: 'Running', tone: 'success' },
  [TimeEntryStatus.PAUSED]: { label: 'Paused', tone: 'warning' },
  [TimeEntryStatus.STOPPED]: { label: 'Stopped', tone: 'default' },
};

/**
 * DRAFT is `default`, not `warning`.
 *
 * The frontend rendered anything that was not COMPLETED as a warning, which made
 * a report someone is still writing look like a problem. Only a submitted plan
 * with no wrap up is actually outstanding.
 */
export const DAILY_WORK_REPORT_STATUS_DISPLAY: Record<
  DailyWorkReportStatus,
  EnumDisplayEntry
> = {
  [DailyWorkReportStatus.DRAFT]: { label: 'Draft', tone: 'default' },
  [DailyWorkReportStatus.PLAN_SUBMITTED]: {
    label: 'Plan submitted',
    tone: 'warning',
  },
  [DailyWorkReportStatus.COMPLETED]: { label: 'Completed', tone: 'success' },
};

/**
 * An OPEN blocker is `danger`, which no frontend map said.
 *
 * The frontend only ever toned blocker SEVERITY. But an open blocker is work
 * that has stopped, and a list where an open blocker and a resolved one read the
 * same weight is a list nobody triages from.
 */
export const BLOCKER_STATUS_DISPLAY: Record<BlockerStatus, EnumDisplayEntry> = {
  [BlockerStatus.OPEN]: { label: 'Open', tone: 'danger' },
  [BlockerStatus.IN_PROGRESS]: { label: 'In progress', tone: 'warning' },
  [BlockerStatus.RESOLVED]: { label: 'Resolved', tone: 'success' },
};

/** Tones lifted from `severityTone` in `blockers-dashboard.tsx`. */
export const BLOCKER_SEVERITY_DISPLAY: Record<
  BlockerSeverity,
  EnumDisplayEntry
> = {
  [BlockerSeverity.LOW]: { label: 'Low', tone: 'default' },
  [BlockerSeverity.MEDIUM]: { label: 'Medium', tone: 'warning' },
  [BlockerSeverity.HIGH]: { label: 'High', tone: 'danger' },
};

/**
 * Both "changes needed" decisions are `warning`, never `danger`.
 *
 * Requested changes are a normal step in a review, not a failure. Reserving
 * `danger` for cancellation and rejection is what keeps it meaningful.
 */
export const INTERNAL_REVIEW_DECISION_DISPLAY: Record<
  InternalReviewDecision,
  EnumDisplayEntry
> = {
  [InternalReviewDecision.APPROVED]: { label: 'Approved', tone: 'success' },
  [InternalReviewDecision.CHANGES_REQUIRED]: {
    label: 'Changes required',
    tone: 'warning',
  },
};

export const CLIENT_FEEDBACK_DECISION_DISPLAY: Record<
  ClientFeedbackDecision,
  EnumDisplayEntry
> = {
  [ClientFeedbackDecision.APPROVED]: { label: 'Approved', tone: 'success' },
  [ClientFeedbackDecision.CHANGES_REQUESTED]: {
    label: 'Changes requested',
    tone: 'warning',
  },
};

/** Tones lifted from `statusTone` in `additional-requirements-section.tsx`. */
export const ADDITIONAL_REQUIREMENT_STATUS_DISPLAY: Record<
  AdditionalRequirementStatus,
  EnumDisplayEntry
> = {
  [AdditionalRequirementStatus.PENDING_REVIEW]: {
    label: 'Pending review',
    tone: 'warning',
  },
  [AdditionalRequirementStatus.APPROVED]: {
    label: 'Approved',
    tone: 'success',
  },
  [AdditionalRequirementStatus.REJECTED]: { label: 'Rejected', tone: 'danger' },
};

// ════════════════════════════════════════════════════════════════════════════
// AI
// ════════════════════════════════════════════════════════════════════════════

export const AI_JOB_STATUS_DISPLAY: Record<AiJobStatus, EnumDisplayEntry> = {
  [AiJobStatus.QUEUED]: { label: 'Queued', tone: 'default' },
  [AiJobStatus.PROCESSING]: { label: 'Processing', tone: 'primary' },
  [AiJobStatus.COMPLETED]: { label: 'Completed', tone: 'success' },
  [AiJobStatus.FAILED]: { label: 'Failed', tone: 'danger' },
};

export const AI_JOB_TYPE_DISPLAY: Record<AiJobType, EnumDisplayEntry> = {
  [AiJobType.CHECK_SCOPE]: { label: 'Scope check', tone: 'default' },
  [AiJobType.GENERATE_STATUS_REPORT]: {
    label: 'Status report',
    tone: 'default',
  },
};

/**
 * `AI_SUMMARY` is why `label` is a server field at all.
 *
 * Every generic splitter the frontend had produced "Ai Summary". No amount of
 * cleverness in a client fixes that, because the client cannot know which
 * fragments are acronyms. A written table can.
 */
export const AI_TEMPLATE_KIND_DISPLAY: Record<
  AiTemplateKind,
  EnumDisplayEntry
> = {
  [AiTemplateKind.PROJECT_SUMMARY]: {
    label: 'Project summary',
    tone: 'default',
  },
  [AiTemplateKind.STATUS_REPORT]: { label: 'Status report', tone: 'default' },
};

/**
 * The project timeline vocabulary.
 *
 * Almost every entry is `default`, because a timeline is a log rather than a
 * status board: toning every row would make none of them stand out. The
 * exceptions are the events that changed the project's direction, which is
 * what someone scanning a timeline is looking for.
 */
export const PROJECT_ACTIVITY_TYPE_DISPLAY: Record<
  ProjectActivityType,
  EnumDisplayEntry
> = {
  [ProjectActivityType.PROJECT_CREATED]: {
    label: 'Project created',
    tone: 'default',
  },
  [ProjectActivityType.PROJECT_DETAILS_UPDATED]: {
    label: 'Project details updated',
    tone: 'default',
  },
  [ProjectActivityType.STATUS_CHANGED]: {
    label: 'Status changed',
    tone: 'default',
  },
  [ProjectActivityType.PRIORITY_CHANGED]: {
    label: 'Priority changed',
    tone: 'default',
  },
  [ProjectActivityType.DEADLINE_CHANGED]: {
    label: 'Deadline changed',
    tone: 'default',
  },
  [ProjectActivityType.PROJECT_TYPES_CHANGED]: {
    label: 'Project types changed',
    tone: 'default',
  },
  [ProjectActivityType.MEMBER_JOINED]: {
    label: 'Member joined',
    tone: 'default',
  },
  [ProjectActivityType.MEMBER_LEFT]: { label: 'Member left', tone: 'default' },
  [ProjectActivityType.DOCUMENT_ADDED]: {
    label: 'Document added',
    tone: 'default',
  },
  [ProjectActivityType.DOCUMENT_UPDATED]: {
    label: 'Document updated',
    tone: 'default',
  },
  [ProjectActivityType.DOCUMENT_REMOVED]: {
    label: 'Document removed',
    tone: 'default',
  },
  [ProjectActivityType.TIME_STARTED]: {
    label: 'Time started',
    tone: 'default',
  },
  [ProjectActivityType.TIME_PAUSED]: { label: 'Time paused', tone: 'default' },
  [ProjectActivityType.TIME_RESUMED]: {
    label: 'Time resumed',
    tone: 'default',
  },
  [ProjectActivityType.TIME_STOPPED]: {
    label: 'Time stopped',
    tone: 'default',
  },
  [ProjectActivityType.TIME_AUTO_STOPPED]: {
    label: 'Time auto stopped',
    tone: 'warning',
  },
  [ProjectActivityType.ESTIMATED_HOURS_CHANGED]: {
    label: 'Estimated hours changed',
    tone: 'default',
  },
  [ProjectActivityType.ADDITIONAL_REQUIREMENT_ADDED]: {
    label: 'Additional requirement added',
    tone: 'default',
  },
  [ProjectActivityType.ADDITIONAL_REQUIREMENT_REVIEWED]: {
    label: 'Additional requirement reviewed',
    tone: 'default',
  },
  [ProjectActivityType.PROJECT_COMPLETED]: {
    label: 'Project completed',
    tone: 'success',
  },
  [ProjectActivityType.PROJECT_CANCELLED]: {
    label: 'Project cancelled',
    tone: 'danger',
  },
  [ProjectActivityType.PROJECT_ARCHIVED]: {
    label: 'Project archived',
    tone: 'warning',
  },
  [ProjectActivityType.PROJECT_RESTORED]: {
    label: 'Project restored',
    tone: 'primary',
  },
  [ProjectActivityType.PLAN_SUBMITTED]: {
    label: 'Plan submitted',
    tone: 'default',
  },
  [ProjectActivityType.PLAN_UPDATED]: {
    label: 'Plan updated',
    tone: 'default',
  },
  [ProjectActivityType.WRAP_UP_SUBMITTED]: {
    label: 'Wrap up submitted',
    tone: 'default',
  },
  [ProjectActivityType.WRAP_UP_UPDATED]: {
    label: 'Wrap up updated',
    tone: 'default',
  },
  [ProjectActivityType.WORK_REPORT_REVIEWED]: {
    label: 'Work report reviewed',
    tone: 'default',
  },
  [ProjectActivityType.BLOCKER_ADDED]: {
    label: 'Blocker added',
    tone: 'danger',
  },
  [ProjectActivityType.BLOCKER_STATUS_CHANGED]: {
    label: 'Blocker status changed',
    tone: 'warning',
  },
  [ProjectActivityType.BLOCKER_ASSIGNED]: {
    label: 'Blocker assigned',
    tone: 'default',
  },
  [ProjectActivityType.INTERNAL_FEEDBACK_RECEIVED]: {
    label: 'Internal feedback received',
    tone: 'primary',
  },
  [ProjectActivityType.CLIENT_FEEDBACK_RECEIVED]: {
    label: 'Client feedback received',
    tone: 'primary',
  },
  [ProjectActivityType.AI_STATUS_REPORT_GENERATED]: {
    label: 'AI status report generated',
    tone: 'default',
  },
};

/**
 * The notification vocabulary.
 *
 * Toned more heavily than the activity log, on purpose: a notification exists
 * because someone needs to act, and the tone is how urgently.
 */
export const NOTIFICATION_TYPE_DISPLAY: Record<
  NotificationType,
  EnumDisplayEntry
> = {
  [NotificationType.PROJECT_CREATED]: {
    label: 'Project created',
    tone: 'default',
  },
  [NotificationType.MEMBER_ASSIGNED]: {
    label: 'Member assigned',
    tone: 'default',
  },
  [NotificationType.MEMBER_REMOVED]: {
    label: 'Member removed',
    tone: 'default',
  },
  [NotificationType.MEMBER_REASSIGNED]: {
    label: 'Member reassigned',
    tone: 'default',
  },
  [NotificationType.MEMBER_HANDOVER]: {
    label: 'Member handover',
    tone: 'default',
  },
  [NotificationType.PROJECT_STATUS_CHANGED]: {
    label: 'Project status changed',
    tone: 'default',
  },
  [NotificationType.PROJECT_ON_HOLD]: {
    label: 'Project on hold',
    tone: 'warning',
  },
  [NotificationType.PROJECT_CANCELLED]: {
    label: 'Project cancelled',
    tone: 'danger',
  },
  [NotificationType.PROJECT_PRIORITY_RAISED]: {
    label: 'Project priority raised',
    tone: 'warning',
  },
  [NotificationType.DOCUMENT_UPLOADED]: {
    label: 'Document uploaded',
    tone: 'default',
  },
  [NotificationType.BLOCKER_ASSIGNED]: {
    label: 'Blocker assigned',
    tone: 'danger',
  },
  [NotificationType.WORK_REPORT_COMMENTED]: {
    label: 'Work report commented',
    tone: 'default',
  },
  [NotificationType.STANDUP_MISSED]: {
    label: 'Standup missed',
    tone: 'warning',
  },
  [NotificationType.WRAP_UP_MISSED]: {
    label: 'Wrap up missed',
    tone: 'warning',
  },
  [NotificationType.DEADLINE_APPROACHING]: {
    label: 'Deadline approaching',
    tone: 'warning',
  },
  [NotificationType.INTERNAL_REVIEW_SUBMITTED]: {
    label: 'Internal review submitted',
    tone: 'primary',
  },
  [NotificationType.INTERNAL_REVIEW_CHANGES_REQUIRED]: {
    label: 'Internal review changes required',
    tone: 'warning',
  },
  [NotificationType.PROJECT_READY_FOR_CLIENT]: {
    label: 'Project ready for client',
    tone: 'primary',
  },
  [NotificationType.CLIENT_FEEDBACK_APPROVED]: {
    label: 'Client feedback approved',
    tone: 'success',
  },
  [NotificationType.CLIENT_FEEDBACK_CHANGES_REQUESTED]: {
    label: 'Client feedback changes requested',
    tone: 'warning',
  },
  [NotificationType.PROJECT_AUTO_COMPLETED]: {
    label: 'Project auto completed',
    tone: 'success',
  },
  [NotificationType.ADDITIONAL_REQUIREMENT_SUBMITTED]: {
    label: 'Additional requirement submitted',
    tone: 'default',
  },
  [NotificationType.ADDITIONAL_REQUIREMENT_FLAGGED_OUT_OF_SCOPE]: {
    label: 'Additional requirement flagged out of scope',
    tone: 'warning',
  },
  [NotificationType.ADDITIONAL_REQUIREMENT_APPROVED]: {
    label: 'Additional requirement approved',
    tone: 'success',
  },
  [NotificationType.ADDITIONAL_REQUIREMENT_REJECTED]: {
    label: 'Additional requirement rejected',
    tone: 'danger',
  },
  [NotificationType.ADDITIONAL_REQUIREMENT_HOURS_OR_DEADLINE_CHANGED]: {
    label: 'Additional requirement hours or deadline changed',
    tone: 'default',
  },
  [NotificationType.LEAVE_REQUEST_SUBMITTED]: {
    label: 'Leave request submitted',
    tone: 'default',
  },
  [NotificationType.LEAVE_REQUEST_APPROVED]: {
    label: 'Leave request approved',
    tone: 'success',
  },
  [NotificationType.LEAVE_REQUEST_REJECTED]: {
    label: 'Leave request rejected',
    tone: 'danger',
  },
};

// ════════════════════════════════════════════════════════════════════════════
// The one function that turns a map plus a value into a response field
// ════════════════════════════════════════════════════════════════════════════

/**
 * Build the `{ value, label, tone }` object a response carries.
 *
 * Overloaded on nullability so a nullable column stays nullable in the response
 * rather than silently becoming a "None" object that a client then has to
 * special case: an absent priority is absent, not a priority called absent.
 */
// ════════════════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════════════════

/**
 * Which dashboard a caller gets.
 *
 * NOT a Prisma enum, and deliberately not derived from `Role` either. It is
 * decided from the caller's PERMISSION SET (`resolveDashboardAudience`), so a
 * role whose grants change gets the right dashboard without this file moving.
 * `toEnumDisplay` is generic over `E extends string`, so a plain union works.
 *
 * Every tone is `default`. An audience is not a severity: it says whose day
 * this screen describes, and colouring it would imply one of them is a problem.
 */
export const DASHBOARD_AUDIENCES = [
  'ADMIN',
  'MANAGER',
  'STAFF',
  'CLIENT',
] as const;

export type DashboardAudience = (typeof DASHBOARD_AUDIENCES)[number];

export const DASHBOARD_AUDIENCE_DISPLAY: Record<
  DashboardAudience,
  EnumDisplayEntry
> = {
  ADMIN: { label: 'Administrator', tone: 'default' },
  MANAGER: { label: 'Project manager', tone: 'default' },
  STAFF: { label: 'Delivery', tone: 'default' },
  CLIENT: { label: 'Client', tone: 'default' },
};

export function toEnumDisplay<E extends string>(
  map: Record<E, EnumDisplayEntry>,
  value: E,
): EnumDisplayDto;
export function toEnumDisplay<E extends string>(
  map: Record<E, EnumDisplayEntry>,
  value: E | null | undefined,
): EnumDisplayDto | null;
export function toEnumDisplay<E extends string>(
  map: Record<E, EnumDisplayEntry>,
  value: E | null | undefined,
): EnumDisplayDto | null {
  if (value === null || value === undefined) return null;
  const entry = map[value];
  // Unreachable while every map is a total Record, which the compiler enforces.
  // It survives the one case the compiler cannot see: a value read from the
  // database that the running code was not built against, mid deploy.
  if (!entry) return { value, label: value, tone: 'default' };
  return { value, label: entry.label, tone: entry.tone };
}

/** Every member of an enum as display objects, for a filter dropdown. */
export function toEnumDisplayList<E extends string>(
  map: Record<E, EnumDisplayEntry>,
): EnumDisplayDto[] {
  return (Object.keys(map) as E[]).map((value) => toEnumDisplay(map, value));
}
