import type { PrismaClient } from '@prisma/client';
import {
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';
import { GUARANTEED_TEST_PROJECTS, SEED_TODAY, VOLUME } from './config';
import { Rand, addDays } from './random';
import {
  CANCELLATION_REASONS,
  COMPANY_PREFIXES,
  ON_HOLD_REASONS,
  PROJECT_DESCRIPTIONS,
  PROJECT_NOUNS,
  RUSH_REASONS,
} from './pools';
import type { SeededUser, SeededUsers } from './users';

export type SeededMember = {
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
  leftAt: Date | null;
};

export type SeededProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  clientId: string;
  createdById: string;
  createdAt: Date;
  plannedStartDate: Date | null;
  deadline: Date | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  estimatedHours: number | null;
  slackChannelId: string | null;
  types: ProjectType[];
  members: SeededMember[];
  /** Active PM ids. Every project past PLANNING has at least one. */
  managerIds: string[];
  /** Active developer and designer ids. */
  workerIds: string[];
  /** Every active member id, whatever their role. */
  memberIds: string[];
  /** True once the work has been through the internal QA gate at least once. */
  hasInternalReview: boolean;
  /** True once the client has given a decision at least once. */
  hasClientFeedback: boolean;
  /** True while the project is still open for new work. */
  isActive: boolean;
};

// How the 120 projects are spread across the state machine. Written out by
// hand rather than picked at random, so every status has enough rows to test
// its own filters and so the late stage statuses can carry the review and
// feedback history that has to hang off them.
const STATUS_PLAN: [ProjectStatus, number][] = [
  [ProjectStatus.PLANNING, 8],
  [ProjectStatus.SCHEDULED, 8],
  [ProjectStatus.READY_FOR_WORK, 12],
  [ProjectStatus.IN_PROGRESS, 22],
  [ProjectStatus.ON_HOLD, 8],
  [ProjectStatus.INTERNAL_REVIEW, 10],
  [ProjectStatus.READY_FOR_CLIENT, 10],
  [ProjectStatus.WAITING_FOR_FEEDBACK, 10],
  [ProjectStatus.COMPLETED, 24],
  [ProjectStatus.CANCELLED, 8],
];

// Statuses a project can still be worked on from. Mirrors the non terminal
// set the app uses for workload counting.
const OPEN_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.SCHEDULED,
  ProjectStatus.READY_FOR_WORK,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
  ProjectStatus.INTERNAL_REVIEW,
  ProjectStatus.READY_FOR_CLIENT,
  ProjectStatus.WAITING_FOR_FEEDBACK,
];

// Statuses that can only be reached by passing the internal QA gate.
const PAST_INTERNAL_REVIEW: ProjectStatus[] = [
  ProjectStatus.READY_FOR_CLIENT,
  ProjectStatus.WAITING_FOR_FEEDBACK,
  ProjectStatus.COMPLETED,
];

const RUSH_PRIORITIES: ProjectPriority[] = [
  ProjectPriority.URGENT,
  ProjectPriority.CRITICAL,
];

const ALL_PROJECT_TYPES = Object.values(ProjectType);

// A Slack channel id looks like C followed by ten uppercase alphanumerics.
// Only the id is stored on Project, the channel name is not.
function slackChannelId(rand: Rand): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'C';
  for (let i = 0; i < 10; i++) out += rand.pick(charset.split(''));
  return out;
}

