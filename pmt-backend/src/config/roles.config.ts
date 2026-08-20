import { Permission, Role } from '@prisma/client';

/**
 * The single map from a Role to the Permissions it holds (directive D2).
 *
 * Read by PermissionsService, which PermissionsGuard consults. Do NOT read it
 * from business logic: put `@RequirePermissions()` on the handler instead, so
 * the gate stays in one place and is visible from the route.
 *
 * This replaces the old `Roles` decorator wrapper, which silently unioned
 * SYSTEM_ADMIN and ADMIN into every role list. That union is now written out
 * here, where it is readable rather than implied.
 *
 * The gate is COARSE. It answers "may this role ever do this". Whether a given
 * caller may do it to a given project is a separate question, answered by an
 * assertCanX() helper in the service, because it depends on ProjectMember rows.
 *
 * ── The hierarchy is NOT a clean chain ──────────────────────────────────────
 * ADMIN and SYSTEM_ADMIN are strict supersets of everything. Below them the
 * roles are siblings, not a ladder: a PROJECT_MANAGER runs projects but does
 * NOT track project time or author a daily work report, and a DEVELOPER does
 * the reverse. Modelling PM as "DEVELOPER plus management" would silently hand
 * PMs time tracking, which the current routes deliberately withhold.
 */

/**
 * Anything any signed in person may do, whatever their role.
 *
 * The self service entries are here rather than absent because directive D2
 * says every operation in the codebase is gated. These routes only ever touch
 * the caller's own record, so there is nobody to scope them against, but they
 * still declare a permission so that "no permission on a route" always means a
 * mistake rather than a deliberate omission.
 */
const EVERYONE: Permission[] = [
  // The landing screen. Every role lands somewhere, and WHICH dashboard they
  // get is decided by the rest of their set rather than by this permission:
  // holding VIEW_AUDIT_LOG makes it the admin one, VIEW_ALL_PROJECTS the
  // manager one, TRACK_PROJECT_TIME the staff one, and holding none of the
  // three makes it the client one.
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_OWN_PROJECTS,
  Permission.VIEW_OWN_PROFILE,
  Permission.EDIT_OWN_PROFILE,
  Permission.VIEW_OWN_PERMISSIONS,
  Permission.VIEW_OWN_NOTIFICATIONS,
  Permission.MANAGE_OWN_NOTIFICATIONS,
  // Seeing where you are signed in, and signing one of those places out, is
  // self service in the same sense as the profile: the routes only ever read and
  // write the caller's own Session rows, so there is nobody to scope them
  // against.
  Permission.VIEW_OWN_SESSIONS,
  Permission.MANAGE_OWN_SESSIONS,
  // Held by every role including SYSTEM_ADMIN, and refused for SYSTEM_ADMIN in
  // the service. The permission answers "may this role ever"; "except the one
  // root account" is a rule about a row, which is not a question a permission
  // can answer.
  Permission.DELETE_OWN_ACCOUNT,
  Permission.VIEW_HOLIDAYS,
  Permission.VIEW_LEAVE_TYPES,
];

/**
 * The project surfaces a PROJECT_MANAGER, DEVELOPER and DESIGNER all read.
 * A CLIENT holds none of these: every one of them is internal.
 */
const INTERNAL_PROJECT_READ: Permission[] = [
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
const EMPLOYEE: Permission[] = [
  Permission.REQUEST_LEAVE,
  Permission.TRACK_MEETING_TIME,
];

/**
 * DEVELOPER and DESIGNER: they do the work and report on it. These two hold
 * TRACK_PROJECT_TIME and SUBMIT_WORK_REPORT, which a PROJECT_MANAGER does not.
 */
const DELIVERY_STAFF: Permission[] = [
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
 * SUBMIT_WORK_REPORT, matching the routes as they stand today.
 */
const PROJECT_MANAGER: Permission[] = [
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
const CLIENT: Permission[] = [
  ...EVERYONE,
  Permission.VIEW_PROJECT_DOCUMENTS, // narrowed to DELIVERABLE in the service
  Permission.SUBMIT_CLIENT_FEEDBACK,
  Permission.VIEW_CLIENT_FEEDBACK,
];

/**
 * ADMIN holds the union of every other role plus the admin only capabilities.
 * roles.config.spec.ts asserts the superset property rather than trusting it.
 */
const ADMIN: Permission[] = [
  ...new Set([
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
 * those stay as explicit checks in UsersService.
 */
const SYSTEM_ADMIN: Permission[] = [...ADMIN];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SYSTEM_ADMIN]: SYSTEM_ADMIN,
  [Role.ADMIN]: ADMIN,
  [Role.PROJECT_MANAGER]: PROJECT_MANAGER,
  [Role.DEVELOPER]: DELIVERY_STAFF,
  [Role.DESIGNER]: DELIVERY_STAFF,
  [Role.CLIENT]: CLIENT,
};

/**
 * The superset relationships that DO hold, asserted by the spec. Note what is
 * absent: PROJECT_MANAGER over DEVELOPER. They are siblings, see the header.
 */
export const ROLE_HIERARCHY: Array<[Role, Role]> = [
  [Role.SYSTEM_ADMIN, Role.ADMIN],
  [Role.ADMIN, Role.PROJECT_MANAGER],
  [Role.ADMIN, Role.DEVELOPER],
  [Role.ADMIN, Role.DESIGNER],
  [Role.ADMIN, Role.CLIENT],
];
