import type { PrismaClient } from '@prisma/client';

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
  'PasswordResetCode',
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

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const quoted = SEEDED_TABLES.map((table) => `"public"."${table}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}

export { SEEDED_TABLES };
