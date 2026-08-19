import type { PrismaClient } from '@prisma/client';
import {
  NotificationType,
  ProjectActivityType,
  ProjectStatus,
} from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import { Rand, addDays, addMinutes } from './random';
import { AUDIT_ACTIONS, NOTIFICATION_TITLES } from './pools';
import type { SeededProject } from './projects';
import type { SeededUsers } from './users';

export type SeededLogs = {
  activityCount: number;
  auditLogCount: number;
  notificationCount: number;
};

// Activity types that need no particular project state to make sense, used to
// pad each project's timeline so the activity feed is worth paging through.
const FILLER_ACTIVITY_TYPES: ProjectActivityType[] = [
  ProjectActivityType.PROJECT_DETAILS_UPDATED,
  ProjectActivityType.DEADLINE_CHANGED,
  ProjectActivityType.PROJECT_TYPES_CHANGED,
  ProjectActivityType.DOCUMENT_ADDED,
  ProjectActivityType.DOCUMENT_UPDATED,
  ProjectActivityType.ESTIMATED_HOURS_CHANGED,
  ProjectActivityType.TIME_STARTED,
  ProjectActivityType.TIME_PAUSED,
  ProjectActivityType.TIME_RESUMED,
  ProjectActivityType.TIME_STOPPED,
  ProjectActivityType.BLOCKER_ADDED,
  ProjectActivityType.BLOCKER_STATUS_CHANGED,
  ProjectActivityType.PLAN_SUBMITTED,
  ProjectActivityType.WRAP_UP_SUBMITTED,
  ProjectActivityType.WORK_REPORT_REVIEWED,
  ProjectActivityType.ADDITIONAL_REQUIREMENT_ADDED,
];

// Notification types that go to the managers and admins of a project.
const MANAGER_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PROJECT_CREATED,
  NotificationType.INTERNAL_REVIEW_SUBMITTED,
  NotificationType.ADDITIONAL_REQUIREMENT_SUBMITTED,
  NotificationType.ADDITIONAL_REQUIREMENT_FLAGGED_OUT_OF_SCOPE,
  NotificationType.CLIENT_FEEDBACK_APPROVED,
  NotificationType.CLIENT_FEEDBACK_CHANGES_REQUESTED,
  NotificationType.PROJECT_READY_FOR_CLIENT,
  NotificationType.DOCUMENT_UPLOADED,
];

// Notification types that go to everyone staffed on a project.
const TEAM_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PROJECT_STATUS_CHANGED,
  NotificationType.PROJECT_ON_HOLD,
  NotificationType.PROJECT_CANCELLED,
  NotificationType.PROJECT_PRIORITY_RAISED,
  NotificationType.DEADLINE_APPROACHING,
  NotificationType.PROJECT_AUTO_COMPLETED,
  NotificationType.INTERNAL_REVIEW_CHANGES_REQUIRED,
  NotificationType.ADDITIONAL_REQUIREMENT_APPROVED,
  NotificationType.ADDITIONAL_REQUIREMENT_REJECTED,
  NotificationType.ADDITIONAL_REQUIREMENT_HOURS_OR_DEADLINE_CHANGED,
];

// Notification types that only ever reach one person.
const PERSONAL_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.MEMBER_ASSIGNED,
  NotificationType.MEMBER_REMOVED,
  NotificationType.MEMBER_REASSIGNED,
  NotificationType.MEMBER_HANDOVER,
  NotificationType.BLOCKER_ASSIGNED,
  NotificationType.WORK_REPORT_COMMENTED,
  NotificationType.STANDUP_MISSED,
  NotificationType.WRAP_UP_MISSED,
];

// Leave notifications have nothing to do with a project.
const LEAVE_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.LEAVE_REQUEST_SUBMITTED,
  NotificationType.LEAVE_REQUEST_APPROVED,
  NotificationType.LEAVE_REQUEST_REJECTED,
];

export async function seedLogs(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
): Promise<SeededLogs> {
  const activityCount = await seedProjectActivities(
    prisma,
    rand,
    users,
    projects,
  );
  const auditLogCount = await seedAuditLogs(prisma, rand, users);
  const notificationCount = await seedNotifications(
    prisma,
    rand,
    users,
    projects,
  );
  return { activityCount, auditLogCount, notificationCount };
}

