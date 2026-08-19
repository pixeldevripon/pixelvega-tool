// Every knob the seed uses lives here, so changing data volume never means
// editing the seeders themselves.
//
// Every count below is at least 100, so each table has enough rows to test
// pagination, filtering, sorting, and the report endpoints for real.

// Fixed seed for the random generator. The same value always produces the
// same database, which means ids stay stable across reseeds and a Postman
// collection can keep using real ids as default variable values.
export const RANDOM_SEED = 20260819;

// Every seeded account shares this password, so you can log in as anyone
// while testing. Change it here and reseed if you want a different one.
export const SEED_PASSWORD = 'Password123!';

// The seed builds its history backwards from this date. It is fixed, not
// "today", so a reseed always produces the same dates.
export const SEED_TODAY = new Date(Date.UTC(2026, 7, 19)); // 2026 08 19

// Email domain used for every generated staff account.
export const STAFF_EMAIL_DOMAIN = 'pixelvega.com';

// The one root account. Matches SEED_ADMIN_EMAIL in .env so the app's own
// bootstrap service stays a no op after seeding.
export const SYSTEM_ADMIN = {
  email: 'jabed@pixelvega.com',
  name: 'Jabed Hasan',
};

// One fixed account per role, so there is always a known email to sign in with
// for every permission level. These are always ACTIVE, always verified, and
// never asked to reset their password, unlike the randomly generated accounts.
// The seed also guarantees each of them real data to look at: see
// GUARANTEED_TEST_PROJECTS below.
export const TEST_ACCOUNTS = {
  admin: { email: 'admin@pixelvega.com', name: 'Test Admin' },
  projectManager: { email: 'pm@pixelvega.com', name: 'Test Project Manager' },
  developer: { email: 'developer@pixelvega.com', name: 'Test Developer' },
  designer: { email: 'designer@pixelvega.com', name: 'Test Designer' },
  client: {
    email: 'client@pixelvega.com',
    name: 'Test Client',
    companyName: 'Test Client Company',
  },
} as const;

// How many projects are wired to the test accounts above: the test client owns
// them, the test project manager runs them, and the test developer and
// designer are staffed on them. Enough to cover several project statuses at
// once, so every workflow is reachable from a test login.
export const GUARANTEED_TEST_PROJECTS = 14;

export const VOLUME = {
  // Users. Employee and client profiles are one per user, so each group has
  // to clear 100 on its own for both profile tables to clear 100 too.
  admins: 8,
  projectManagers: 26,
  developers: 64,
  designers: 30,
  clients: 112,

  // better-auth tables.
  sessions: 180,
  verifications: 140,

  // Reference data.
  leaveTypes: 104,
  blockerReasons: 106,
  aiTemplatesPerKind: 55, // times 2 kinds, so 110 rows
  holidayYears: [2025, 2026, 2027],

  // Leave workflow.
  leaveRequests: 420,
  leaveBalanceYears: [2025, 2026],

  // Projects and everything hanging off them.
  projects: 120,
  documentsPerProject: [2, 6] as const,
  membersPerProject: [3, 7] as const,
  additionalRequirementsPerProject: [1, 4] as const,
  blockersPerProject: [1, 4] as const,
  internalReviewRounds: [1, 4] as const,
  // At least two, so this table clears 100 rows across the projects that have
  // actually been in front of a client.
  clientFeedbackRounds: [2, 4] as const,
  statusReportsPerProject: [1, 3] as const,
  aiJobsPerProject: [1, 3] as const,

  // Time tracking. Days back from SEED_TODAY that segments are spread over.
  timeTrackingDays: 24,
  runningTimeEntries: 6, // people with a live project timer right now
  runningMeetingEntries: 4, // people with a live meeting timer right now

  // Daily work reports. One report per person per day, so the row count is
  // roughly staff count times workingDays.
  workReportDays: 14,

  // Cross cutting logs.
  auditLogs: 760,
  notifications: 1400,
} as const;
