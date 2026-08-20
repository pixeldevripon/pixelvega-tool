// Every knob the seed uses lives here, so changing data volume never means
// editing the seeders themselves.
//
// The numbers are deliberately small. An earlier version held every table above
// 100 rows, which meant 90 of the 104 leave types were called
// "Bereavement Leave Category 7" and nothing was learned from any of them. A
// dataset you can read end to end in the UI is worth more than one you can only
// paginate through: see docs/features/seed/DESIGN.md.

// Fixed seed for the random generator. The same value always produces the
// same database, which means ids stay stable across reseeds and a Postman
// collection can keep using real ids as default variable values.
export const RANDOM_SEED = 20260819;

// Every seeded account EXCEPT the root one shares this password, so you can log
// in as anyone while testing. The root account's password comes from
// ADMIN_PASSWORD, because that account also exists in environments this seed
// never touches.
export const SEED_PASSWORD = 'Password123!';

// The seed builds its history backwards from this date. It is fixed, not
// "today", so a reseed always produces the same dates.
export const SEED_TODAY = new Date(Date.UTC(2026, 7, 19)); // 2026 08 19

// Email domain used for every generated staff account.
export const STAFF_EMAIL_DOMAIN = 'pixelvega.com';

/** better-auth's own minimum. A shorter password is rejected at sign up. */
const MIN_ADMIN_PASSWORD_LENGTH = 8;

export type SystemAdminCredentials = {
  email: string;
  name: string;
  password: string;
};

/**
 * The one root account, read from the environment.
 *
 * Not a constant in this file. The same three variables drive
 * `SystemAdminBootstrapService`, which creates this account on first boot in
 * every environment the seed never runs in, and an account identity that lives
 * in two places drifts. `src/env.validate.ts` declares them for the app; this
 * function is the seed's own gate, because the seed runs as a script and never
 * reaches that validator.
 *
 * Called before `resetDatabase`, so a missing value stops the run while the
 * database is still intact. Truncating 29 tables and then failing on the first
 * user leaves a worse state than not starting.
 */
export function systemAdminFromEnv(): SystemAdminCredentials {
  const email = process.env.ADMIN_EMAIL?.trim();
  const name = process.env.ADMIN_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  const missing = [
    ['ADMIN_EMAIL', email],
    ['ADMIN_NAME', name],
    ['ADMIN_PASSWORD', password],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `${missing.join(', ')} must be set in .env before seeding. The root account is created from these, and nothing else can create one.`,
    );
  }
  if (!email!.includes('@')) {
    throw new Error(`ADMIN_EMAIL is not an email address: ${email}`);
  }
  if (password!.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters, which is better-auth's minimum. A shorter one seeds an account that cannot sign in.`,
    );
  }

  return { email: email!, name: name!, password: password! };
}

// One fixed account per role, so there is always a known email to sign in with
// for every permission level. These are always ACTIVE, always verified, and
// never asked to reset their password, unlike the randomly generated accounts.
// The seed also guarantees each of them real data to look at: see
// GUARANTEED_TEST_PROJECTS below.
//
// Each one counts against its role's total in VOLUME below. There is no fixed
// account for SYSTEM_ADMIN: the root account from the environment IS that login.
export const TEST_ACCOUNTS = {
  // Not admin@pixelvega.com. That is the address ADMIN_EMAIL is most often set
  // to, and the root account claims its email first, so the fixed ADMIN would
  // have been pushed to admin2@ in the common case: two near identical
  // addresses in the credentials table, one SYSTEM_ADMIN and one ADMIN, is a
  // sign-in nobody gets right first time.
  admin: { email: 'ops-admin@pixelvega.com', name: 'Test Admin' },
  projectManager: { email: 'pm@pixelvega.com', name: 'Test Project Manager' },
  developer: { email: 'developer@pixelvega.com', name: 'Test Developer' },
  designer: { email: 'designer@pixelvega.com', name: 'Test Designer' },
  client: {
    email: 'client@pixelvega.com',
    name: 'Test Client',
    companyName: 'Test Client Company',
  },
} as const;

