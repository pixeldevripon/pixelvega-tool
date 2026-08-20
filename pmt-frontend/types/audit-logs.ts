/** `GET /audit-logs`, mirrored from the backend's audit log DTO. */
export type AuditLogEntry = {
    id: string;
    /** A dotted action name, for example `profile.avatar_updated`. */
    /** The exact value. Filter and compare on this, never on the label. */
    action: string;
    /**
     * The action as a person reads it: "User password changed". Derived by the
     * API from `action`, because the vocabulary is open and a lookup table would
     * render a blank cell for whichever new action nobody added.
     */
    actionLabel: string;
    userId: string | null;
    user: { id: string; name: string; email: string } | null;
    targetType: string | null;
    targetId: string | null;
    /** Whatever the action recorded. Shape varies by action, so it is unknown. */
    metadata: Record<string, unknown> | null;
    createdAt: string;
};

/**
 * What `GET /audit-logs` accepts.
 *
 * `action` is an EQUALITY match, not a search. Audit actions are stable dotted
 * strings written by the code that emits them, and a partial match would
 * quietly include actions the reader did not mean to ask about.
 */
export type AuditLogsQuery = {
    page?: number;
    pageSize?: number;
    action?: string;
    userId?: string;
    targetType?: string;
    targetId?: string;
    /** Date only, inclusive. The API reads it to the END of the day named. */
    startDate?: string;
    endDate?: string;
};