export async function seedProjects(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
): Promise<SeededProject[]> {
  const statuses = rand.shuffle(
    STATUS_PLAN.flatMap(([status, count]) =>
      Array.from({ length: count }, () => status),
    ),
  );

  const projects: SeededProject[] = [];
  const projectRows: any[] = [];
  const typeTagRows: any[] = [];
  const memberRows: any[] = [];

  const usedNames = new Set<string>();

  for (let i = 0; i < Math.min(statuses.length, VOLUME.projects); i++) {
    const status = statuses[i];

    // The first block of projects belongs to the fixed test accounts, so a
    // test login always has projects to open rather than depending on the
    // random draw below.
    const isTestProject = i < GUARANTEED_TEST_PROJECTS;
    const client = isTestProject ? users.test.client : rand.pick(users.clients);

    let name = `${client.companyName ?? rand.pick(COMPANY_PREFIXES)} ${rand.pick(PROJECT_NOUNS)}`;
    if (usedNames.has(name)) name = `${name} ${i + 1}`;
    usedNames.add(name);

    const id = rand.uuid();
    const types = rand.sample(ALL_PROJECT_TYPES, rand.int(1, 3));

    // A project manager normally creates the project, and the app auto staffs
    // them on it. Sometimes an admin creates it instead, and then no member
    // row comes for free, so a PM has to be added explicitly below.
    // A test project is always created by the test project manager, which also
    // auto staffs them on it.
    const createdByPm = isTestProject ? true : rand.chance(0.8);
    const creator: SeededUser = isTestProject
      ? users.test.projectManager
      : createdByPm
        ? rand.pick(users.projectManagers)
        : rand.pick(users.adminSide);

    const createdAt = rand.dateBetween(
      addDays(SEED_TODAY, -420),
      addDays(SEED_TODAY, -6),
    );

    const priority = rand.pick([
      ProjectPriority.LOW,
      ProjectPriority.MEDIUM,
      ProjectPriority.MEDIUM,
      ProjectPriority.MEDIUM,
      ProjectPriority.HIGH,
      ProjectPriority.HIGH,
      ProjectPriority.URGENT,
      ProjectPriority.CRITICAL,
    ]);
    // A rush reason is required for URGENT and CRITICAL, and must be null for
    // every other priority.
    const rushReason = RUSH_PRIORITIES.includes(priority)
      ? rand.pick(RUSH_REASONS)
      : null;

    const plannedStartDate =
      status === ProjectStatus.PLANNING && rand.chance(0.4)
        ? null
        : status === ProjectStatus.SCHEDULED
          ? addDays(SEED_TODAY, rand.int(3, 45)) // still in the future
          : addDays(createdAt, rand.int(2, 20));

    const deadline = rand.chance(0.9)
      ? addDays(plannedStartDate ?? createdAt, rand.int(20, 160))
      : null;

    // Only a COMPLETED project has a completion date.
    const completedAt =
      status === ProjectStatus.COMPLETED
        ? rand.dateBetween(addDays(createdAt, 20), SEED_TODAY)
        : null;

    // Archiving is a separate flag on top of status, and only a COMPLETED or
    // CANCELLED project can carry it.
    const canArchive =
      status === ProjectStatus.COMPLETED || status === ProjectStatus.CANCELLED;
    const archivedAt =
      canArchive && rand.chance(0.45)
        ? rand.dateBetween(completedAt ?? addDays(createdAt, 30), SEED_TODAY)
        : null;

    const onHoldReason =
      status === ProjectStatus.ON_HOLD ? rand.pick(ON_HOLD_REASONS) : null;
    const cancellationReason =
      status === ProjectStatus.CANCELLED
        ? rand.pick(CANCELLATION_REASONS)
        : null;

    // Most projects have an estimate. A few do not, so remainingHours has a
    // null case to return.
    const estimatedHours = rand.chance(0.85) ? rand.decimal(24, 420, 1) : null;

    // Slack channel creation happens once at project creation time and can
    // fail silently, which leaves the project with no channel forever. A few
    // rows keep that null so the backfill endpoint has something to fix.
    const channelId = rand.chance(0.85) ? slackChannelId(rand) : null;

    // Whether the work has already been through internal QA. Anything past
    // the gate must have a review history. Anything earlier may still have
    // one, from a round that sent the work back.
    const hasInternalReview =
      PAST_INTERNAL_REVIEW.includes(status) ||
      (status === ProjectStatus.INTERNAL_REVIEW && rand.chance(0.5)) ||
      ((status === ProjectStatus.READY_FOR_WORK ||
        status === ProjectStatus.IN_PROGRESS ||
        status === ProjectStatus.ON_HOLD ||
        status === ProjectStatus.CANCELLED) &&
        rand.chance(0.45));

    // A project sitting in WAITING_FOR_FEEDBACK is waiting for its first ever
    // client decision, so it must have none yet: the first round is what would
    // move it out of that status.
    const hasClientFeedback =
      status === ProjectStatus.COMPLETED ||
      (status !== ProjectStatus.WAITING_FOR_FEEDBACK &&
        status !== ProjectStatus.PLANNING &&
        status !== ProjectStatus.SCHEDULED &&
        hasInternalReview &&
        rand.chance(0.6));

    projectRows.push({
      id,
      name,
      description: rand.pick(PROJECT_DESCRIPTIONS),
      status,
      priority,
      rushReason,
      clientId: client.id,
      createdById: creator.id,
      plannedStartDate,
      deadline,
      completedAt,
      onHoldReason,
      cancellationReason,
      archivedAt,
      estimatedHours,
      actualHours: 0, // recomputed from the seeded time entries later
      slackChannelId: channelId,
      createdAt,
      updatedAt: completedAt ?? rand.dateBetween(createdAt, SEED_TODAY),
    });

    for (const type of types) {
      typeTagRows.push({
        id: rand.uuid(),
        projectId: id,
        type,
        createdAt,
      });
    }

    // Staffing. A PLANNING project deliberately has a manager but no worker,
    // because the moment it gets both the app moves it out of PLANNING.
    const members = buildMembers(rand, users, {
      status,
      createdAt,
      creator,
      createdByPm,
      isTestProject,
    });

    for (const member of members) {
      memberRows.push({
        id: rand.uuid(),
        projectId: id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
        createdAt: member.joinedAt,
        updatedAt: member.leftAt ?? member.joinedAt,
      });
    }

    const active = members.filter((member) => member.leftAt === null);

    projects.push({
      id,
      name,
      status,
      priority,
      clientId: client.id,
      createdById: creator.id,
      createdAt,
      plannedStartDate,
      deadline,
      completedAt,
      archivedAt,
      estimatedHours,
      slackChannelId: channelId,
      types,
      members,
      managerIds: active
        .filter((member) => member.role === ProjectRole.PROJECT_MANAGER)
        .map((member) => member.userId),
      workerIds: active
        .filter((member) => member.role !== ProjectRole.PROJECT_MANAGER)
        .map((member) => member.userId),
      memberIds: active.map((member) => member.userId),
      hasInternalReview,
      hasClientFeedback,
      isActive: OPEN_STATUSES.includes(status),
    });
  }

  await prisma.project.createMany({ data: projectRows });
  await prisma.projectTypeTag.createMany({ data: typeTagRows });
  await prisma.projectMember.createMany({ data: memberRows });

  return projects;
}

