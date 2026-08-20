/**
 * The capability names the API gates its endpoints on, and the role to
 * capability map.
 *
 * **Mirrors `pmt-backend/prisma/enums.prisma` (`enum Permission`) and
 * `pmt-backend/src/config/roles.config.ts` (`ROLE_PERMISSIONS`).** Adding or
 * renaming a permission means editing both repos, or this dashboard silently
 * mis-gates its UI. The backend change lands first.
 *
 * ── Being out of date here cannot break the app ──
 *
 * `RoleProvider` holds whatever strings `GET /users/me/permissions` returned, in
 * a `Set<string>`, so a permission the API grows before this file catches up
 * still matches at runtime; only the autocomplete is stale. That asymmetry is
 * deliberate: the alternative is a client that starts refusing capabilities the
 * server granted.
 *
 * `ROLE_PERMISSIONS` below is a FALLBACK ONLY, for the window before the
 * effective set arrives or when that request failed. The server's answer always
 * wins when we have it.
 *
 * ── Never gate on a role ──
 *
 * `role === 'ADMIN'` in a component is a second copy of this map, written in a
 * different language, in a codebase that cannot see when the first one changes.
 * Gate on a permission (D2). And remember frontend gating is UX: the API
 * refuses regardless, so nothing here is a security boundary.
 *
 * ── The gate is coarse ──
 *
 * A permission answers "may this role ever do this". Whether this person may do
 * it to THIS project depends on their `ProjectMember` rows, and the API answers
 * that per resource with capability flags on the response (`canEdit`,
 * `canArchive`). Gate a screen from a permission; gate a row from its own flags.
 */

