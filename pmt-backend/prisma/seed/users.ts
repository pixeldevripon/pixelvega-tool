import type { PrismaClient } from '@prisma/client';
import { Role, UserStatus, Weekday } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import {
  SEED_PASSWORD,
  SEED_TODAY,
  STAFF_EMAIL_DOMAIN,
  SYSTEM_ADMIN,
  TEST_ACCOUNTS,
  VOLUME,
} from './config';
import { Rand, addDays } from './random';
import {
  BIOS,
  COMPANY_PREFIXES,
  COMPANY_SUFFIXES,
  DESIGNATIONS,
  FIRST_NAMES,
  LAST_NAMES,
  TIMEZONES,
  USER_AGENTS,
} from './pools';

export type SeededUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  companyName?: string;
};

/** The fixed, known credential account for each role. */
export type TestAccounts = {
  systemAdmin: SeededUser;
  admin: SeededUser;
  projectManager: SeededUser;
  developer: SeededUser;
  designer: SeededUser;
  client: SeededUser;
};

export type SeededUsers = {
  /** Every row written to User, including the soft deleted ones. */
  all: SeededUser[];
  systemAdmin: SeededUser;
  /** One guaranteed sign in per role, wired to real data. */
  test: TestAccounts;
  /** Live users only. Everything downstream builds from these. */
  admins: SeededUser[];
  projectManagers: SeededUser[];
  developers: SeededUser[];
  designers: SeededUser[];
  clients: SeededUser[];
  /** Admins plus the system admin. These approve leave and archive projects. */
  adminSide: SeededUser[];
  /** Everyone who submits work: PM, developer, designer. */
  workforce: SeededUser[];
  /** Everyone who can hold an EmployeeProfile. */
  employees: SeededUser[];
};

const AVATAR_BASE =
  'https://res.cloudinary.com/demo/image/upload/v1/pmt/avatars';

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// A Slack member id looks like U followed by ten uppercase alphanumerics.
function slackUserId(rand: Rand): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'U';
  for (let i = 0; i < 10; i++) out += rand.pick(charset.split(''));
  return out;
}

