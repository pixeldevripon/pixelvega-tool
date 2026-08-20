import {
  BlockerSeverity,
  Permission,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
  ProjectType,
  Role,
} from '@prisma/client';

import {
  formatDeadlineLabel,
  formatDuration,
  toHours,
} from '@/common/utils/duration.util';
import {
  DASHBOARD_AUDIENCE_DISPLAY,
  PROJECT_PRIORITY_DISPLAY,
  PROJECT_ROLE_DISPLAY,
  PROJECT_STATUS_DISPLAY,
  PROJECT_STATUS_PROGRESS,
  PROJECT_TYPE_DISPLAY,
  toEnumDisplay,
  type DashboardAudience,
  type EnumDisplayEntry,
} from '@/common/utils/enum-display.util';
import { WEEKLY_OFF_DAY } from '@/common/working-day/working-day.constants';
import {
  daysUntilDeadline,
  TERMINAL_STATUSES,
  withRemainingHours,
} from '@/projects/project.mapper';
import { DASHBOARD_ACTIVE_STATUSES } from '@/projects/projects.service';

import type {
  DashboardBreakdownDto,
  DashboardClientProjectDto,
  DashboardHoursDto,
  DashboardMemberDto,
  DashboardMetricDto,
  DashboardProjectCapabilitiesDto,
  DashboardProjectDto,
  DashboardRankedRowDto,
  DashboardSeriesDto,
  DashboardSliceDto,
} from './dto/dashboard.dto';

/**
 * Pure mapping for the dashboard. Takes rows and already-counted numbers, never
 * a database, which is what lets every rule below be tested without a Nest
 * module.
 *
 * Nothing here re-derives a rule that exists elsewhere. `daysUntilDeadline`,
 * `TERMINAL_STATUSES`, `withRemainingHours`, `DASHBOARD_ACTIVE_STATUSES` and
 * `WEEKLY_OFF_DAY` are imported rather than reimplemented: a second copy of "is
 * this overdue" that disagreed with the project response by one day would be a
 * defect invisible from either file alone.
 */

// ── The audience ──────────────────────────────────────────────────────────