export const Permission = {
    // ── Projects ──
    CREATE_PROJECT: 'CREATE_PROJECT',
    VIEW_ALL_PROJECTS: 'VIEW_ALL_PROJECTS',
    VIEW_OWN_PROJECTS: 'VIEW_OWN_PROJECTS',
    EDIT_PROJECT: 'EDIT_PROJECT',
    CHANGE_PROJECT_STATUS: 'CHANGE_PROJECT_STATUS',
    CHANGE_PROJECT_PRIORITY: 'CHANGE_PROJECT_PRIORITY',
    MANAGE_PROJECT_TYPES: 'MANAGE_PROJECT_TYPES',
    MANAGE_ESTIMATED_HOURS: 'MANAGE_ESTIMATED_HOURS',
    ARCHIVE_PROJECT: 'ARCHIVE_PROJECT',
    CONNECT_PROJECT_SLACK: 'CONNECT_PROJECT_SLACK',
    VIEW_PROJECT_ACTIVITY: 'VIEW_PROJECT_ACTIVITY',

    // ── Project team ──
    VIEW_PROJECT_MEMBERS: 'VIEW_PROJECT_MEMBERS',
    MANAGE_PROJECT_MEMBERS: 'MANAGE_PROJECT_MEMBERS',

    // ── Documents ──
    VIEW_PROJECT_DOCUMENTS: 'VIEW_PROJECT_DOCUMENTS',
    MANAGE_PROJECT_DOCUMENTS: 'MANAGE_PROJECT_DOCUMENTS',

    // ── Time ──
    TRACK_PROJECT_TIME: 'TRACK_PROJECT_TIME',
    TRACK_MEETING_TIME: 'TRACK_MEETING_TIME',
    VIEW_TIME_ENTRIES: 'VIEW_TIME_ENTRIES',

    // ── Daily work reports ──
    SUBMIT_WORK_REPORT: 'SUBMIT_WORK_REPORT',
    VIEW_WORK_REPORTS: 'VIEW_WORK_REPORTS',
    REVIEW_WORK_REPORT: 'REVIEW_WORK_REPORT',

    // ── Blockers ──
    REPORT_BLOCKER: 'REPORT_BLOCKER',
    VIEW_BLOCKERS: 'VIEW_BLOCKERS',
    MANAGE_BLOCKER_REASONS: 'MANAGE_BLOCKER_REASONS',

    // ── Reviews and feedback ──
    SUBMIT_INTERNAL_REVIEW: 'SUBMIT_INTERNAL_REVIEW',
    VIEW_INTERNAL_REVIEWS: 'VIEW_INTERNAL_REVIEWS',
    SUBMIT_CLIENT_FEEDBACK: 'SUBMIT_CLIENT_FEEDBACK',
    VIEW_CLIENT_FEEDBACK: 'VIEW_CLIENT_FEEDBACK',

    // ── Additional requirements ──
    CREATE_ADDITIONAL_REQUIREMENT: 'CREATE_ADDITIONAL_REQUIREMENT',
    REVIEW_ADDITIONAL_REQUIREMENT: 'REVIEW_ADDITIONAL_REQUIREMENT',
    VIEW_ADDITIONAL_REQUIREMENTS: 'VIEW_ADDITIONAL_REQUIREMENTS',

    // ── Reports ──
    VIEW_PROJECT_REPORTS: 'VIEW_PROJECT_REPORTS',
    VIEW_DEVELOPER_REPORTS: 'VIEW_DEVELOPER_REPORTS',

    // ── Leave ──
    REQUEST_LEAVE: 'REQUEST_LEAVE',
    VIEW_LEAVE_REQUESTS: 'VIEW_LEAVE_REQUESTS',
    REVIEW_LEAVE_REQUEST: 'REVIEW_LEAVE_REQUEST',
    VIEW_LEAVE_SUMMARY: 'VIEW_LEAVE_SUMMARY',
    MANAGE_LEAVE_TYPES: 'MANAGE_LEAVE_TYPES',
    MANAGE_HOLIDAYS: 'MANAGE_HOLIDAYS',
    VIEW_HOLIDAYS: 'VIEW_HOLIDAYS',
    VIEW_LEAVE_TYPES: 'VIEW_LEAVE_TYPES',

    // ── Self ──
    VIEW_OWN_PROFILE: 'VIEW_OWN_PROFILE',
    EDIT_OWN_PROFILE: 'EDIT_OWN_PROFILE',
    VIEW_OWN_PERMISSIONS: 'VIEW_OWN_PERMISSIONS',
    VIEW_OWN_NOTIFICATIONS: 'VIEW_OWN_NOTIFICATIONS',
    MANAGE_OWN_NOTIFICATIONS: 'MANAGE_OWN_NOTIFICATIONS',

    // ── Users ──
    VIEW_USERS: 'VIEW_USERS',
    INVITE_USER: 'INVITE_USER',
    UPDATE_USER: 'UPDATE_USER',
    DELETE_USER: 'DELETE_USER',
    VIEW_USER_PROFILE: 'VIEW_USER_PROFILE',

    // ── Oversight ──
    VIEW_AUDIT_LOG: 'VIEW_AUDIT_LOG',

    // ── AI ──
    VIEW_AI_TEMPLATES: 'VIEW_AI_TEMPLATES',
    MANAGE_AI_TEMPLATES: 'MANAGE_AI_TEMPLATES',
    REQUEST_AI_SUMMARY: 'REQUEST_AI_SUMMARY',
    GENERATE_STATUS_REPORT: 'GENERATE_STATUS_REPORT',
    VIEW_STATUS_REPORTS: 'VIEW_STATUS_REPORTS',
    RUN_SCOPE_CHECK: 'RUN_SCOPE_CHECK',
    VIEW_AI_JOB: 'VIEW_AI_JOB',
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

export const Role = {
    SYSTEM_ADMIN: 'SYSTEM_ADMIN',
    ADMIN: 'ADMIN',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    DEVELOPER: 'DEVELOPER',
    DESIGNER: 'DESIGNER',
    CLIENT: 'CLIENT',
} as const;

export type RoleKey = (typeof Role)[keyof typeof Role];

// ══════════════════════════════════════════════════════════════════════════
// The role to capability map
// ══════════════════════════════════════════════════════════════════════════
//
// Composed from the same named groups the backend uses, in the same order, so
// the two files can be diffed side by side rather than compared item by item.

/**
 * Routes that only ever touch the caller's own record. They still declare a
 * permission so that "no permission on a route" always means a mistake rather
 * than a deliberate omission.
 */
const EVERYONE: PermissionKey[] = [
    Permission.VIEW_OWN_PROJECTS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.VIEW_OWN_PERMISSIONS,
    Permission.VIEW_OWN_NOTIFICATIONS,
    Permission.MANAGE_OWN_NOTIFICATIONS,
    Permission.VIEW_HOLIDAYS,
    Permission.VIEW_LEAVE_TYPES,
];

/**
 * The project surfaces a PROJECT_MANAGER, DEVELOPER and DESIGNER all read.
 * A CLIENT holds none of these: every one of them is internal.
 */
const INTERNAL_PROJECT_READ: PermissionKey[] = [
    Permission.VIEW_PROJECT_ACTIVITY,
    Permission.VIEW_PROJECT_MEMBERS,
    Permission.VIEW_PROJECT_DOCUMENTS,
    Permission.VIEW_TIME_ENTRIES,
    Permission.VIEW_WORK_REPORTS,
    Permission.VIEW_BLOCKERS,
    Permission.VIEW_INTERNAL_REVIEWS,
    Permission.VIEW_ADDITIONAL_REQUIREMENTS,
    Permission.VIEW_PROJECT_REPORTS,
    Permission.VIEW_DEVELOPER_REPORTS,
    Permission.VIEW_STATUS_REPORTS,
    Permission.VIEW_AI_TEMPLATES,
    Permission.REQUEST_AI_SUMMARY,
];

/** Everyone who is an employee may request leave and track meeting time. */
const EMPLOYEE: PermissionKey[] = [
    Permission.REQUEST_LEAVE,
    Permission.TRACK_MEETING_TIME,
];

/**
 * DEVELOPER and DESIGNER: they do the work and report on it. These two hold
 * TRACK_PROJECT_TIME and SUBMIT_WORK_REPORT, which a PROJECT_MANAGER does not.
 */
const DELIVERY_STAFF: PermissionKey[] = [
    ...EVERYONE,
    ...INTERNAL_PROJECT_READ,
    ...EMPLOYEE,
    Permission.CHANGE_PROJECT_STATUS,
    Permission.TRACK_PROJECT_TIME,
    Permission.SUBMIT_WORK_REPORT,
    Permission.REPORT_BLOCKER,
];

/**
 * PROJECT_MANAGER: runs projects. Deliberately WITHOUT TRACK_PROJECT_TIME and
 * SUBMIT_WORK_REPORT, and without REVIEW_LEAVE_REQUEST: a PM reads every leave
 * request and opens it, but only an Admin approves or rejects one.
 */
const PROJECT_MANAGER: PermissionKey[] = [
    ...EVERYONE,
    ...INTERNAL_PROJECT_READ,
    ...EMPLOYEE,
    Permission.CHANGE_PROJECT_STATUS,
    Permission.REPORT_BLOCKER,
    Permission.CREATE_PROJECT,
    Permission.VIEW_ALL_PROJECTS,
    Permission.EDIT_PROJECT,
    Permission.CHANGE_PROJECT_PRIORITY,
    Permission.MANAGE_PROJECT_TYPES,
    Permission.MANAGE_ESTIMATED_HOURS,
    Permission.CONNECT_PROJECT_SLACK,
    Permission.MANAGE_PROJECT_MEMBERS,
    Permission.MANAGE_PROJECT_DOCUMENTS,
    Permission.MANAGE_BLOCKER_REASONS,
    Permission.REVIEW_WORK_REPORT,
    Permission.SUBMIT_INTERNAL_REVIEW,
    Permission.SUBMIT_CLIENT_FEEDBACK,
    Permission.VIEW_CLIENT_FEEDBACK,
    Permission.CREATE_ADDITIONAL_REQUIREMENT,
    Permission.REVIEW_ADDITIONAL_REQUIREMENT,
    Permission.VIEW_LEAVE_REQUESTS,
    Permission.VIEW_USERS,
    Permission.VIEW_USER_PROFILE,
    Permission.GENERATE_STATUS_REPORT,
    Permission.RUN_SCOPE_CHECK,
    Permission.VIEW_AI_JOB,
];

/** A CLIENT sees the reduced view of their own project, and nothing internal. */
const CLIENT: PermissionKey[] = [
    ...EVERYONE,
    // Narrowed to DELIVERABLE documents by the service, not by this grant.
    Permission.VIEW_PROJECT_DOCUMENTS,
    Permission.SUBMIT_CLIENT_FEEDBACK,
    Permission.VIEW_CLIENT_FEEDBACK,
];

/** ADMIN holds the union of every other role plus the admin only capabilities. */
const ADMIN: PermissionKey[] = [
    ...new Set<PermissionKey>([
        ...PROJECT_MANAGER,
        ...DELIVERY_STAFF,
        ...CLIENT,
        Permission.ARCHIVE_PROJECT,
        Permission.INVITE_USER,
        Permission.UPDATE_USER,
        Permission.DELETE_USER,
        Permission.VIEW_AUDIT_LOG,
        Permission.REVIEW_LEAVE_REQUEST,
        Permission.VIEW_LEAVE_SUMMARY,
        Permission.MANAGE_LEAVE_TYPES,
        Permission.MANAGE_HOLIDAYS,
        Permission.MANAGE_AI_TEMPLATES,
    ]),
];

/**
 * SYSTEM_ADMIN holds exactly what ADMIN holds. What it has beyond an ADMIN is
 * not a capability but an IDENTITY rule (only it may invite or edit an ADMIN,
 * and it can never be deleted). A permission cannot express "about whom", so
 * those stay as explicit checks in the backend's `UsersService`.
 */
const SYSTEM_ADMIN: PermissionKey[] = [...ADMIN];

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
    [Role.SYSTEM_ADMIN]: SYSTEM_ADMIN,
    [Role.ADMIN]: ADMIN,
    [Role.PROJECT_MANAGER]: PROJECT_MANAGER,
    [Role.DEVELOPER]: DELIVERY_STAFF,
    [Role.DESIGNER]: DELIVERY_STAFF,
    [Role.CLIENT]: CLIENT,
};
