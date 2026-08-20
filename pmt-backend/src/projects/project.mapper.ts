import {
  Permission,
  ProjectActivityType,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';

import {
  formatDeadlineLabel,
  formatHoursLabel,
} from '@/common/utils/duration.util';
import {
  PROJECT_ACTIVITY_TYPE_DISPLAY,
  PROJECT_PRIORITY_DISPLAY,
  PROJECT_ROLE_DISPLAY,
  PROJECT_STATUS_DISPLAY,
  PROJECT_TYPE_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

import { ProjectCapabilitiesDto } from './dto/project.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A project that has finished, one way or the other. */
export const TERMINAL_STATUSES: ProjectStatus[] = [
  ProjectStatus.COMPLETED,
  ProjectStatus.CANCELLED,
];

/**
 * Everything the capability flags need, resolved once per request.
 *
 * `permissions` is the caller's effective set from `PermissionsService`, the
 * same source `PermissionsGuard` consults, so a flag and the guard cannot
 * disagree about what a role may ever do. `managesProject` is the project scope
 * half, which a permission cannot answer.
 */
export type ProjectContext = {
  permissions: Permission[];
  managesProject: boolean;
  /**
   * From `ProjectScopeService.mayChangeProjectStatus`, not re-derived here.
   *
   * The status rule is not the same shape as the others: a PROJECT_MANAGER must
   * manage the project, while a DEVELOPER or DESIGNER only has to be staffed on
   * it. Reproducing that in the mapper is how the flag and the enforcement come
   * apart, which they had: this flag was `has(permission) && !isArchived`, so a
   * PM saw a status control on every project they could read.
   */
  mayChangeStatus: boolean;
};

type ProjectShape = {
  status: ProjectStatus;
  priority: ProjectPriority;
  archivedAt: Date | null;
  deadline: Date | null;
  estimatedHours: number | null;
  actualHours: number;
  projectTypeTags?: Array<{ type: ProjectType }>;
  // Optional, because the client projection and the activity mapper both use
  // this shape and neither includes the team.
  members?: ProjectMemberRow[];
};

/**
 * Whole days from now until the deadline. Negative once it has passed.
 *
 * Computed against the SERVER clock on purpose. A client computing it against
 * its own would give two people in different timezones different answers to
 * "how many days left", and a deadline is a shared fact about the project.
 */
export function daysUntilDeadline(
  deadline: Date | null,
  now: Date = new Date(),
): number | null {
  if (deadline === null) return null;
  const startOfDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((startOfDay(deadline) - startOfDay(now)) / MS_PER_DAY);
}

export function buildProjectCapabilities(
  project: { status: ProjectStatus; archivedAt: Date | null },
  context: ProjectContext,
): ProjectCapabilitiesDto {
  const has = (permission: Permission) =>
    context.permissions.includes(permission);
  const isArchived = project.archivedAt !== null;

  // Archiving is the one pair whose two directions are mutually exclusive, and
  // both are gated by the same permission. Reporting both as true would offer a
  // restore on a live project.
  return {
    canEdit:
      has(Permission.EDIT_PROJECT) && context.managesProject && !isArchived,
    canChangeStatus:
      has(Permission.CHANGE_PROJECT_STATUS) &&
      context.mayChangeStatus &&
      !isArchived,
    canChangePriority:
      has(Permission.CHANGE_PROJECT_PRIORITY) &&
      context.managesProject &&
      !isArchived,
    canManageTypes:
      has(Permission.MANAGE_PROJECT_TYPES) &&
      context.managesProject &&
      !isArchived,
    canManageEstimatedHours:
      has(Permission.MANAGE_ESTIMATED_HOURS) &&
      context.managesProject &&
      !isArchived,
    canArchive: has(Permission.ARCHIVE_PROJECT) && !isArchived,
    canRestore: has(Permission.ARCHIVE_PROJECT) && isArchived,
    canConnectSlack:
      has(Permission.CONNECT_PROJECT_SLACK) &&
      context.managesProject &&
      !isArchived,
    canManageMembers:
      has(Permission.MANAGE_PROJECT_MEMBERS) &&
      context.managesProject &&
      !isArchived,
    canManageDocuments:
      has(Permission.MANAGE_PROJECT_DOCUMENTS) &&
      context.managesProject &&
      !isArchived,
  };
}

/**
 * Estimated minus actual, computed on the way out and never stored, so it
 * cannot drift out of sync with its two inputs the way a persisted column
 * could.
 *
 * Null when there is no estimate, which is a different fact from nothing
 * remaining, and NEGATIVE on overrun rather than clamped, because the overrun
 * is the number a manager actually needs.
 */
export function withRemainingHours<
  T extends { estimatedHours: number | null; actualHours: number },
>(project: T): T & { remainingHours: number | null } {
  return {
    ...project,
    remainingHours:
      project.estimatedHours === null
        ? null
        : project.estimatedHours - project.actualHours,
  };
}

/**
 * Everything derived that a project response carries.
 *
 * `withRemainingHours` above computed one of these five; the other four were
 * being computed in the browser, each by a different component.
 */
/**
 * A staffed member as the include returns it.
 *
 * `leftAt` is part of the row so the MAPPER enforces "current team only". A query
 * that forgot the filter would otherwise put former members on a row, and
 * nothing in the response would look wrong.
 */
export type ProjectMemberRow = {
  role: ProjectRole;
  leftAt: Date | null;
  user: { id: string; name: string; avatarUrl: string | null };
};

/** Managers first, then everyone else by name, so a row's first face is the owner. */
const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  PROJECT_MANAGER: 0,
  DEVELOPER: 1,
  DESIGNER: 2,
};

export function toProjectMemberSummaries(members: ProjectMemberRow[]) {
  return members
    .filter((member) => member.leftAt === null)
    .sort(
      (a, b) =>
        PROJECT_ROLE_RANK[a.role] - PROJECT_ROLE_RANK[b.role] ||
        a.user.name.localeCompare(b.user.name),
    )
    .map((member) => ({
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      projectRole: toEnumDisplay(PROJECT_ROLE_DISPLAY, member.role),
    }));
}

/**
 * The one project manager a list groups by.
 *
 * A project can have several, so "the lead" needs a rule or two clients will
 * pick differently and group the same project under different people. The rule
 * is the first staffed manager by name, which is stable and needs no extra
 * column. Null when nobody is staffed as one, which is exactly the state that
 * keeps a project in Planning.
 */
export function toProjectLead(
  members: ReturnType<typeof toProjectMemberSummaries>,
) {
  return (
    members.find(
      (member) => member.projectRole.value === ProjectRole.PROJECT_MANAGER,
    ) ?? null
  );
}

export function toProjectResponse<T extends ProjectShape>(
  project: T,
  context: ProjectContext,
  now: Date = new Date(),
) {
  const isArchived = project.archivedAt !== null;
  const isTerminal = TERMINAL_STATUSES.includes(project.status);
  const daysLeft = daysUntilDeadline(project.deadline, now);
  const remainingHours = withRemainingHours(project).remainingHours;
  // Mapped once. It was called twice, once for the list and once to pick the
  // lead out of it, which sorted the same array a second time per project.
  const members = toProjectMemberSummaries(project.members ?? []);

  return {
    ...project,
    status: toEnumDisplay(PROJECT_STATUS_DISPLAY, project.status),
    priority: toEnumDisplay(PROJECT_PRIORITY_DISPLAY, project.priority),
    ...(project.projectTypeTags && {
      projectTypeTags: project.projectTypeTags.map((tag) => ({
        ...tag,
        type: toEnumDisplay(PROJECT_TYPE_DISPLAY, tag.type),
      })),
    }),
    remainingHours,
    // The readable form of each figure travels with it. A client that renders
    // the number itself shows the repeating decimal an hours column really
    // holds, which is the defect these three exist to close.
    actualHoursLabel: formatHoursLabel(project.actualHours) as string,
    estimatedHoursLabel: formatHoursLabel(project.estimatedHours),
    remainingHoursLabel: formatHoursLabel(remainingHours),
    isArchived,
    isTerminal,
    daysUntilDeadline: daysLeft,
    deadlineLabel: formatDeadlineLabel(daysLeft),
    // A finished project is never overdue: it is finished. Only live work can
    // be late, which is the distinction a raw date comparison in a client loses.
    isOverdue: daysLeft !== null && daysLeft < 0 && !isTerminal,
    members,
    lead: toProjectLead(members),
    capabilities: buildProjectCapabilities(project, context),
  };
}

/**
 * The CLIENT projection.
 *
 * Only the status and the type tags need mapping: everything a client is not
 * shown was already excluded by `CLIENT_PROJECT_SELECT`, which is the security
 * boundary. This function must never add a field back.
 */
export function toClientProjectResponse<
  T extends {
    status: ProjectStatus;
    projectTypeTags?: Array<{ type: ProjectType }>;
  },
>(project: T) {
  return {
    ...project,
    status: toEnumDisplay(PROJECT_STATUS_DISPLAY, project.status),
    ...(project.projectTypeTags && {
      projectTypeTags: project.projectTypeTags.map((tag) => ({
        ...tag,
        type: toEnumDisplay(PROJECT_TYPE_DISPLAY, tag.type),
      })),
    }),
  };
}

/** One entry on the project timeline. */
export function toProjectActivityResponse<
  T extends { type: ProjectActivityType },
>(activity: T) {
  return {
    ...activity,
    type: toEnumDisplay(PROJECT_ACTIVITY_TYPE_DISPLAY, activity.type),
  };
}