async function seedProjectActivities(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
) {
  const rows: any[] = [];

  for (const project of projects) {
    const actorPool =
      project.memberIds.length > 0
        ? project.memberIds
        : users.adminSide.map((user) => user.id);

    // Creation is always the first entry.
    rows.push({
      id: rand.uuid(),
      projectId: project.id,
      userId: project.createdById,
      type: ProjectActivityType.PROJECT_CREATED,
      message: `Project ${project.name} was created`,
      metadata: { name: project.name, status: ProjectStatus.PLANNING },
      createdAt: project.createdAt,
    });

    // One entry per staffing change, matching the member rows themselves.
    for (const member of project.members) {
      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        userId: member.userId,
        type: ProjectActivityType.MEMBER_JOINED,
        message: `A ${member.role.toLowerCase().replace(/_/g, ' ')} joined the project`,
        metadata: { userId: member.userId, role: member.role },
        createdAt: member.joinedAt,
      });

      if (member.leftAt) {
        rows.push({
          id: rand.uuid(),
          projectId: project.id,
          userId: member.userId,
          type: ProjectActivityType.MEMBER_LEFT,
          message: `A ${member.role.toLowerCase().replace(/_/g, ' ')} left the project`,
          metadata: { userId: member.userId, role: member.role },
          createdAt: member.leftAt,
        });
      }
    }

    // The status change that landed the project where it is now, plus the
    // terminal entries for a finished or cancelled project.
    if (project.status !== ProjectStatus.PLANNING) {
      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        userId: rand.pick(actorPool),
        type: ProjectActivityType.STATUS_CHANGED,
        message: `Status changed to ${project.status}`,
        metadata: { from: ProjectStatus.PLANNING, to: project.status },
        createdAt: addDays(project.createdAt, rand.int(1, 10)),
      });
    }
    if (project.status === ProjectStatus.COMPLETED && project.completedAt) {
      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        userId: rand.pick(actorPool),
        type: ProjectActivityType.PROJECT_COMPLETED,
        message: 'Project was completed',
        metadata: {},
        createdAt: project.completedAt,
      });
    }
    if (project.status === ProjectStatus.CANCELLED) {
      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        userId: rand.pick(users.adminSide).id,
        type: ProjectActivityType.PROJECT_CANCELLED,
        message: 'Project was cancelled',
        metadata: {},
        createdAt: addDays(project.createdAt, rand.int(10, 90)),
      });
    }
    if (project.archivedAt) {
      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        userId: rand.pick(users.adminSide).id,
        type: ProjectActivityType.PROJECT_ARCHIVED,
        message: 'Project was archived',
        metadata: {},
        createdAt: project.archivedAt,
      });
    }

    // Then a handful of everyday entries so the timeline is not just lifecycle
    // events.
    const fillerCount = rand.int(3, 9);
    for (let i = 0; i < fillerCount; i++) {
      const type = rand.pick(FILLER_ACTIVITY_TYPES);
      rows.push({
        id: rand.uuid(),
        projectId: project.id,
        userId: rand.pick(actorPool),
        type,
        message: type.toLowerCase().replace(/_/g, ' '),
        metadata: {},
        createdAt: rand.dateBetween(
          project.createdAt,
          project.completedAt ?? SEED_TODAY,
        ),
      });
    }
  }

  await prisma.projectActivity.createMany({ data: rows });
  return rows.length;
}

