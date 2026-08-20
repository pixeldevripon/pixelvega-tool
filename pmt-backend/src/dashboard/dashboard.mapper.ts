import {
  BlockerSeverity,
  Permission,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
} from '@prisma/client';

import { formatDuration, toHours } from '@/common/utils/duration.util';
import {
  DASHBOARD_AUDIENCE_DISPLAY,
  PROJECT_PRIORITY_DISPLAY,
  PROJECT_ROLE_DISPLAY,
  PROJECT_STATUS_DISPLAY,
  toEnumDisplay,
  type DashboardAudience,
  type EnumDisplayEntry,
} from '@/common/utils/enum-display.util';
import {
  daysUntilDeadline,
  TERMINAL_STATUSES,
  withRemainingHours,
} from '@/projects/project.mapper';
import { DASHBOARD_ACTIVE_STATUSES } from '@/projects/projects.service';

import type {
  DashboardClientProjectDto,
  DashboardCountDto,
  DashboardHoursDto,
  DashboardMemberDto,
  DashboardProjectDto,
} from './dto/dashboard.dto';

/**
 * Pure mapping for the dashboard. Takes rows and already-counted numbers, never
 * a database, which is what lets every rule below be tested without a Nest
 * module.
 *
 * Nothing here re-derives a rule that exists elsewhere. `daysUntilDeadline`,
 * `TERMINAL_STATUSES`, `withRemainingHours` and `DASHBOARD_ACTIVE_STATUSES` are
 * imported rather than reimplemented: a second copy of "is this overdue" that
 * disagreed with the project response by one day would be a defect invisible
 * from either file alone.
 */

/**
 * Which dashboard a caller gets, decided from their PERMISSION SET.
 *
 * Not from their role, deliberately (D2). A role is a bundle of capabilities,
 * and "which dashboard describes your day" is answered by what you can see.
 * Keying off `Role` would need editing every time a role's grants changed, and
 * would be a second copy of `ROLE_PERMISSIONS` in a different shape.
 *
 * **Order matters, and it is most privileged first.** An ADMIN also holds
 * `VIEW_ALL_PROJECTS` and `TRACK_PROJECT_TIME`, so testing for either of those
 * first would hand an administrator the manager or the staff dashboard.
 *
 * Each marker is held by exactly the audience it selects:
 *
 * - `VIEW_AUDIT_LOG` is admin only.
 * - `VIEW_ALL_PROJECTS` is project manager and above.
 * - `TRACK_PROJECT_TIME` is developer and designer only. A project manager
 *   deliberately does not hold it, which is the same reason they get no "My day".
 * - Everything else is a client. That is a FALLBACK rather than a positive test,
 *   because a client's grants are a subset of everyone's and there is no
 *   capability unique to them. Worth knowing: a new role with a very small grant
 *   set would land here, and would get the reduced client projection.
 */
export function resolveDashboardAudience(
  permissions: Permission[],
): DashboardAudience {
  const held = new Set<Permission>(permissions);

  if (held.has(Permission.VIEW_AUDIT_LOG)) return 'ADMIN';
  if (held.has(Permission.VIEW_ALL_PROJECTS)) return 'MANAGER';
  if (held.has(Permission.TRACK_PROJECT_TIME)) return 'STAFF';
  return 'CLIENT';
}

export function toAudienceDisplay(audience: DashboardAudience) {
  return toEnumDisplay(DASHBOARD_AUDIENCE_DISPLAY, audience);
}

/**
 * The columns every dashboard project row needs, whichever query produced it.
 *
 * Declared here rather than inferred from a Prisma `select`, so the mapper
 * cannot silently start depending on a field one caller happens to include.
 */
export type DashboardProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline: Date | null;
  plannedStartDate: Date | null;
  progressPercentage: number;
  estimatedHours: number | null;
  actualHours: number;
  members: DashboardMemberRow[];
};

/**
 * A staffed member as the query returns it.
 *
 * `leftAt` is part of the row rather than filtered in the query, so the mapper
 * can enforce "current team only" itself. A caller that forgot the `leftAt:
 * null` filter would otherwise put former members on the card, and nothing in
 * the response would look wrong.
 */
export type DashboardMemberRow = {
  role: ProjectRole;
  leftAt: Date | null;
  user: { id: string; name: string; avatarUrl: string | null };
};

/** Managers first, then everyone else, so the card's first avatar is the owner. */
const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  PROJECT_MANAGER: 0,
  DEVELOPER: 1,
  DESIGNER: 2,
};

