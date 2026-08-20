import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  GUARANTEED_TEST_PROJECTS,
  RANDOM_SEED,
  SEED_PASSWORD,
  SEED_TODAY,
  VOLUME,
} from './seed/config';
import { Rand, addDays } from './seed/random';
import { COUNTED_TABLES, resetDatabase } from './seed/reset';
import { seedUsers } from './seed/users';
import type { TestAccounts } from './seed/users';
import { seedReference } from './seed/reference';
import { seedLeave } from './seed/leave';
import { seedProjects } from './seed/projects';
import { seedDocuments } from './seed/documents';
import { seedTimeTracking } from './seed/time-tracking';
import { seedWorkflow } from './seed/workflow';
import { seedWorkReports } from './seed/work-reports';
import { seedAi } from './seed/ai';
import { seedLogs } from './seed/logs';

const MINIMUM_ROWS = 100;

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

// Runs promises a few at a time. The pg pool only holds ten connections, so
// firing hundreds of updates at once would just queue them anyway.
async function runInChunks<T>(
  items: T[],
  size: number,
  handler: (item: T) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(handler));
  }
}

async function main() {
  const force = process.argv.includes('--force');
  if (process.env.NODE_ENV === 'production' && !force) {
    throw new Error(
      'Refusing to seed with NODE_ENV=production. This deletes every row in every table. Pass --force if you really mean it.',
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Check your .env file.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const rand = new Rand(RANDOM_SEED);
  const startedAt = Date.now();

  try {
    log('Clearing every seeded table.');
    await resetDatabase(prisma);

    log('Seeding users, profiles, and auth rows.');
    const users = await seedUsers(prisma, rand);

    log(
      'Seeding reference data: leave types, holidays, blocker reasons, AI templates.',
    );
    const reference = await seedReference(prisma, rand, users);

    log('Seeding leave requests and balances.');
    const leave = await seedLeave(prisma, rand, users, reference);
    log(`  ${leave.requestCount} requests, ${leave.balanceCount} balances.`);

    log('Seeding projects, type tags, and staffing.');
    const projects = await seedProjects(prisma, rand, users);

    log('Seeding project documents.');
    const documentCount = await seedDocuments(prisma, rand, users, projects);
    log(`  ${documentCount} documents.`);

    log('Seeding project and meeting time entries.');
    const time = await seedTimeTracking(prisma, rand, users, projects);
    log(
      `  ${time.timeEntryCount} project segments, ${time.meetingEntryCount} meeting segments.`,
    );

    // actualHours is not a column anyone sets by hand. It is the sum of every
    // ended segment's minutes divided by sixty, recalculated whenever a
    // segment ends, so it is computed here the same way.
    log('Recalculating actualHours from the seeded time entries.');
    await runInChunks(projects, 10, async (project) => {
      const minutes = time.projectMinutes.get(project.id) ?? 0;
      if (minutes === 0) return;
      await prisma.project.update({
        where: { id: project.id },
        data: { actualHours: minutes / 60 },
      });
    });

    log(
      'Seeding additional requirements, blockers, internal reviews, and client feedback.',
    );
    const workflow = await seedWorkflow(
      prisma,
      rand,
      users,
      projects,
      reference,
    );

    // Approved requirements and resolved blockers are both additive on top of
    // the project's own deadline and estimate, never an override. The stored
    // values have to already include them, which is what the app leaves behind.
    log('Applying approved hour and deadline changes to the projects.');
    const adjusted = projects.filter(
      (project) =>
        (workflow.deadlineExtensions.get(project.id) ?? 0) > 0 ||
        (workflow.hourAdditions.get(project.id) ?? 0) > 0,
    );
    await runInChunks(adjusted, 10, async (project) => {
      const extraDays = workflow.deadlineExtensions.get(project.id) ?? 0;
      const extraHours = workflow.hourAdditions.get(project.id) ?? 0;

      // A null deadline is extended from today, matching how the app treats it.
      const deadline =
        extraDays > 0
          ? addDays(project.deadline ?? SEED_TODAY, extraDays)
          : project.deadline;
      // A null estimate counts as zero before the extra hours are added.
      const estimatedHours =
        extraHours > 0
          ? Math.round(((project.estimatedHours ?? 0) + extraHours) * 10) / 10
          : project.estimatedHours;

      // Keep the in memory copies in step, so anything seeded after this reads
      // the same numbers the database now holds.
      project.deadline = deadline;
      project.estimatedHours = estimatedHours;

      await prisma.project.update({
        where: { id: project.id },
        data: { deadline, estimatedHours },
      });
    });

    log('Seeding daily work reports and project entries.');
    const workReports = await seedWorkReports(prisma, rand, users, projects);
    log(
      `  ${workReports.reportCount} reports, ${workReports.entryCount} project entries.`,
    );

    log('Seeding AI status reports and jobs.');
    const ai = await seedAi(prisma, rand, users, projects, reference);
    log(`  ${ai.statusReportCount} status reports, ${ai.jobCount} jobs.`);

    log('Seeding project activity, audit logs, and notifications.');
    await seedLogs(prisma, rand, users, projects);

    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    await report(prisma, elapsedSeconds, users.test);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function report(
  prisma: PrismaClient,
  elapsedSeconds: string,
  test: TestAccounts,
) {
  // Count straight from the database rather than trusting the in memory
  // totals, so the report reflects what actually landed.
  const counts: { table: string; count: number }[] = [];
  for (const table of COUNTED_TABLES) {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM "public"."${table}"`,
    );
    counts.push({ table, count: Number(result[0].count) });
  }

  const widest = Math.max(...counts.map((row) => row.table.length));
  log('');
  log(`Seed finished in ${elapsedSeconds}s.`);
  log('');
  log('Row counts');
  log('-'.repeat(widest + 14));
  for (const { table, count } of counts) {
    const flag = count < MINIMUM_ROWS ? '  under 100' : '';
    log(`${table.padEnd(widest)}  ${String(count).padStart(6)}${flag}`);
  }
  log('-'.repeat(widest + 14));

  const short = counts.filter((row) => row.count < MINIMUM_ROWS);
  if (short.length > 0) {
    log('');
    log(
      `Warning: ${short.length} table(s) have fewer than ${MINIMUM_ROWS} rows: ${short
        .map((row) => row.table)
        .join(', ')}`,
    );
    log('Raise the matching numbers in prisma/seed/config.ts and seed again.');
  }

  // Login credentials, one guaranteed account per role. Every seeded account
  // shares the same password, these are just the ones that are always ACTIVE
  // and always have data attached.
  const order: (keyof TestAccounts)[] = [
    'systemAdmin',
    'admin',
    'projectManager',
    'developer',
    'designer',
    'client',
  ];
  const emailWidth = Math.max(
    ...order.map((key) => test[key].email.length),
    'Email'.length,
  );

  log('');
  log('Test logins, one per role. Every seeded account shares this password.');
  log('');
  log(`  ${'Role'.padEnd(16)}${'Email'.padEnd(emailWidth + 2)}Password`);
  log(`  ${'-'.repeat(16 + emailWidth + 2 + 8)}`);
  for (const key of order) {
    const account = test[key];
    log(
      `  ${account.role.padEnd(16)}${account.email.padEnd(emailWidth + 2)}${SEED_PASSWORD}`,
    );
  }
  log('');
  log(
    `The test project manager, developer, designer, and client all share the first ${GUARANTEED_TEST_PROJECTS} projects,`,
  );
  log(
    'so each of those logins has projects, hours, reports, and feedback to read.',
  );
  log('');
  log(
    `History runs from ${addDays(SEED_TODAY, -VOLUME.timeTrackingDays).toISOString().slice(0, 10)} to ${SEED_TODAY.toISOString().slice(0, 10)}.`,
  );
}

main().catch((error) => {
  process.exitCode = 1;
  console.error('\nSeed failed.');
  console.error(error);
});