/**
 * Which dashboard a caller gets, decided from their PERMISSION SET.
 *
 * Not from their role, deliberately (D2). A role is a bundle of capabilities, and
 * "which dashboard describes your day" is answered by what you can see. Keying
 * off `Role` would need editing every time a role's grants changed, and would be
 * a second copy of `ROLE_PERMISSIONS` in a different shape.
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
 *   because a client's grants are a subset of everyone's and no capability is
 *   unique to them. Worth knowing: a new role with a very small grant set would
 *   land here and would get the reduced client projection, which is the safe
 *   direction to fail in.
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

// ── Formatting ────────────────────────────────────────────────────────────

/** A signed percentage, for a delta badge. */
export function formatChangeLabel(rate: number | null): string | null {
  if (rate === null) return null;
  const percent = Math.round(rate * 100);
  return percent > 0 ? `+${percent}%` : `${percent}%`;
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
 * ("nobody was expected to"). On a day the whole team is on leave those two
 * answers are indistinguishable to a client that only receives a number.
 */
export function toRate(
  part: number,
  whole: number,
): { rate: number | null; rateLabel: string | null } {
  if (whole <= 0) return { rate: null, rateLabel: null };
  const rate = part / whole;
  return { rate, rateLabel: `${Math.round(rate * 100)}%` };
}

// ── Headline metrics ──────────────────────────────────────────────────────

/**
 * Whether a rise in this figure is good, bad, or neither.
 *
 * A judgment about the business, not a styling choice, which is why it lives on
 * the server (ADR 0001). More hours logged going up is neutral; more overdue
 * projects going up is bad; more projects delivered going up is good. Two
 * clients deciding this for themselves would colour the same number differently.
 */
export type MetricDirection = 'up-is-good' | 'up-is-bad' | 'neutral';

export function toMetric(input: {
  key: string;
  label: string;
  caption?: string | null;
  value: number;
  valueLabel: string;
  previousValue: number | null;
  direction: MetricDirection;
}): DashboardMetricDto {
  const { value, previousValue, direction } = input;

  // Null rather than Infinity when the baseline was zero: a change from nothing
  // has no percentage, and "+Infinity%" is not a fact about the business.
  const changeRate =
    previousValue === null || previousValue === 0
      ? null
      : (value - previousValue) / previousValue;

  return {
    key: input.key,
    label: input.label,
    caption: input.caption ?? null,
    value,
    valueLabel: input.valueLabel,
    previousValue,
    changeRate,
    changeLabel: formatChangeLabel(changeRate),
    tone: toEnumDisplay(
      METRIC_TONE_DISPLAY,
      resolveTone(changeRate, direction),
    ),
  };
}

type MetricTone = 'default' | 'success' | 'warning' | 'danger';

/**
 * The tone map for a metric's direction of travel.
 *
 * Its own map rather than a reuse of a domain enum's, because "this number went
 * the wrong way" is not a status: it has no `value` a client would branch on, and
 * borrowing `BlockerSeverity`'s tones would tie two unrelated judgments together.
 */
const METRIC_TONE_DISPLAY: Record<MetricTone, EnumDisplayEntry> = {
  default: { label: 'Steady', tone: 'default' },
  success: { label: 'Improving', tone: 'success' },
  warning: { label: 'Worth watching', tone: 'warning' },
  danger: { label: 'Getting worse', tone: 'danger' },
};

function resolveTone(
  changeRate: number | null,
  direction: MetricDirection,
): MetricTone {
  // No baseline, no movement, or a figure where movement carries no meaning.
  if (changeRate === null || changeRate === 0 || direction === 'neutral') {
    return 'default';
  }
  const rose = changeRate > 0;
  if (direction === 'up-is-good') return rose ? 'success' : 'warning';
  return rose ? 'danger' : 'success';
}

// ── Series ────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A per-day series, one point per calendar day in the range, gaps filled with
 * zero.
 *
 * Filled here rather than left to the client, because a chart that skips a day
 * with no hours draws a continuous line over a gap and implies work happened
 * across it. Every day is present, and `isWorkingDay` says which of the zeroes
 * are the weekly off day rather than a day nobody worked.
 */
export function toSeries(input: {
  label: string;
  from: Date;
  days: number;
  minutesByDay: Map<string, number>;
  dailyTarget: number | null;
}): DashboardSeriesDto {
  const points = [];
  let totalValue = 0;

  const cursor = new Date(
    Date.UTC(
      input.from.getUTCFullYear(),
      input.from.getUTCMonth(),
      input.from.getUTCDate(),
    ),
  );

  for (let index = 0; index < input.days; index++) {
    const date = cursor.toISOString().slice(0, 10);
    const value = input.minutesByDay.get(date) ?? 0;
    totalValue += value;

    points.push({
      date,
      label: `${WEEKDAY_LABELS[cursor.getUTCDay()]} ${cursor.getUTCDate()}`,
      value,
      valueLabel: formatDuration(value) as string,
      isWorkingDay: cursor.getUTCDay() !== WEEKLY_OFF_DAY,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    label: input.label,
    points,
    totalValue,
    totalLabel: formatDuration(totalValue) as string,
    dailyTarget: input.dailyTarget,
  };
}

// ── Breakdowns ────────────────────────────────────────────────────────────

/**
 * Counts as slices, in the enum's declared order rather than by size.
 *
 * Sorting by count reorders the board every time a project moves, so a reader
 * can never learn where to look. Declared order means Planning is always first
 * and Cancelled always last.
 *
 * Keys with no rows are omitted: ten zeroes are harder to read than the four
 * things actually happening.
 *
 * `share` is computed here, once, so slices always sum to the same 100%. A
 * client dividing by a total it also received would round differently from every
 * other client.
 */
export function toBreakdown<E extends string>(input: {
  label: string;
  unit: string;
  display: Record<E, EnumDisplayEntry>;
  counts: Map<E, number>;
}): DashboardBreakdownDto {
  const total = [...input.counts.values()].reduce((sum, n) => sum + n, 0);

  const slices: DashboardSliceDto[] = (Object.keys(input.display) as E[])
    .filter((key) => (input.counts.get(key) ?? 0) > 0)
    .map((key) => {
      const count = input.counts.get(key) as number;
      const share = total > 0 ? count / total : 0;
      return {
        key: toEnumDisplay(input.display, key),
        count,
        share,
        shareLabel: `${Math.round(share * 100)}%`,
      };
    });

  return {
    label: input.label,
    total,
    totalLabel: `${total} ${input.unit}`,
    slices,
  };
}

// ── Ranked rows ───────────────────────────────────────────────────────────

export function toRankedRow(input: {
  id: string;
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  minutes: number;
  previousMinutes: number | null;
  listTotal: number;
}): DashboardRankedRowDto {
  const changeRate =
    input.previousMinutes === null || input.previousMinutes === 0
      ? null
      : (input.minutes - input.previousMinutes) / input.previousMinutes;

  return {
    id: input.id,
    name: input.name,
    subtitle: input.subtitle ?? null,
    avatarUrl: input.avatarUrl ?? null,
    value: input.minutes,
    valueLabel: formatDuration(input.minutes) as string,
    share: input.listTotal > 0 ? input.minutes / input.listTotal : 0,
    changeRate,
    changeLabel: formatChangeLabel(changeRate),
    // More hours on a project is neither good nor bad on its own, so a rise is
    // never coloured as a problem here.
    tone: toEnumDisplay(
      METRIC_TONE_DISPLAY,
      resolveTone(changeRate, 'neutral'),
    ),
  };
}

// ── Members ───────────────────────────────────────────────────────────────

/**
 * A staffed member as the query returns it.
 *
 * `leftAt` is part of the row rather than filtered in the query, so the mapper
 * enforces "current team only" itself. A caller that forgot the `leftAt: null`
 * filter would otherwise put former members on the card, and nothing in the
 * response would look wrong.
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

// ── Capabilities ──────────────────────────────────────────────────────────

/**
 * Seeing a project and managing it are different questions, and this is where
 * they are separated.
 *
 * The rule, from the product brief: an ADMIN or SYSTEM_ADMIN may manage
 * anything; a PROJECT_MANAGER sees every project and manages only those they are
 * staffed on AS a project manager; a DEVELOPER or DESIGNER sees only projects
 * they are staffed on and manages none.
 *
 * `canManage` is derived from `EDIT_PROJECT` plus that membership test, and the
 * service's own assertion must call the same predicate. Two copies is the defect
 * `pmt-backend/CLAUDE.md` calls the most repeated one here: five flags once
 * shipped wider than their enforcement, each offering a button that answered 403.
 */
export function buildDashboardProjectCapabilities(input: {
  permissions: Permission[];
  /** Staffed on this project in any project role, with `leftAt` null. */
  isMember: boolean;
  /** Staffed on this project specifically AS a project manager. */
  isProjectManagerOfThis: boolean;
}): DashboardProjectCapabilitiesDto {
  const held = new Set<Permission>(input.permissions);

  // An unrestricted role, identified by a capability only it holds rather than
  // by a role string.
  const isUnrestricted = held.has(Permission.ARCHIVE_PROJECT);

  return {
    canManage:
      held.has(Permission.EDIT_PROJECT) &&
      (isUnrestricted || input.isProjectManagerOfThis),
    // Holding the permission is not enough: only somebody staffed on THIS
    // project may track time against it.
    canTrackTime: held.has(Permission.TRACK_PROJECT_TIME) && input.isMember,
    isMember: input.isMember,
  };
}

// ── The project card ──────────────────────────────────────────────────────

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
  estimatedHours: number | null;
  actualHours: number;
  projectTypeTags: { type: ProjectType }[];
  members: DashboardMemberRow[];
};

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
  context: {
    blockers: DashboardBlockerTally;
    minutesInRange: number;
    /** Latest time entry across every user. Null when nobody has logged any. */
    lastWorkedAt: Date | null;
    capabilities: DashboardProjectCapabilitiesDto;
  },
  now: Date = new Date(),
): DashboardProjectDto {
  const isTerminal = TERMINAL_STATUSES.includes(project.status);
  const daysLeft = daysUntilDeadline(project.deadline, now);
  // Same predicate as the project response, from the same import, so the two
  // cannot drift. A finished project is never overdue: it is finished.
  const isOverdue = daysLeft !== null && daysLeft < 0 && !isTerminal;

  const { remainingHours } = withRemainingHours(project);

  return {
    id: project.id,
    name: project.name,
    status: toEnumDisplay(PROJECT_STATUS_DISPLAY, project.status),
    priority: toEnumDisplay(PROJECT_PRIORITY_DISPLAY, project.priority),
    types: project.projectTypeTags.map((tag) =>
      toEnumDisplay(PROJECT_TYPE_DISPLAY, tag.type),
    ),
    deadline: project.deadline,
    daysUntilDeadline: daysLeft,
    deadlineLabel: formatDeadlineLabel(daysLeft),
    isOverdue,
    // ONE definition of at risk, so a card, a count and a filter cannot
    // disagree. A finished project is excluded even if it has a stale blocker:
    // there is no risk left to manage.
    isAtRisk: !isTerminal && (isOverdue || context.blockers.openCount > 0),
    plannedStartDate: project.plannedStartDate,
    // Derived from the lifecycle, because the `progressPercentage` column
    // `Project Module.md` specifies was never added to the schema. Deliberately
    // not hours-used: a project can burn 90% of its estimate while still in
    // Planning, and calling that 90% done would be wrong in the most expensive
    // direction. Hours against estimate ships separately as `hoursUsedRate`.
    progressPercentage: PROJECT_STATUS_PROGRESS[project.status],
    estimatedHours: project.estimatedHours,
    actualHours: project.actualHours,
    // `formatDuration` takes MINUTES, and these are stored as decimal hours, so
    // they are converted here rather than a second formatter being written for
    // hours. One definition of how a duration reads (D4).
    actualHoursLabel: formatDuration(
      Math.round(project.actualHours * 60),
    ) as string,
    estimatedHoursLabel:
      project.estimatedHours === null
        ? null
        : formatDuration(Math.round(project.estimatedHours * 60)),
    remainingHours,
    remainingHoursLabel:
      remainingHours === null
        ? null
        : formatDuration(Math.round(remainingHours * 60)),
    hoursUsedRate:
      project.estimatedHours && project.estimatedHours > 0
        ? project.actualHours / project.estimatedHours
        : null,
    isActive: DASHBOARD_ACTIVE_STATUSES.includes(project.status),
    openBlockerCount: context.blockers.openCount,
    highSeverityBlockerCount: context.blockers.highSeverityCount,
    minutesInRange: context.minutesInRange,
    minutesInRangeLabel: formatDuration(context.minutesInRange) as string,
    lastWorkedAt: context.lastWorkedAt,
    members: toDashboardMembers(project.members),
    capabilities: context.capabilities,
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
  now: Date = new Date(),
): DashboardClientProjectDto {
  const daysLeft = daysUntilDeadline(project.deadline, now);

  return {
    id: project.id,
    name: project.name,
    status: toEnumDisplay(PROJECT_STATUS_DISPLAY, project.status),
    deadline: project.deadline,
    deadlineLabel: formatDeadlineLabel(daysLeft),
    isAwaitingMyFeedback,
  };
}

/**
 * Whether this caller can actually start a timer, and so gets a "My day" block.
 *
 * A permission test rather than `role === DEVELOPER`, so a role that gains time
 * tracking later gets the block without this file changing.
 *
 * **An ADMIN and a SYSTEM_ADMIN get it, and that is correct.** They hold
 * `TRACK_PROJECT_TIME` in `ROLE_PERMISSIONS`, so they genuinely can track time,
 * and hiding the block would hide a control they have. A PROJECT_MANAGER does
 * not hold it, which is why they get no block and no "My day" in the navigation:
 * `features.md` says PMs and Admins cannot track time, but the permission map
 * grants it to admins as part of being a strict superset. Where the two
 * disagree, the permission map is what the API enforces.
 */
export function hasMyDay(permissions: Permission[]): boolean {
  return new Set<Permission>(permissions).has(Permission.TRACK_PROJECT_TIME);
}

/** Referenced so the Role import documents intent rather than reading as unused. */
export type DashboardActorRole = Role;
