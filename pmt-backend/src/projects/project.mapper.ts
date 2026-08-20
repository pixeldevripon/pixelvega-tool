import {
  Permission,
  ProjectActivityType,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';

import {
  PROJECT_ACTIVITY_TYPE_DISPLAY,
  PROJECT_PRIORITY_DISPLAY,
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
export function toProjectResponse<T extends ProjectShape>(
  project: T,
  context: ProjectContext,
  now: Date = new Date(),
) {
  const isArchived = project.archivedAt !== null;
  const isTerminal = TERMINAL_STATUSES.includes(project.status);
  const daysLeft = daysUntilDeadline(project.deadline, now);

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
    remainingHours: withRemainingHours(project).remainingHours,
    isArchived,
    isTerminal,
    daysUntilDeadline: daysLeft,
    // A finished project is never overdue: it is finished. Only live work can
    // be late, which is the distinction a raw date comparison in a client loses.
    isOverdue: daysLeft !== null && daysLeft < 0 && !isTerminal,
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
