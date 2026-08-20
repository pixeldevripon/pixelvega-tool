import { Prisma, type PrismaClient } from '@prisma/client';

// Every table the seed owns. Listed by hand rather than read from
// information_schema, so the seed can never truncate something it did not
// mean to, and so _prisma_migrations is always left alone.
//
// TRUNCATE with CASCADE clears all of them in one statement, so there is no
// foreign key ordering to keep in sync. It is also far faster than thirty
// separate deleteMany round trips to a remote database.
const SEEDED_TABLES = [
  // Identity and better auth.
  'User',
  'account',
  'session',
  'verification',
  'EmployeeProfile',
  'ClientProfile',
  'AuditLog',

  // Leave.
  'LeaveType',
  'Holiday',
  'LeaveRequest',
  'LeaveBalance',

  // Projects.
  'Project',
  'ProjectTypeTag',
  'ProjectMember',
  'ProjectDocument',
  'ProjectActivity',
  'TimeEntry',
  'MeetingTimeEntry',
  'AdditionalRequirement',
  'DailyWorkReport',
  'DailyProjectEntry',
  'BlockerReason',
  'Blocker',
  'ProjectInternalReview',
  'ClientFeedback',

  // AI.
  'AiJob',
  'AiTemplate',
  'ProjectStatusReport',

  // Notifications.
  'Notification',
];

/**
 * The same tables, in the order the seed reports their row counts.
 *
 * A separate list from `SEEDED_TABLES` because the ORDER is the point: the
 * report reads top down as identity, then leave, then projects, then AI. It
 * lives here rather than in `seed.ts` so both hand written lists sit in one
 * file, under one spec. A stale name here crashed `report()` on
 * `$queryRawUnsafe` AFTER the data was already written, which is a worse place
 * to fail than the reset.
 */
export const COUNTED_TABLES = [
  'User',
  'EmployeeProfile',
  'ClientProfile',
  'account',
  'session',
  'verification',
  'AuditLog',
  'LeaveType',
  'Holiday',
  'LeaveRequest',
  'LeaveBalance',
  'Project',
  'ProjectTypeTag',
  'ProjectMember',
  'ProjectDocument',
  'ProjectActivity',
  'TimeEntry',
  'MeetingTimeEntry',
  'AdditionalRequirement',
  'DailyWorkReport',
  'DailyProjectEntry',
  'BlockerReason',
  'Blocker',
  'ProjectInternalReview',
  'ClientFeedback',
  'AiTemplate',
  'AiJob',
  'ProjectStatusReport',
  'Notification',
];

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const quoted = SEEDED_TABLES.map((table) => `"public"."${table}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Every table the schema actually has, as Postgres names it.
 *
 * Exported so a spec can compare it against `SEEDED_TABLES` without a database.
 * That comparison is the point: `TRUNCATE` takes every table in ONE statement
 * and has no `IF EXISTS`, so a single stale name aborts the whole reset with a
 * bare `42P01` before a row is written. `PasswordResetCode` sat here for a
 * release after the table was dropped, and `pnpm seed` died on its first
 * statement. Raw SQL, so nothing failed at compile time.
 */
export function schemaTables(): string[] {
  return Prisma.dmmf.datamodel.models.map(
    (model) => model.dbName ?? model.name,
  );
}

export { SEEDED_TABLES };
