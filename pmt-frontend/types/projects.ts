import type { EnumDisplay } from '@/contexts/role-context';

/**
 * `GET /projects`, mirrored from `pmt-backend/src/projects/dto/project.dto.ts`.
 *
 * Nothing here is computed on this side. `daysUntilDeadline`, `isOverdue`,
 * `remainingHours` and every capability arrive decided, because each is a
 * business rule and a second copy in a browser is a second answer (D4).
 */

export type ProjectPerson = {
    id: string;
    name: string;
    email: string;
};

export type ProjectTypeTag = {
    id: string;
    type: EnumDisplay;
};

/**
 * What the caller may do to THIS project.
 *
 * Gate a row's controls from here, never from a role. A project manager sees
 * every project and may edit only their own, so two rows in one table
 * legitimately disagree.
 */
export type ProjectCapabilities = {
    canEdit: boolean;
    canChangeStatus: boolean;
    canChangePriority: boolean;
    canManageTypes: boolean;
    canManageEstimatedHours: boolean;
    canArchive: boolean;
    canRestore: boolean;
    canConnectSlack: boolean;
    canManageMembers: boolean;
    canManageDocuments: boolean;
};

/**
 * Which list a caller may read, and in which shape.
 *
 * | Scope    | Endpoint         | Gate                                    |
 * | -------- | ---------------- | --------------------------------------- |
 * | `all`    | `/projects`      | `VIEW_ALL_PROJECTS`                     |
 * | `mine`   | `/projects/mine` | active membership, internal shape       |
 * | `client` | `/projects/mine` | active membership, REDUCED shape        |
 *
 * The last two are one endpoint answering in two shapes, because the backend
 * chooses the projection from the caller's role. That is not a quirk to work
 * around: `CLIENT_PROJECT_SELECT` is the security boundary, and the smaller
 * shape arriving is the evidence it held.
 */
export type ProjectsScope = 'all' | 'mine' | 'client';

export type ProjectMemberSummary = {
    id: string;
    name: string;
    avatarUrl: string | null;
    /** Their role on THIS project, not their account role. */
    projectRole: EnumDisplay;
};

export type Project = {
    id: string;
    name: string;
    description: string | null;
    status: EnumDisplay;
    priority: EnumDisplay;
    projectTypeTags: ProjectTypeTag[];
    client: ProjectPerson | null;
    createdBy: ProjectPerson | null;
    plannedStartDate: string | null;
    deadline: string | null;
    daysUntilDeadline: number | null;
    /** "due today", "in 42 days", "5 days overdue". Phrased by the API. */
    deadlineLabel: string | null;
    isOverdue: boolean;
    isTerminal: boolean;
    isArchived: boolean;
    archivedAt: string | null;
    completedAt: string | null;
    estimatedHours: number | null;
    actualHours: number;
    remainingHours: number | null;
    /**
     * The readable form of each figure above. Render these; calculate from the
     * numbers (ADR 0003). An hours column really holds `56.083333333333336`,
     * and printing it is the defect these fields close.
     */
    actualHoursLabel: string;
    estimatedHoursLabel: string | null;
    remainingHoursLabel: string | null;
    rushReason: string | null;
    onHoldReason: string | null;
    cancellationReason: string | null;
    slackChannelId: string | null;
    createdAt: string;
    updatedAt: string;
    members: ProjectMemberSummary[];
    /**
     * The manager a list groups by: the first staffed project manager by name.
     * Null when nobody is staffed as one, which is the state that keeps a
     * project in Planning. Sent as a field so two clients cannot disagree about
     * which of several managers is "the" lead.
     */
    lead: ProjectMemberSummary | null;
    capabilities: ProjectCapabilities;
};

/** The sort fields the API accepts. Anything else is refused, not ignored. */
export const PROJECT_SORT_FIELDS = [
    'name',
    'deadline',
    'plannedStartDate',
    'createdAt',
    'updatedAt',
] as const;

export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export type ProjectsQuery = {
    page?: number;
    pageSize?: number;
    sortBy?: ProjectSortField;
    sortOrder?: 'asc' | 'desc';
    status?: string;
    priority?: string;
    clientId?: string;
    projectTypes?: string[];
    archived?: boolean;
    search?: string;
};


/**
 * What a CLIENT sees of their own project. Nine fields, and that is the whole
 * list.
 *
 * A SEPARATE type, never `Partial<Project>` or a `Pick`, mirroring the backend
 * where `CLIENT_PROJECT_SELECT` is its own select and `ClientProjectResponseDto`
 * its own class. The reason is the direction the mistake runs: a `Pick` invites
 * someone to widen it, and widening it here would make a component read a field
 * the API deliberately withholds, which either renders blank or crashes. Being a
 * separate type means adding a field is a conscious act in two repositories.
 *
 * There is no `priority`, no `members`, no hours, no `capabilities` and no
 * overdue flag. Every one of those is an internal figure: what a project cost,
 * who is on it, and whether it is late are the agency's business.
 */
export type ClientProject = {
    id: string;
    name: string;
    description: string | null;
    status: EnumDisplay;
    /**
     * No `id`, unlike the internal shape. `CLIENT_PROJECT_SELECT` selects the
     * tag's `type` and nothing else, so the join row's id never leaves the
     * server. Verified against a real response rather than assumed: writing
     * `ProjectTypeTag[]` here would have typed an `id` that is not there.
     */
    projectTypeTags: { type: EnumDisplay }[];
    plannedStartDate: string | null;
    deadline: string | null;
    completedAt: string | null;
    createdAt: string;
};
