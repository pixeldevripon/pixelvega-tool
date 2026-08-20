import { Injectable, Logger } from '@nestjs/common';
import {
  AdditionalRequirementStatus,
  BlockerSeverity,
  BlockerStatus,
  DailyWorkReportStatus,
  LeaveStatus,
  Permission,
  ProjectRole,
  ProjectStatus,
  Prisma,
  Role,
  TimeEntryStatus,
  UserStatus,
} from '@prisma/client';

import { formatDuration } from '@/common/utils/duration.util';
import {
  BLOCKER_SEVERITY_DISPLAY,
  DAILY_WORK_REPORT_STATUS_DISPLAY,
  PROJECT_STATUS_DISPLAY,
  TIME_ENTRY_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';
import {
  TARGET_HOURS_PER_DAY,
  WORKING_DAYS_PER_WEEK,
} from '@/common/working-day/working-day.constants';
import { toDateOnly } from '@/common/working-day/working-day.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  compareForDashboard,
  DASHBOARD_ACTIVE_STATUSES,
} from '@/projects/projects.service';

import {
  buildDashboardProjectCapabilities,
  hasMyDay,
  resolveDashboardAudience,
  tallyOpenBlockers,
  toAttention,
  toAudienceDisplay,
  toBreakdown,
  toDashboardClientProject,
  toDashboardHours,
  toDashboardProject,
  toMetric,
  toRankedRow,
  toRate,
  toSeries,
  type DashboardAttentionCounts,
} from './dashboard.mapper';
import type {
  DashboardResponseDto,
  QueryDashboardDto,
} from './dto/dashboard.dto';

/**
 * How many project cards the overview returns.
 *
 * Bounded by the service and NOT by a client-supplied page size: the overview is
 * a glance, and a caller asking for five hundred cards would turn one screen
 * into the heaviest query in the app. `projectTotal` says how many exist in
 * scope, so a card list that is cut short can say so and link to the full list.
 */
const PROJECT_CARD_LIMIT = 12;

/** Rows in each "top N" list. */
const RANKED_LIMIT = 5;

/** The default trend window, when the caller does not ask for one. */
const DEFAULT_RANGE_DAYS = 14;