export async function seedUsers(
  prisma: PrismaClient,
  rand: Rand,
): Promise<SeededUsers> {
  // Everyone shares one password, so hash it a single time. scrypt is slow on
  // purpose, and hashing it once per user would add minutes for no benefit.
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const staffPlan: { role: Role; count: number }[] = [
    { role: Role.ADMIN, count: VOLUME.admins },
    { role: Role.PROJECT_MANAGER, count: VOLUME.projectManagers },
    { role: Role.DEVELOPER, count: VOLUME.developers },
    { role: Role.DESIGNER, count: VOLUME.designers },
  ];

  const users: SeededUser[] = [];
  const userRows: any[] = [];
  const accountRows: any[] = [];
  const employeeProfileRows: any[] = [];
  const clientProfileRows: any[] = [];

  const takenEmails = new Set<string>();
  function uniqueEmail(base: string, domain: string): string {
    let candidate = `${base}@${domain}`;
    let suffix = 2;
    while (takenEmails.has(candidate)) {
      candidate = `${base}${suffix}@${domain}`;
      suffix++;
    }
    takenEmails.add(candidate);
    return candidate;
  }

  // The root account. Created first and oldest, the same way the app's own
  // bootstrap service would create it on an empty database.
  const systemAdminCreatedAt = addDays(SEED_TODAY, -540);
  const systemAdmin: SeededUser = {
    id: rand.authId(),
    email: SYSTEM_ADMIN.email,
    name: SYSTEM_ADMIN.name,
    role: Role.SYSTEM_ADMIN,
    status: UserStatus.ACTIVE,
    createdAt: systemAdminCreatedAt,
  };
  takenEmails.add(systemAdmin.email);
  users.push(systemAdmin);
  userRows.push({
    id: systemAdmin.id,
    email: systemAdmin.email,
    name: systemAdmin.name,
    emailVerified: true,
    role: Role.SYSTEM_ADMIN,
    status: UserStatus.ACTIVE,
    mustResetPassword: false,
    slackUserId: slackUserId(rand),
    avatarUrl: `${AVATAR_BASE}/system-admin.jpg`,
    avatarPublicId: 'pmt/avatars/system-admin',
    createdAt: systemAdminCreatedAt,
    updatedAt: systemAdminCreatedAt,
  });

  // The bootstrap service gives the system admin an employee profile too,
  // because SYSTEM_ADMIN is a staff role, not a client one.
  employeeProfileRows.push({
    id: rand.uuid(),
    userId: systemAdmin.id,
    designation: 'System Administrator',
    phone: `+8801${rand.int(300000000, 999999999)}`,
    timezone: 'Asia/Dhaka',
    bio: 'Owns the system admin account for this workspace.',
    currentStatus: 'WORKING',
    availabilityStatus: 'AVAILABLE',
    createdAt: systemAdminCreatedAt,
    updatedAt: systemAdminCreatedAt,
  });

  // The fixed test accounts, one per role. Created before the random ones so
  // their emails are never taken by a generated account, and always ACTIVE so
  // they can sign in straight away.
  const testCreatedAt = addDays(SEED_TODAY, -520);

  function addTestAccount(
    spec: { email: string; name: string; companyName?: string },
    role: Role,
    designation: string,
    weeklyOffDay: Weekday = Weekday.FRIDAY,
  ): SeededUser {
    const id = rand.authId();
    const user: SeededUser = {
      id,
      email: spec.email,
      name: spec.name,
      role,
      status: UserStatus.ACTIVE,
      createdAt: testCreatedAt,
      companyName: spec.companyName,
    };
    takenEmails.add(spec.email);
    users.push(user);
    userRows.push({
      id,
      email: spec.email,
      name: spec.name,
      emailVerified: true,
      role,
      status: UserStatus.ACTIVE,
      // Never forced through the reset flow, so signing in just works.
      mustResetPassword: false,
      weeklyOffDay,
      slackUserId: role === Role.CLIENT ? null : slackUserId(rand),
      avatarUrl: null,
      avatarPublicId: null,
      createdById: systemAdmin.id,
      createdAt: testCreatedAt,
      updatedAt: testCreatedAt,
    });

    if (role === Role.CLIENT) {
      clientProfileRows.push({
        id: rand.uuid(),
        userId: id,
        companyName: spec.companyName ?? spec.name,
        billingEmail: `billing@${spec.email.split('@')[1]}`,
        phone: '+8801700000000',
        timezone: 'Asia/Dhaka',
        createdAt: testCreatedAt,
        updatedAt: testCreatedAt,
      });
    } else {
      employeeProfileRows.push({
        id: rand.uuid(),
        userId: id,
        designation,
        phone: '+8801700000000',
        timezone: 'Asia/Dhaka',
        bio: `Fixed test account for the ${role} role.`,
        currentStatus: 'WORKING',
        availabilityStatus: 'AVAILABLE',
        createdAt: testCreatedAt,
        updatedAt: testCreatedAt,
      });
    }

    return user;
  }

  const testAdmin = addTestAccount(
    TEST_ACCOUNTS.admin,
    Role.ADMIN,
    'Operations Admin',
  );
  const testProjectManager = addTestAccount(
    TEST_ACCOUNTS.projectManager,
    Role.PROJECT_MANAGER,
    'Senior Project Manager',
  );
  // The one fixed account deliberately off on Saturday instead of the
  // default Friday, so working day calculations and reminder skip logic for
  // BOTH cases have a known, reproducible login to check by hand rather than
  // only relying on the random staff below.
  const testDeveloper = addTestAccount(
    TEST_ACCOUNTS.developer,
    Role.DEVELOPER,
    'Full Stack Developer',
    Weekday.SATURDAY,
  );
  const testDesigner = addTestAccount(
    TEST_ACCOUNTS.designer,
    Role.DESIGNER,
    'Product Designer',
  );
  const testClient = addTestAccount(TEST_ACCOUNTS.client, Role.CLIENT, '');

  // Staff accounts. Invited by the system admin, spread over the past year
  // and a half so createdAt ordering is worth sorting by.
  for (const { role, count } of staffPlan) {
    for (let i = 0; i < count; i++) {
      const firstName = rand.pick(FIRST_NAMES);
      const lastName = rand.pick(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const email = uniqueEmail(
        `${slug(firstName)}.${slug(lastName)}`,
        STAFF_EMAIL_DOMAIN,
      );
      const createdAt = rand.dateBetween(
        addDays(SEED_TODAY, -500),
        addDays(SEED_TODAY, -20),
      );

      // Most people are active. A few are still sitting on their invite, and
      // a couple have been suspended, so both filters have rows to find.
      const roll = rand.float();
      const status =
        roll < 0.82
          ? UserStatus.ACTIVE
          : roll < 0.94
            ? UserStatus.INVITED
            : UserStatus.SUSPENDED;

      const id = rand.authId();
      const hasAvatar = rand.chance(0.55);
      const avatarPublicId = hasAvatar
        ? `pmt/avatars/${slug(name)}-${rand.hex(6)}`
        : null;
      // Most of the team stays on the Friday default. A minority is
      // deliberately given Saturday instead, so working day calculations and
      // reminder skip logic both have real Saturday-off rows to exercise,
      // not just the one fixed testDeveloper account.
      const weeklyOffDay = rand.chance(0.2) ? Weekday.SATURDAY : Weekday.FRIDAY;

      users.push({ id, email, name, role, status, createdAt });
      userRows.push({
        id,
        email,
        name,
        emailVerified: status !== UserStatus.INVITED,
        role,
        status,
        mustResetPassword: status === UserStatus.INVITED,
        weeklyOffDay,
        slackUserId: rand.chance(0.7) ? slackUserId(rand) : null,
        avatarUrl: avatarPublicId
          ? `${AVATAR_BASE}/${avatarPublicId.split('/').pop()}.jpg`
          : null,
        avatarPublicId,
        createdById: systemAdmin.id,
        createdAt,
        updatedAt: rand.dateBetween(createdAt, SEED_TODAY),
      });

      employeeProfileRows.push({
        id: rand.uuid(),
        userId: id,
        designation: rand.pick(DESIGNATIONS),
        phone: `+8801${rand.int(300000000, 999999999)}`,
        timezone: rand.chance(0.75) ? 'Asia/Dhaka' : rand.pick(TIMEZONES),
        bio: rand.maybe(BIOS, 0.35) ?? null,
        // currentStatus is the work status. availabilityStatus is the
        // staffing signal. They are separate fields on purpose.
        currentStatus: rand.chance(0.12) ? 'ON_LEAVE' : 'WORKING',
        availabilityStatus: rand.pick([
          'AVAILABLE',
          'AVAILABLE',
          'AVAILABLE',
          'BUSY',
          'BUSY',
          'UNAVAILABLE',
        ] as const),
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  // Client accounts. One per company, so the client list reads like a real
  // customer base and Project.clientId has plenty to point at.
  const takenCompanies = new Set<string>();
  for (let i = 0; i < VOLUME.clients; i++) {
    let companyName = `${rand.pick(COMPANY_PREFIXES)} ${rand.pick(COMPANY_SUFFIXES)}`;
    let guard = 0;
    while (takenCompanies.has(companyName) && guard < 50) {
      companyName = `${rand.pick(COMPANY_PREFIXES)} ${rand.pick(COMPANY_SUFFIXES)}`;
      guard++;
    }
    if (takenCompanies.has(companyName)) {
      companyName = `${companyName} ${i + 1}`;
    }
    takenCompanies.add(companyName);

    const firstName = rand.pick(FIRST_NAMES);
    const lastName = rand.pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const domain = `${slug(companyName)}.com`;
    const email = uniqueEmail(slug(firstName), domain);
    const createdAt = rand.dateBetween(
      addDays(SEED_TODAY, -480),
      addDays(SEED_TODAY, -10),
    );

    const roll = rand.float();
    const status =
      roll < 0.7
        ? UserStatus.ACTIVE
        : roll < 0.95
          ? UserStatus.INVITED
          : UserStatus.SUSPENDED;

    const id = rand.authId();
    users.push({
      id,
      email,
      name,
      role: Role.CLIENT,
      status,
      createdAt,
      companyName,
    });
    userRows.push({
      id,
      email,
      name,
      emailVerified: status !== UserStatus.INVITED,
      role: Role.CLIENT,
      status,
      mustResetPassword: status === UserStatus.INVITED,
      slackUserId: null, // clients are never in the internal Slack workspace
      avatarUrl: null,
      avatarPublicId: null,
      createdById: systemAdmin.id,
      createdAt,
      updatedAt: rand.dateBetween(createdAt, SEED_TODAY),
    });

    clientProfileRows.push({
      id: rand.uuid(),
      userId: id,
      companyName,
      billingEmail: `billing@${domain}`,
      phone: `+1${rand.int(2000000000, 9899999999)}`,
      timezone: rand.pick(TIMEZONES),
      createdAt,
      updatedAt: createdAt,
    });
  }

  // A credential account per user, holding the shared password hash. This is
  // the row better auth reads on sign in, User.password is never used.
  for (const user of users) {
    accountRows.push({
      id: rand.authId(),
      accountId: user.id, // better auth uses the user id for credential accounts
      providerId: 'credential',
      userId: user.id,
      password: passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
    });
  }

  await prisma.user.createMany({ data: userRows });
  await prisma.account.createMany({ data: accountRows });
  await prisma.employeeProfile.createMany({ data: employeeProfileRows });
  await prisma.clientProfile.createMany({ data: clientProfileRows });

  // Soft delete a few accounts so the deletedAt filters on GET /users have
  // something to exclude. These are picked from the tail of each group and
  // are left out of every pool below, so no project ends up staffed by or
  // owned by a deleted user.
  // The fixed test accounts are never soft deleted, they have to stay usable.
  const protectedIds = new Set([
    systemAdmin.id,
    testAdmin.id,
    testProjectManager.id,
    testDeveloper.id,
    testDesigner.id,
    testClient.id,
  ]);
  const deletableStaff = users.filter(
    (u) =>
      !protectedIds.has(u.id) &&
      (u.role === Role.DEVELOPER || u.role === Role.DESIGNER),
  );
  const deletableClients = users.filter(
    (u) => !protectedIds.has(u.id) && u.role === Role.CLIENT,
  );
  const softDeleted = new Set<string>([
    ...rand.sample(deletableStaff, 5).map((u) => u.id),
    ...rand.sample(deletableClients, 6).map((u) => u.id),
  ]);

  for (const id of softDeleted) {
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: rand.dateBetween(addDays(SEED_TODAY, -90), SEED_TODAY),
      },
    });
  }

  const live = users.filter((u) => !softDeleted.has(u.id));
  const byRole = (role: Role) => live.filter((u) => u.role === role);

  const admins = byRole(Role.ADMIN);
  const projectManagers = byRole(Role.PROJECT_MANAGER);
  const developers = byRole(Role.DEVELOPER);
  const designers = byRole(Role.DESIGNER);
  const clients = byRole(Role.CLIENT);

  // Sessions, verification tokens, and reset codes. These exist so the better
  // auth tables are not empty while testing, they are not real usable logins.
  await seedAuthSideTables(prisma, rand, live);

  return {
    all: users,
    systemAdmin,
    test: {
      systemAdmin,
      admin: testAdmin,
      projectManager: testProjectManager,
      developer: testDeveloper,
      designer: testDesigner,
      client: testClient,
    },
    admins,
    projectManagers,
    developers,
    designers,
    clients,
    adminSide: [systemAdmin, ...admins],
    workforce: [...projectManagers, ...developers, ...designers],
    employees: [
      systemAdmin,
      ...admins,
      ...projectManagers,
      ...developers,
      ...designers,
    ],
  };
}

async function seedAuthSideTables(
  prisma: PrismaClient,
  rand: Rand,
  live: SeededUser[],
) {
  const activeUsers = live.filter((u) => u.status === UserStatus.ACTIVE);

  const sessionRows: any[] = [];
  for (let i = 0; i < VOLUME.sessions; i++) {
    const user = rand.pick(activeUsers);
    const createdAt = rand.dateBetween(addDays(SEED_TODAY, -30), SEED_TODAY);
    sessionRows.push({
      id: rand.authId(),
      token: rand.authId(),
      userId: user.id,
      // Roughly a third are already expired, so both sides of the expiry
      // check have rows.
      expiresAt: rand.chance(0.33)
        ? addDays(createdAt, -rand.int(1, 10))
        : addDays(createdAt, rand.int(1, 7)),
      ipAddress: rand.chance(0.8)
        ? `${rand.int(1, 223)}.${rand.int(0, 255)}.${rand.int(0, 255)}.${rand.int(1, 254)}`
        : '',
      userAgent: rand.pick(USER_AGENTS),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await prisma.session.createMany({ data: sessionRows });

  // Verification rows are what better auth writes for email verification and
  // similar one time tokens.
  const verificationRows: any[] = [];
  for (let i = 0; i < VOLUME.verifications; i++) {
    const user = rand.pick(live);
    const createdAt = rand.dateBetween(addDays(SEED_TODAY, -60), SEED_TODAY);
    verificationRows.push({
      id: rand.authId(),
      identifier: `email-verification:${user.email}`,
      value: rand.hex(48),
      expiresAt: addDays(createdAt, 1),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await prisma.verification.createMany({ data: verificationRows });
}
