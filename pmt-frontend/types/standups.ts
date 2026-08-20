import type { EnumDisplay } from '@/contexts/role-context';

/**
 * `GET /daily-work-reports`, mirrored from
 * `pmt-backend/src/projects/daily-work-reports/dto/daily-work-report.dto.ts`.
 *
 * A standup here is one person's day: a report with one entry per project they
 * touched, each carrying a plan (written in the morning) and accomplishments
 * (written at wrap up). The two are independent, which is why `hasPlan` and
 * `hasWrapUp` are separate flags rather than one status.
 */

export type StandupPerson = {
    id: string;
    name: string;
    email: string;
};

/** What the caller may do to one project entry. */
export type StandupEntryCapabilities = {
    /**
     * Reviewing is a manager's act: the API admits an admin or the project's own
     * PROJECT_MANAGER and nobody else. Gate the control from here, never from a
     * role, or a developer is offered a review the route then refuses.
     */
    canReview: boolean;
};

export type StandupEntry = {
    id: string;
    dailyWorkReportId: string;
    projectId: string;
    project: { id: string; name: string } | null;
    /** Written in the morning. Null when the day was only wrapped up. */
    plan: string | null;
    /** Written at wrap up. Null while the day is still in progress. */
    accomplishments: string | null;
    hasPlan: boolean;
    hasWrapUp: boolean;
    reviewedBy: StandupPerson | null;
    reviewedAt: string | null;
    reviewComment: string | null;
    isReviewed: boolean;
    capabilities: StandupEntryCapabilities;
};

/** What the caller may do to the report as a whole. */
export type StandupCapabilities = {
    canEditPlan: boolean;
    canEditWrapUp: boolean;
    canSubmitWrapUp: boolean;
};

export type Standup = {
    id: string;
    userId: string;
    /**
     * Whose day this is. Present on the team wide list; a manager asking for
     * nobody in particular gets everyone, and without this the rows would be
     * bare ids.
     */
    user?: StandupPerson;
    /** A calendar day, sent date-only so no timezone gets a say. */
    date: string;
    status: EnumDisplay;
    planSubmittedAt: string | null;
    wrapUpSubmittedAt: string | null;
    /** Counted by the API. Never `entries.length`, which is one page of them. */
    entryCount: number;
    entries: StandupEntry[];
    capabilities: StandupCapabilities;
    createdAt: string;
    updatedAt: string;
};

/**
 * What `GET /daily-work-reports` accepts.
 *
 * Omitting `userId` means your own reports for a developer or designer, and the
 * WHOLE TEAM for a manager or admin. `type` filters the ENTRIES within each
 * report, and a report with no matching entry drops out entirely.
 */
export type StandupsQuery = {
    page?: number;
    pageSize?: number;
    userId?: string;
    startDate?: string;
    endDate?: string;
    type?: 'PLAN' | 'WRAP_UP';
};
