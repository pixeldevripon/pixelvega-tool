/**
 * The capability names the API gates its endpoints on.
 *
 * Mirrored from `enum Permission` in `pmt-backend/prisma/enums.prisma`. The API
 * is the authority: this list exists so a component can write
 * `can("EDIT_PROJECT")` and have a typo fail at compile time rather than
 * silently hide a button forever.
 *
 * **Being out of date here cannot break the app.** `RoleProvider` holds
 * whatever strings `GET /users/me/permissions` returned, in a `Set<string>`, so
 * a permission the API grows before this file catches up still works at
 * runtime; only the autocomplete is stale. That asymmetry is deliberate: the
 * alternative is a client that starts refusing capabilities the server granted.
 *
 * Never gate on a role. `ROLE_PERMISSIONS` on the server is the one map from
 * role to capability (D2), and a second copy in a browser is a second answer.
 */
export const PERMISSIONS = [
  "CREATE_PROJECT",
  "VIEW_ALL_PROJECTS",
  "VIEW_OWN_PROJECTS",
  "EDIT_PROJECT",
  "CHANGE_PROJECT_STATUS",
  "CHANGE_PROJECT_PRIORITY",
  "MANAGE_PROJECT_TYPES",
  "MANAGE_ESTIMATED_HOURS",
  "ARCHIVE_PROJECT",
  "CONNECT_PROJECT_SLACK",
  "VIEW_PROJECT_ACTIVITY",
  "VIEW_PROJECT_MEMBERS",
  "MANAGE_PROJECT_MEMBERS",
  "VIEW_PROJECT_DOCUMENTS",
  "MANAGE_PROJECT_DOCUMENTS",
  "TRACK_PROJECT_TIME",
  "TRACK_MEETING_TIME",
  "VIEW_TIME_ENTRIES",
  "SUBMIT_WORK_REPORT",
  "VIEW_WORK_REPORTS",
  "REVIEW_WORK_REPORT",
  "REPORT_BLOCKER",
  "VIEW_BLOCKERS",
  "MANAGE_BLOCKER_REASONS",
  "SUBMIT_INTERNAL_REVIEW",
  "VIEW_INTERNAL_REVIEWS",
  "SUBMIT_CLIENT_FEEDBACK",
  "VIEW_CLIENT_FEEDBACK",
  "CREATE_ADDITIONAL_REQUIREMENT",
  "REVIEW_ADDITIONAL_REQUIREMENT",
  "VIEW_ADDITIONAL_REQUIREMENTS",
  "VIEW_PROJECT_REPORTS",
  "VIEW_DEVELOPER_REPORTS",
  "REQUEST_LEAVE",
  "VIEW_LEAVE_REQUESTS",
  "REVIEW_LEAVE_REQUEST",
  "VIEW_LEAVE_SUMMARY",
  "MANAGE_LEAVE_TYPES",
  "MANAGE_HOLIDAYS",
  "VIEW_OWN_PROFILE",
  "EDIT_OWN_PROFILE",
  "VIEW_OWN_PERMISSIONS",
  "VIEW_OWN_NOTIFICATIONS",
  "MANAGE_OWN_NOTIFICATIONS",
  "VIEW_HOLIDAYS",
  "VIEW_LEAVE_TYPES",
  "VIEW_USERS",
  "INVITE_USER",
  "UPDATE_USER",
  "DELETE_USER",
  "VIEW_USER_PROFILE",
  "VIEW_AUDIT_LOG",
  "VIEW_AI_TEMPLATES",
  "MANAGE_AI_TEMPLATES",
  "REQUEST_AI_SUMMARY",
  "GENERATE_STATUS_REPORT",
  "VIEW_STATUS_REPORTS",
  "RUN_SCOPE_CHECK",
  "VIEW_AI_JOB",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** What `GET /users/me/permissions` returns. */
export type MyPermissions = {
  role: EnumDisplay;
  permissions: Permission[];
};

/**
 * How every enum reaches this app (ADR 0001).
 *
 * `value` is the only field to branch on, `label` is advisory display text, and
 * `tone` is the server's judgment about severity, mapped onto a class and
 * nothing else. There is no label map and no tone map in this codebase, and
 * that is the point: deciding that a blocked project reads as a warning is a
 * statement about the business, not about styling.
 */
export type EnumDisplay = {
  value: string;
  label: string;
  tone: DisplayTone;
};

/**
 * The closed set of tones, fixed to match `DISPLAY_TONES` in
 * `pmt-backend/src/common/dto/display.dto.ts`. A sixth tone is a change to both
 * projects, on purpose: a server free to invent tones has handed the client a
 * rendering problem it cannot solve.
 */
export const DISPLAY_TONES = [
  "default",
  "primary",
  "success",
  "warning",
  "danger",
] as const;

export type DisplayTone = (typeof DISPLAY_TONES)[number];