/**
 * The landing screen, for every role.
 *
 * ── Seeing and managing are two different questions ──
 *
 * Which projects a caller may SEE is decided by the `where` clause below, once,
 * in `resolveProjectScope`. Whether they may MANAGE one is decided per project by
 * `buildDashboardProjectCapabilities`. Keeping them apart is what lets a project
 * manager see every project while managing only their own, and folding either
 * into the other is how a dashboard starts either hiding work someone is entitled
 * to or offering buttons that answer 403.
 *
 * ── The filter is never in the mapper ──
 *
 * A mapper that drops rows is a leak the first time someone edits it, because the
 * response still looks correct while carrying data the caller may not have. Every
 * scope below is a Prisma `where`.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(
    actor: { id: string; role: Role },
    permissions: Permission[],
    query: QueryDashboardDto,
  ): Promise<DashboardResponseDto> {
    const now = new Date();
    const days = query.days ?? DEFAULT_RANGE_DAYS;
    const { range, previous } = this.resolveRange(now, days);
    const audience = resolveDashboardAudience(permissions);

    const base = {
      audience: toAudienceDisplay(audience),
      generatedAt: now,
      range,
    };

    if (audience === 'CLIENT') {
      return {
        ...base,
        workspace: null,
        client: await this.buildClientBlock(actor.id, now),
      };
    }

    return {
      ...base,
      workspace: await this.buildWorkspaceBlock(
        actor,
        permissions,
        audience,
        range,
        previous,
        now,
      ),
      client: null,
    };
  }

  // ── The range, and the window before it ─────────────────────────────────

  private resolveRange(now: Date, days: number) {
    // Whole days, in UTC, so the boundaries do not shift with the server's
    // local offset and two requests a minute apart cover the same window.
    const to = toDateOnly(now);
    to.setUTCDate(to.getUTCDate() + 1);

    const from = toDateOnly(now);
    from.setUTCDate(from.getUTCDate() - (days - 1));

    // The same length immediately before, which is what every delta compares
    // against. Decided here so two clients cannot pick different baselines and
    // disagree about whether a number is improving.
    const previousFrom = new Date(from);
    previousFrom.setUTCDate(previousFrom.getUTCDate() - days);

    // Two objects, not one. The comparison window is an INPUT to the deltas and
    // has no business in the response: it leaked into `range` when they shared a
    // shape, and a response carrying fields its DTO does not declare is a
    // contract the client cannot rely on. `whitelist` and
    // `forbidNonWhitelisted` guard request bodies, not responses, so nothing
    // else would have caught it.
    return {
      range: { from, to, days, label: `Last ${days} days` },
      previous: { from: previousFrom, to: from },
    };
  }

  // ── Scope ───────────────────────────────────────────────────────────────

  /**
   * Which projects this caller may see.
   *
   * - An ADMIN and a MANAGER see every non-archived project. A manager's
   *   narrowing is on AUTHORITY, not visibility: the product brief says a
   *   project manager sees every project and manages only their own.
   * - Everyone else sees only projects they are actively staffed on. An
   *   unassigned developer must not see a project they are not responsible for,
   *   and this `where` is what makes that true.
   */
  private resolveProjectScope(
    actorId: string,
    audience: 'ADMIN' | 'MANAGER' | 'STAFF',
  ): Prisma.ProjectWhereInput {
    const notArchived: Prisma.ProjectWhereInput = { archivedAt: null };

    if (audience === 'ADMIN' || audience === 'MANAGER') return notArchived;

    return {
      ...notArchived,
      members: { some: { userId: actorId, leftAt: null } },
    };
  }

  // ── The client block ────────────────────────────────────────────────────

  /**
   * `features.md`: "A client sees only their own projects, never anyone else's"
   * and "the status and the deadline, and nothing else".
   *
   * Scoped on `clientId`, so the query itself cannot return another client's
   * project, and mapped through the narrow projection so no internal figure can
   * reach the response even if this method grew.
   */
  private async buildClientBlock(actorId: string, now: Date) {
    const projects = await this.prisma.project.findMany({
      where: { clientId: actorId, archivedAt: null },
      select: { id: true, name: true, status: true, deadline: true },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      take: PROJECT_CARD_LIMIT,
    });

    // The one thing a client can act on: a project sitting in Waiting For
    // Feedback is waiting for THEM.
    const awaiting = (project: { status: ProjectStatus }) =>
      project.status === ProjectStatus.WAITING_FOR_FEEDBACK;

    return {
      projects: projects.map((project) =>
        toDashboardClientProject(project, awaiting(project), now),
      ),
      awaitingMyFeedbackCount: projects.filter(awaiting).length,
    };
  }

  // ── The workspace block ─────────────────────────────────────────────────

  private async buildWorkspaceBlock(
    actor: { id: string; role: Role },
    permissions: Permission[],
    audience: 'ADMIN' | 'MANAGER' | 'STAFF',
    range: { from: Date; to: Date; days: number; label: string },
    previous: { from: Date; to: Date },
    now: Date,
  ) {
    const scope = this.resolveProjectScope(actor.id, audience);
    const held = new Set<Permission>(permissions);
    const isAdmin = audience === 'ADMIN';

    // ONE parallel wave. Every one of these is needed before anything can
    // render, so firing them in sequence would multiply the cold load by six.
    const [
      projects,
      statusGroups,
      openBlockers,
      timeEntries,
      previousTimeEntries,
      attention,
      compliance,
      lastWorkedRows,
    ] = await Promise.all([
      this.loadProjectCards(scope),
      this.prisma.project.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      this.loadOpenBlockers(scope),
      this.loadTimeEntries(scope, range.from, range.to),
      this.loadTimeEntries(scope, previous.from, previous.to),
      this.loadAttention(scope, held, now),
      this.loadStandupCompliance(now),
      // `lastWorkedAt` is not a column: the schema has no such field, so the
      // latest entry per project is read here. One grouped query rather than a
      // per-card lookup, which would be N queries on a twelve-card screen.
      this.prisma.timeEntry.groupBy({
        by: ['projectId'],
        where: { project: scope },
        _max: { startedAt: true },
      }),
    ]);

    const lastWorkedByProject = new Map<string, Date | null>(
      lastWorkedRows.map((row) => [row.projectId, row._max.startedAt]),
    );

    const projectIds = new Set(projects.map((project) => project.id));

    // ── Aggregate in memory, from rows already fetched ──
    //
    // Deliberately not a second round of groupBy queries: the entries are
    // already here for the trend, and re-reading them per aggregate would be
    // four more scans of the same rows.
    const minutesByDay = new Map<string, number>();
    const minutesByProject = new Map<string, number>();
    const minutesByUser = new Map<string, number>();
    for (const entry of timeEntries) {
      const minutes = entry.durationMinutes ?? 0;
      const day = entry.startedAt.toISOString().slice(0, 10);
      minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + minutes);
      minutesByProject.set(
        entry.projectId,
        (minutesByProject.get(entry.projectId) ?? 0) + minutes,
      );
      minutesByUser.set(
        entry.userId,
        (minutesByUser.get(entry.userId) ?? 0) + minutes,
      );
    }

    const previousByProject = new Map<string, number>();
    const previousByUser = new Map<string, number>();
    let previousTotalMinutes = 0;
    for (const entry of previousTimeEntries) {
      const minutes = entry.durationMinutes ?? 0;
      previousTotalMinutes += minutes;
      previousByProject.set(
        entry.projectId,
        (previousByProject.get(entry.projectId) ?? 0) + minutes,
      );
      previousByUser.set(
        entry.userId,
        (previousByUser.get(entry.userId) ?? 0) + minutes,
      );
    }

    const blockersByProject = new Map<
      string,
      { severity: BlockerSeverity }[]
    >();
    const severityCounts = new Map<BlockerSeverity, number>();
    for (const blocker of openBlockers) {
      const list = blockersByProject.get(blocker.projectId) ?? [];
      list.push({ severity: blocker.severity });
      blockersByProject.set(blocker.projectId, list);
      severityCounts.set(
        blocker.severity,
        (severityCounts.get(blocker.severity) ?? 0) + 1,
      );
    }

    // ── The cards ──
    const cards = projects
      .slice()
      .sort(compareForDashboard)
      .slice(0, PROJECT_CARD_LIMIT)
      .map((project) => {
        const memberships = project.members.filter(
          (member) => member.leftAt === null,
        );
        const mine = memberships.filter((member) => member.userId === actor.id);

        return toDashboardProject(
          project,
          {
            blockers: tallyOpenBlockers(
              blockersByProject.get(project.id) ?? [],
            ),
            minutesInRange: minutesByProject.get(project.id) ?? 0,
            lastWorkedAt: lastWorkedByProject.get(project.id) ?? null,
            capabilities: buildDashboardProjectCapabilities({
              permissions,
              isMember: mine.length > 0,
              isProjectManagerOfThis: mine.some(
                (member) => member.role === ProjectRole.PROJECT_MANAGER,
              ),
            }),
          },
          now,
        );
      });

    const statusCounts = new Map<ProjectStatus, number>(
      statusGroups.map((group) => [group.status, group._count._all]),
    );
    // The shared constant, not a second literal list: this is the same
    // definition of "active" that decides the card ordering.
    const activeCount = projects.filter((project) =>
      DASHBOARD_ACTIVE_STATUSES.includes(project.status),
    ).length;

    const totalMinutes = [...minutesByDay.values()].reduce((a, b) => a + b, 0);
    const atRiskCount = cards.filter((card) => card.isAtRisk).length;

    return {
      headline: [
        toMetric({
          key: 'activeProjects',
          label: 'Active projects',
          caption: 'Ready for work or in progress',
          value: activeCount,
          valueLabel: String(activeCount),
          // No historical snapshot of "how many were active a fortnight ago"
          // exists, and inventing one from status-change activity would be a
          // different number with the same name. Null is the honest answer.
          previousValue: null,
          direction: 'neutral',
        }),
        toMetric({
          key: 'hoursLogged',
          label: 'Hours logged',
          caption: range.label,
          value: totalMinutes,
          valueLabel: formatDuration(totalMinutes) as string,
          previousValue: previousTotalMinutes,
          direction: 'up-is-good',
        }),
        toMetric({
          key: 'openBlockers',
          label: 'Open blockers',
          caption: 'Unresolved',
          value: openBlockers.length,
          valueLabel: String(openBlockers.length),
          previousValue: null,
          direction: 'up-is-bad',
        }),
        toMetric({
          key: 'atRisk',
          label: 'At risk',
          caption: 'Overdue or blocked',
          value: atRiskCount,
          valueLabel: String(atRiskCount),
          previousValue: null,
          direction: 'up-is-bad',
        }),
      ],

      hoursTrend: toSeries({
        label: 'Hours logged',
        from: range.from,
        days: range.days,
        minutesByDay,
        // NULL, and that is the correction rather than an omission. This series
        // is the whole team's hours per day, and TARGET_HOURS_PER_DAY is one
        // PERSON's eight hours. Sending it here drew a target at 480 minutes
        // under a team that logs around 9,000, so the line sat flat on the axis
        // and read as "the team is permanently at its goal". A team target is
        // eight hours times however many people were expected to work that day,
        // which this query does not know, so the honest answer is no target.
        // `myDay.myHoursTrend` keeps the per-person one, where it is the truth.
        dailyTarget: null,
      }),

      statusBreakdown: toBreakdown({
        label: 'Projects by status',
        unit: 'projects',
        display: PROJECT_STATUS_DISPLAY,
        counts: statusCounts,
      }),

      blockerBreakdown: toBreakdown({
        label: 'Open blockers by severity',
        unit: 'blockers',
        display: BLOCKER_SEVERITY_DISPLAY,
        counts: severityCounts,
      }),

      topProjectsByHours: this.buildTopProjects(
        projects,
        minutesByProject,
        previousByProject,
        range.label,
      ),

      // Null rather than empty for a caller with no business seeing a
      // leaderboard of colleagues. Empty would claim the team logged no hours.
      topContributors:
        isAdmin || audience === 'MANAGER'
          ? await this.buildTopContributors(
              minutesByUser,
              previousByUser,
              range.label,
            )
          : null,

      projects: cards,
      projectTotal: projects.length,
      attention: toAttention(attention),
      standupComplianceToday: compliance,
      myDay: hasMyDay(permissions)
        ? await this.buildMyDay(actor.id, range, now, projectIds)
        : null,
    };
  }

  // ── Loaders ─────────────────────────────────────────────────────────────

  private loadProjectCards(scope: Prisma.ProjectWhereInput) {
    return this.prisma.project.findMany({
      where: scope,
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        deadline: true,
        plannedStartDate: true,
        estimatedHours: true,
        actualHours: true,
        createdAt: true,
        projectTypeTags: { select: { type: true } },
        members: {
          // `leftAt` comes back rather than being filtered here, so the mapper
          // enforces "current team only" itself and a forgotten filter cannot
          // put a former member on a card.
          select: {
            userId: true,
            role: true,
            leftAt: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  private loadOpenBlockers(scope: Prisma.ProjectWhereInput) {
    return this.prisma.blocker.findMany({
      // Scoped THROUGH the project, so a blocker on a project the caller cannot
      // see is not counted either. Counting it would leak that the project
      // exists, and would make the caller's numbers disagree with their cards.
      where: {
        project: scope,
        status: { in: [BlockerStatus.OPEN, BlockerStatus.IN_PROGRESS] },
      },
      select: { id: true, projectId: true, severity: true },
    });
  }

  private loadTimeEntries(
    scope: Prisma.ProjectWhereInput,
    from: Date,
    to: Date,
  ) {
    return this.prisma.timeEntry.findMany({
      where: {
        project: scope,
        durationMinutes: { not: null },
        startedAt: { gte: from, lt: to },
      },
      select: {
        projectId: true,
        userId: true,
        startedAt: true,
        durationMinutes: true,
      },
    });
  }

  /**
   * The raw queue sizes. Which of them the caller sees, in what order and at
   * what urgency, is `toAttention`'s decision: this method counts rows and
   * decides nothing.
   */
  private async loadAttention(
    scope: Prisma.ProjectWhereInput,
    held: Set<Permission>,
    now: Date,
  ): Promise<DashboardAttentionCounts> {
    const [
      pendingRequirements,
      internalReview,
      awaitingClientFeedback,
      overdueProjects,
      notReadyToStart,
      pendingLeaveRequests,
    ] = await Promise.all([
      this.prisma.additionalRequirement.count({
        where: {
          project: scope,
          status: AdditionalRequirementStatus.PENDING_REVIEW,
        },
      }),
      this.prisma.project.count({
        where: { ...scope, status: ProjectStatus.INTERNAL_REVIEW },
      }),
      this.prisma.project.count({
        where: { ...scope, status: ProjectStatus.WAITING_FOR_FEEDBACK },
      }),
      this.prisma.project.count({
        where: {
          ...scope,
          deadline: { lt: now },
          // A finished project is never overdue: it is finished.
          status: {
            notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
          },
        },
      }),
      this.prisma.project.count({
        where: { ...scope, status: ProjectStatus.PLANNING },
      }),
      // Null unless the caller may actually review one. Only an Admin can
      // approve or reject, so showing the number to a project manager would
      // offer work they cannot do.
      held.has(Permission.REVIEW_LEAVE_REQUEST)
        ? this.prisma.leaveRequest.count({
            where: { status: LeaveStatus.PENDING },
          })
        : Promise.resolve(null),
    ]);

    return {
      pendingRequirements,
      internalReview,
      awaitingClientFeedback,
      overdueProjects,
      notReadyToStart,
      pendingLeaveRequests,
    };
  }

  /**
   * Today's standup compliance across the whole team.
   *
   * Deliberately NOT scoped to the caller's projects: a standup belongs to a
   * person rather than to a project, and "nine of twelve people filed today" is
   * a fact about the team either way. Expected counts only ACTIVE employees who
   * are required to file, which is why a client or a suspended account cannot
   * drag the rate down.
   */
  private async loadStandupCompliance(now: Date) {
    const today = toDateOnly(now);

    const [submitted, expected] = await Promise.all([
      this.prisma.dailyWorkReport.count({
        where: {
          date: today,
          status: {
            in: [
              DailyWorkReportStatus.PLAN_SUBMITTED,
              DailyWorkReportStatus.COMPLETED,
            ],
          },
        },
      }),
      this.prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          role: { in: [Role.DEVELOPER, Role.DESIGNER] },
        },
      }),
    ]);

    return { submitted, expected, ...toRate(submitted, expected) };
  }

  private buildTopProjects(
    projects: {
      id: string;
      name: string;
      projectTypeTags: { type: string }[];
    }[],
    minutes: Map<string, number>,
    previous: Map<string, number>,
    caption: string,
  ) {
    const ranked = projects
      .map((project) => ({
        project,
        minutes: minutes.get(project.id) ?? 0,
      }))
      // Projects with no hours in the range are not "top" anything, and a list
      // padded with zeroes hides how few actually moved.
      .filter((row) => row.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, RANKED_LIMIT);

    const listTotal = ranked.reduce((sum, row) => sum + row.minutes, 0);

    return {
      label: 'Top projects by hours',
      caption,
      rows: ranked.map((row) =>
        toRankedRow({
          id: row.project.id,
          name: row.project.name,
          subtitle:
            row.project.projectTypeTags.map((tag) => tag.type).join(', ') ||
            null,
          minutes: row.minutes,
          previousMinutes: previous.get(row.project.id) ?? null,
          listTotal,
        }),
      ),
    };
  }

  private async buildTopContributors(
    minutes: Map<string, number>,
    previous: Map<string, number>,
    caption: string,
  ) {
    const topIds = [...minutes.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, RANKED_LIMIT)
      .map(([id]) => id);

    if (topIds.length === 0) {
      return { label: 'Busiest people', caption, rows: [] };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: topIds } },
      // `select:` because User.password holds a real hash.
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        employeeProfile: { select: { designation: true } },
      },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    const listTotal = topIds.reduce(
      (sum, id) => sum + (minutes.get(id) ?? 0),
      0,
    );

    return {
      label: 'Busiest people',
      caption,
      rows: topIds.map((id) => {
        const user = byId.get(id);
        return toRankedRow({
          id,
          name: user?.name ?? 'Unknown',
          subtitle: user?.employeeProfile?.designation ?? null,
          avatarUrl: user?.avatarUrl ?? null,
          minutes: minutes.get(id) ?? 0,
          previousMinutes: previous.get(id) ?? null,
          listTotal,
        });
      }),
    };
  }

  /**
   * The caller's own day.
   *
   * `projectIds` is the set they may see, and the active timer is only reported
   * with its project name when that project is in it. A timer on a project
   * outside their scope should not be how they learn the project exists.
   */
  private async buildMyDay(
    actorId: string,
    range: { from: Date; to: Date; days: number },
    now: Date,
    projectIds: Set<string>,
  ) {
    const today = toDateOnly(now);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);

    const [running, myEntries, workReport, myBlockerCount] = await Promise.all([
      this.prisma.timeEntry.findFirst({
        where: { userId: actorId, status: TimeEntryStatus.RUNNING },
        select: {
          id: true,
          projectId: true,
          startedAt: true,
          status: true,
          project: { select: { id: true, name: true } },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          userId: actorId,
          durationMinutes: { not: null },
          startedAt: { gte: range.from, lt: range.to },
        },
        select: { startedAt: true, durationMinutes: true },
      }),
      this.prisma.dailyWorkReport.findFirst({
        where: { userId: actorId, date: today },
        select: { status: true },
      }),
      this.prisma.blocker.count({
        where: {
          status: { in: [BlockerStatus.OPEN, BlockerStatus.IN_PROGRESS] },
          OR: [{ reportedById: actorId }, { assignedToId: actorId }],
        },
      }),
    ]);

    const minutesByDay = new Map<string, number>();
    let todayMinutes = 0;
    let weekMinutes = 0;
    for (const entry of myEntries) {
      const minutes = entry.durationMinutes ?? 0;
      const day = entry.startedAt.toISOString().slice(0, 10);
      minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + minutes);
      if (entry.startedAt >= today && entry.startedAt < tomorrow) {
        todayMinutes += minutes;
      }
      if (entry.startedAt >= weekStart) weekMinutes += minutes;
    }

    const weekTargetMinutes = TARGET_HOURS_PER_DAY * WORKING_DAYS_PER_WEEK * 60;
    const weekProgress = toRate(weekMinutes, weekTargetMinutes);

    return {
      activeTimer: running
        ? {
            timeEntryId: running.id,
            projectId: running.projectId,
            projectName: projectIds.has(running.projectId)
              ? (running.project?.name ?? null)
              : null,
            startedAt: running.startedAt,
            status: toEnumDisplay(TIME_ENTRY_STATUS_DISPLAY, running.status),
            // Elapsed from the start of the running segment. The exact total
            // including paused time is the time-entry resource's answer; this is
            // what a header counts up from.
            elapsedMinutes: Math.max(
              0,
              Math.round(
                (now.getTime() - running.startedAt.getTime()) / 60_000,
              ),
            ),
            elapsedLabel: formatDuration(
              Math.max(
                0,
                Math.round(
                  (now.getTime() - running.startedAt.getTime()) / 60_000,
                ),
              ),
            ) as string,
          }
        : null,
      today: toDashboardHours(todayMinutes),
      thisWeek: toDashboardHours(weekMinutes),
      weekTargetMinutes,
      weekTargetLabel: formatDuration(weekTargetMinutes) as string,
      // Uncapped on purpose: someone forty hours into a forty eight hour week
      // and someone sixty hours in are not the same week, and clamping here
      // would throw away the only figure that says so. A bar clips it.
      weekProgressRate: weekProgress.rate,
      weekProgressLabel: weekProgress.rateLabel,
      myHoursTrend: toSeries({
        label: 'My hours',
        from: range.from,
        days: range.days,
        minutesByDay,
        dailyTarget: TARGET_HOURS_PER_DAY * 60,
      }),
      todayWorkReportStatus: workReport
        ? toEnumDisplay(DAILY_WORK_REPORT_STATUS_DISPLAY, workReport.status)
        : null,
      myOpenBlockerCount: myBlockerCount,
    };
  }
}