export function toDashboardMembers(
  members: DashboardMemberRow[],
): DashboardMemberDto[] {
  return (
    members
      // Current team only. Someone who left is part of the project's history,
      // which the activity timeline carries, not part of who is working on it.
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
      }))
  );
}

/**
 * The blocker figures a card shows.
 *
 * Both numbers come from the same list in one pass, so they can never disagree
 * about which rows are unresolved.
 */
export type DashboardBlockerTally = {
  openCount: number;
  highSeverityCount: number;
};

export function tallyOpenBlockers(
  blockers: { severity: BlockerSeverity }[],
): DashboardBlockerTally {
  return {
    openCount: blockers.length,
    highSeverityCount: blockers.filter(
      (blocker) => blocker.severity === BlockerSeverity.HIGH,
    ).length,
  };
}

export function toDashboardProject(
  project: DashboardProjectRow,
  blockers: DashboardBlockerTally,
  now: Date = new Date(),
): DashboardProjectDto {
  const isTerminal = TERMINAL_STATUSES.includes(project.status);
  const daysLeft = daysUntilDeadline(project.deadline, now);

  return {
    id: project.id,
    name: project.name,
    status: toEnumDisplay(PROJECT_STATUS_DISPLAY, project.status),
    priority: toEnumDisplay(PROJECT_PRIORITY_DISPLAY, project.priority),
    deadline: project.deadline,
    daysUntilDeadline: daysLeft,
    // A finished project is never overdue: it is finished. Same predicate as
    // the project response, from the same imports, so the two cannot drift.
    isOverdue: daysLeft !== null && daysLeft < 0 && !isTerminal,
    plannedStartDate: project.plannedStartDate,
    progressPercentage: project.progressPercentage,
    estimatedHours: project.estimatedHours,
    actualHours: project.actualHours,
    remainingHours: withRemainingHours(project).remainingHours,
    isActive: DASHBOARD_ACTIVE_STATUSES.includes(project.status),
    openBlockerCount: blockers.openCount,
    highSeverityBlockerCount: blockers.highSeverityCount,
    members: toDashboardMembers(project.members),
  };
}

/**
 * The CLIENT projection: status and deadline, and nothing else.
 *
 * Built from its own narrow row type rather than by omitting fields from the
 * wider mapper above. Omitting at runtime is how an internal number reaches a
 * client the first time someone edits the shared function.
 */
export function toDashboardClientProject(
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    deadline: Date | null;
  },
  isAwaitingMyFeedback: boolean,
): DashboardClientProjectDto {
  return {
    id: project.id,
    name: project.name,
    status: toEnumDisplay(PROJECT_STATUS_DISPLAY, project.status),
    deadline: project.deadline,
    isAwaitingMyFeedback,
  };
}

export function toDashboardHours(minutes: number): DashboardHoursDto {
  return {
    minutes,
    hours: toHours(minutes),
    // Never null: `formatDuration` returns null only for a null input, and a
    // total is 0 rather than absent.
    label: formatDuration(minutes) as string,
  };
}

/**
 * A rate, and the same rate as a percentage string.
 *
 * **Null when the denominator is zero, never 0.** Zero claims a measured result
 * of nothing ("nobody submitted"), where null says the question does not apply
 * ("nobody was expected to"). On a day when the whole team is on leave those two
 * answers are indistinguishable to a client that only receives a number.
 */
export function toRate(
  part: number,
  whole: number,
): {
  rate: number | null;
  rateLabel: string | null;
} {
  if (whole <= 0) return { rate: null, rateLabel: null };
  const rate = part / whole;
  return { rate, rateLabel: `${Math.round(rate * 100)}%` };
}

/**
 * Counts keyed by an enum, in the enum's own declared order rather than by size.
 *
 * Sorting by count would reorder the board every time a project moved, so a
 * reader could never learn where to look. Declared order means Planning is
 * always first and Cancelled always last.
 *
 * Keys with no rows are omitted: ten zeroes are harder to read than the four
 * things actually happening.
 */
export function toCounts<E extends string>(
  display: Record<E, EnumDisplayEntry>,
  counts: Map<E, number>,
): DashboardCountDto[] {
  return (Object.keys(display) as E[])
    .filter((key) => (counts.get(key) ?? 0) > 0)
    .map((key) => ({
      key: toEnumDisplay(display, key),
      count: counts.get(key) as number,
    }));
}
