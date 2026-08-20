-- Password changes are served by better-auth's own POST /api/auth/change-password.
-- The PATCH /users/me/password wrapper that CHANGE_OWN_PASSWORD gated is gone, so
-- the value is granted to no role and gates no route.
--
-- Hand written because `prisma migrate dev` needs a TTY (see CLAUDE.md).
--
-- Postgres cannot drop a single value from an enum type, so the type is
-- recreated. Safe here because no table has a column of type "Permission":
-- ROLE_PERMISSIONS is a TypeScript map, and the type exists only so the
-- generated client offers the members as constants. Verified before writing
-- this: `grep -rn " Permission" prisma/*.prisma` matches nothing outside
-- enums.prisma.

ALTER TYPE "Permission" RENAME TO "Permission_old";

CREATE TYPE "Permission" AS ENUM (
  'CREATE_PROJECT',
  'VIEW_ALL_PROJECTS',
  'VIEW_OWN_PROJECTS',
  'EDIT_PROJECT',
  'CHANGE_PROJECT_STATUS',
  'CHANGE_PROJECT_PRIORITY',
  'MANAGE_PROJECT_TYPES',
  'MANAGE_ESTIMATED_HOURS',
  'ARCHIVE_PROJECT',
  'CONNECT_PROJECT_SLACK',
  'VIEW_PROJECT_ACTIVITY',
  'VIEW_PROJECT_MEMBERS',
  'MANAGE_PROJECT_MEMBERS',
  'VIEW_PROJECT_DOCUMENTS',
  'MANAGE_PROJECT_DOCUMENTS',
  'TRACK_PROJECT_TIME',
  'TRACK_MEETING_TIME',
  'VIEW_TIME_ENTRIES',
  'SUBMIT_WORK_REPORT',
  'VIEW_WORK_REPORTS',
  'REVIEW_WORK_REPORT',
  'REPORT_BLOCKER',
  'VIEW_BLOCKERS',
  'MANAGE_BLOCKER_REASONS',
  'SUBMIT_INTERNAL_REVIEW',
  'VIEW_INTERNAL_REVIEWS',
  'SUBMIT_CLIENT_FEEDBACK',
  'VIEW_CLIENT_FEEDBACK',
  'CREATE_ADDITIONAL_REQUIREMENT',
  'REVIEW_ADDITIONAL_REQUIREMENT',
  'VIEW_ADDITIONAL_REQUIREMENTS',
  'VIEW_PROJECT_REPORTS',
  'VIEW_DEVELOPER_REPORTS',
  'REQUEST_LEAVE',
  'VIEW_LEAVE_REQUESTS',
  'REVIEW_LEAVE_REQUEST',
  'VIEW_LEAVE_SUMMARY',
  'MANAGE_LEAVE_TYPES',
  'MANAGE_HOLIDAYS',
  'VIEW_OWN_PROFILE',
  'EDIT_OWN_PROFILE',
  'VIEW_OWN_PERMISSIONS',
  'VIEW_OWN_NOTIFICATIONS',
  'MANAGE_OWN_NOTIFICATIONS',
  'VIEW_HOLIDAYS',
  'VIEW_LEAVE_TYPES',
  'VIEW_USERS',
  'INVITE_USER',
  'UPDATE_USER',
  'DELETE_USER',
  'VIEW_USER_PROFILE',
  'VIEW_AUDIT_LOG',
  'VIEW_AI_TEMPLATES',
  'MANAGE_AI_TEMPLATES',
  'REQUEST_AI_SUMMARY',
  'GENERATE_STATUS_REPORT',
  'VIEW_STATUS_REPORTS',
  'RUN_SCOPE_CHECK',
  'VIEW_AI_JOB'
);

DROP TYPE "Permission_old";
