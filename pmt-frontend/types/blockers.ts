import type { EnumDisplay } from '@/contexts/role-context';

/** `GET /blockers`, mirrored from the backend's blocker DTO. */

export type BlockerPerson = { id: string; name: string; email: string };

export type BlockerCapabilities = {
    canEdit: boolean;
    canChangeStatus: boolean;
    canReassign: boolean;
    canResolve: boolean;
};

export type Blocker = {
    id: string;
    projectId: string;
    project: { id: string; name: string } | null;
    description: string;
    status: EnumDisplay;
    severity: EnumDisplay;
    reason: { id: string; name: string } | null;
    reportedBy: BlockerPerson | null;
    assignedTo: BlockerPerson | null;
    assignedAt: string | null;
    resolvedBy: BlockerPerson | null;
    resolvedAt: string | null;
    resolutionNotes: string | null;
    isResolved: boolean;
    /** Days it has been open. Null once resolved: it is no longer open. */
    daysOpen: number | null;
    /** How long it has been open, or took to resolve, already written out. */
    ageMinutes: number;
    ageLabel: string;
    resolutionMinutes: number | null;
    resolutionLabel: string | null;
    deadlineExtensionDays: number | null;
    causedDeadlineExtension: boolean;
    createdAt: string;
    capabilities: BlockerCapabilities;
};

/**
 * What `GET /blockers` accepts, and nothing more.
 *
 * Exactly the declared set: the API runs `forbidNonWhitelisted`, so an extra
 * query param is a 400 rather than a quiet miss. There is no `sortBy` here
 * because the endpoint does not offer one: blockers come back newest first,
 * which is the only order a triage queue wants.
 */
export type BlockersQuery = {
    page?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    projectId?: string;
    assignedToId?: string;
    /** Matches anywhere in the description, case insensitively. */
    search?: string;
};