// Builds one project's staffing history. Membership is append only: someone
// leaving gets a leftAt date rather than having their row removed, and someone
// rejoining later gets a brand new row.
function buildMembers(
  rand: Rand,
  users: SeededUsers,
  context: {
    status: ProjectStatus;
    createdAt: Date;
    creator: SeededUser;
    createdByPm: boolean;
    isTestProject: boolean;
  },
): SeededMember[] {
  const { status, createdAt, creator, createdByPm, isTestProject } = context;
  const members: SeededMember[] = [];
  const usedActive = new Set<string>();

  function addActive(userId: string, role: ProjectRole, joinedAt: Date) {
    const key = `${userId}|${role}`;
    if (usedActive.has(key)) return;
    usedActive.add(key);
    members.push({ userId, role, joinedAt, leftAt: null });
  }

  // The creating PM is auto staffed by the app. An admin creator is not,
  // because unscoped access already covers them.
  if (createdByPm) {
    addActive(creator.id, ProjectRole.PROJECT_MANAGER, createdAt);
  } else {
    addActive(
      rand.pick(users.projectManagers).id,
      ProjectRole.PROJECT_MANAGER,
      addDays(createdAt, rand.int(0, 2)),
    );
  }

  // A second PM on some of the larger projects.
  if (rand.chance(0.15)) {
    addActive(
      rand.pick(users.projectManagers).id,
      ProjectRole.PROJECT_MANAGER,
      addDays(createdAt, rand.int(1, 10)),
    );
  }

  // A PLANNING project stops here on purpose. Adding a developer or designer
  // is exactly what would move it to SCHEDULED or READY_FOR_WORK.
  if (status === ProjectStatus.PLANNING) {
    return members;
  }

  // On a test project the test developer and designer are always staffed, so
  // both of those logins have work to look at.
  if (isTestProject) {
    addActive(
      users.test.developer.id,
      ProjectRole.DEVELOPER,
      addDays(createdAt, 1),
    );
    addActive(
      users.test.designer.id,
      ProjectRole.DESIGNER,
      addDays(createdAt, 1),
    );
  }

  const workerCount = rand.intFrom(VOLUME.membersPerProject) - 1;
  const developerCount = Math.max(1, Math.ceil(workerCount * 0.6));
  const designerCount = Math.max(0, workerCount - developerCount);

  for (const developer of rand.sample(users.developers, developerCount)) {
    addActive(
      developer.id,
      ProjectRole.DEVELOPER,
      addDays(createdAt, rand.int(1, 14)),
    );
  }
  for (const designer of rand.sample(users.designers, designerCount)) {
    addActive(
      designer.id,
      ProjectRole.DESIGNER,
      addDays(createdAt, rand.int(1, 14)),
    );
  }

  // Past stints, so the includeLeft history has something to show. These are
  // people who worked on the project and moved off it.
  const pastCount = rand.int(0, 2);
  for (let i = 0; i < pastCount; i++) {
    const useDesigner = rand.chance(0.35);
    const person = useDesigner
      ? rand.pick(users.designers)
      : rand.pick(users.developers);
    const joinedAt = addDays(createdAt, rand.int(1, 20));
    members.push({
      userId: person.id,
      role: useDesigner ? ProjectRole.DESIGNER : ProjectRole.DEVELOPER,
      joinedAt,
      leftAt: addDays(joinedAt, rand.int(5, 60)),
    });
  }

  return members;
}