/** How many roles get a fixed test account: one each, so one row per role. */
export const FIXED_ACCOUNTS_PER_ROLE = 1;

// How many projects are wired to the test accounts above: the test client owns
// them, the test project manager runs them, and the test developer and
// designer are staffed on them. Enough to cover several project statuses at
// once, so every workflow is reachable from a test login.
export const GUARANTEED_TEST_PROJECTS = 6;

/**
 * Where seeded profile photos come from.
 *
 * Real portraits at a stable path, so a seeded avatar loads rather than showing
 * the initials fallback everywhere. `men/0..99` and `women/0..99` both exist,
 * which is what lets a photo match the row's `gender`.
 *
 * These are NOT assets in this workspace's Cloudinary account, so every seeded
 * row keeps `avatarPublicId: null`. A public id Cloudinary does not hold would
 * make the replace path try to destroy something that is not there.
 */
export const AVATAR = {
  baseUrl: 'https://randomuser.me/api/portraits',
  /** Portraits available per folder, indexed from 0. */
  poolSize: 100,
  /**
   * Share of generated accounts that get one. The rest keep null on purpose:
   * the initials fallback is a state the UI has to get right too. Every fixed
   * account gets a photo regardless of this.
   */
  chance: 0.8,
} as const;

export const VOLUME = {
  // Users, as TOTAL rows per role, INCLUDING that role's one fixed test
  // account. The root SYSTEM_ADMIN sits on top of these, so the User table
  // holds 1 + 3 + 4 + 10 + 5 + 10 = 33 rows.
  admins: 3,
  projectManagers: 4,
  developers: 10,
  designers: 5,
  clients: 10,

  // Soft deleted accounts, so the deletedAt filters on GET /users have
  // something to exclude. Only developers, designers and clients are eligible,
  // and never a fixed account: see softDeletableUsers in users.ts.
  softDeletedStaff: 1,
  softDeletedClients: 1,

  // better-auth tables. Not usable logins, they exist so the tables are not
  // empty while testing.
  sessions: 24,
  verifications: 12,

  // Reference data. leaveTypes and blockerReasons are floored by the curated
  // lists in pools.ts (14 and 32 rows): a smaller number here yields exactly
  // those lists, which is the intent. Anything larger appends generated filler.
  leaveTypes: 14,
  blockerReasons: 32,
  softDeletedBlockerReasons: 3,
  aiTemplatesPerKind: 2, // times 2 kinds, so 4 rows
  holidayYears: [2026],

  // Leave workflow.
  leaveRequests: 40,
  leaveBalanceYears: [2025, 2026],
  /** Leave types each person holds a balance for, per year. */
  leaveBalanceTypesPerUser: 3,

  // Projects and everything hanging off them. STATUS_PLAN in projects.ts
  // spreads them across the state machine and has to sum to this number.
  projects: 20,
  documentsPerProject: [1, 3] as const,
  membersPerProject: [2, 4] as const,
  additionalRequirementsPerProject: [1, 2] as const,
  blockersPerProject: [1, 2] as const,
  internalReviewRounds: [1, 2] as const,
  clientFeedbackRounds: [1, 2] as const,
  statusReportsPerProject: [1, 2] as const,
  aiJobsPerProject: [1, 2] as const,

  // Time tracking. Days back from SEED_TODAY that segments are spread over.
  timeTrackingDays: 10,
  /** People who log project time on a given day. Capped by the pool size. */
  workersLoggingTimePerDay: 8,
  /** People who log a meeting on a given day. Capped by the pool size. */
  meetingAttendeesPerDay: 5,
  runningTimeEntries: 3, // people with a live project timer right now
  runningMeetingEntries: 2, // people with a live meeting timer right now

  // Daily work reports. One report per person per day.
  workReportDays: 7,
  /** People who file a report on a given day. Capped by the pool size. */
  reportAuthorsPerDay: 10,

  // Cross cutting logs.
  auditLogs: 80,
  notifications: 60,
} as const;