async function seedAuditLogs(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
) {
  const rows: any[] = [];
  const actors = [...users.adminSide, ...users.projectManagers];

  for (let i = 0; i < VOLUME.auditLogs; i++) {
    const action = rand.pick(AUDIT_ACTIONS);
    const target = rand.pick(users.all);
    // The actor is whoever performed the action, which is often not the person
    // it was done to.
    const isSelfService =
      action === 'user.password_changed' || action === 'profile.updated';
    const actor = isSelfService ? target : rand.pick(actors);
    const createdAt = rand.dateBetween(addDays(SEED_TODAY, -365), SEED_TODAY);

    let metadata: Record<string, unknown> = {};
    let targetType = 'User';
    if (action === 'user.invited') {
      metadata = { email: target.email, role: target.role };
    } else if (action === 'user.updated') {
      // The app only logs an update when something really changed, and records
      // the before and after of each field.
      metadata = {
        changes: {
          status: { from: 'INVITED', to: 'ACTIVE' },
        },
      };
    } else if (
      action === 'profile.updated' ||
      action === 'profile.avatar_updated'
    ) {
      targetType =
        target.role === 'CLIENT' ? 'ClientProfile' : 'EmployeeProfile';
      metadata = { fields: ['phone', 'timezone'] };
    }

    rows.push({
      id: rand.uuid(),
      userId: actor.id,
      action,
      targetType,
      targetId: target.id,
      metadata,
      createdAt,
    });
  }

  await prisma.auditLog.createMany({ data: rows });
  return rows.length;
}

async function seedNotifications(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
) {
  const rows: any[] = [];
  const adminIds = users.adminSide.map((user) => user.id);
  const workforceIds = users.workforce.map((user) => user.id);

  function push(
    userId: string,
    type: NotificationType,
    createdAt: Date,
    metadata: Record<string, unknown>,
  ) {
    rows.push({
      id: rand.uuid(),
      userId,
      type,
      title: NOTIFICATION_TITLES[type] ?? type,
      message: buildMessage(type, metadata),
      metadata,
      // Older notifications are usually read, recent ones often are not.
      readAt: rand.chance(0.55)
        ? addMinutes(createdAt, rand.int(5, 4000))
        : null,
      createdAt,
    });
  }

  // Fan out project events. The same event becomes one row per recipient,
  // because a notification is per person, and the person who acted is left out
  // so nobody is told about their own action.
  while (rows.length < VOLUME.notifications * 0.8) {
    const project = rand.pick(projects);
    const createdAt = rand.dateBetween(
      project.createdAt,
      project.completedAt ?? SEED_TODAY,
    );
    const metadata = { projectId: project.id, projectName: project.name };

    const bucket = rand.float();
    if (bucket < 0.35) {
      const type = rand.pick(MANAGER_NOTIFICATION_TYPES);
      const recipients = new Set([...project.managerIds, ...adminIds]);
      const actor = rand.pick([...recipients]);
      for (const userId of recipients) {
        if (userId === actor) continue;
        push(userId, type, createdAt, metadata);
      }
    } else if (bucket < 0.75) {
      const type = rand.pick(TEAM_NOTIFICATION_TYPES);
      const recipients = new Set([...project.memberIds, ...adminIds]);
      const actor = rand.pick([...recipients]);
      for (const userId of recipients) {
        if (userId === actor) continue;
        push(userId, type, createdAt, metadata);
      }
    } else {
      const type = rand.pick(PERSONAL_NOTIFICATION_TYPES);
      const target =
        project.memberIds.length > 0
          ? rand.pick(project.memberIds)
          : rand.pick(workforceIds);
      push(target, type, createdAt, metadata);
    }
  }

  // Leave notifications, which are not tied to a project at all.
  while (rows.length < VOLUME.notifications) {
    const type = rand.pick(LEAVE_NOTIFICATION_TYPES);
    const createdAt = rand.dateBetween(addDays(SEED_TODAY, -200), SEED_TODAY);
    const recipient =
      type === NotificationType.LEAVE_REQUEST_SUBMITTED
        ? rand.pick(adminIds)
        : rand.pick(workforceIds);
    push(recipient, type, createdAt, { leaveRequestId: rand.uuid() });
  }

  await prisma.notification.createMany({ data: rows });
  return rows.length;
}

function buildMessage(
  type: NotificationType,
  metadata: Record<string, unknown>,
): string {
  const projectName = metadata.projectName as string | undefined;
  if (projectName) {
    return `${NOTIFICATION_TITLES[type] ?? type} on ${projectName}.`;
  }
  return `${NOTIFICATION_TITLES[type] ?? type}.`;
}
