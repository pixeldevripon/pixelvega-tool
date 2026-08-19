import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DailyWorkReportStatus, LeaveStatus, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectTimeEntriesService } from '@/projects/time-entries/project/project-time-entries.service';
import { MeetingTimeEntriesService } from '@/projects/time-entries/meeting/meeting-time-entries.service';
import { TARGET_HOURS_PER_DAY } from '@/projects/reports/working-day/working-day.constants';
import {
  countWorkingDaysInRange,
  endOfRangeExclusive,
  toDateOnly,
} from '@/projects/reports/working-day/working-day.util';
import { QueryDeveloperReportDto } from '@/projects/reports/dto/project-report.dto';

const MS_PER_MINUTE = 60 * 1000;

function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

// Plain calculated numbers over a date range for one person, no Claude call
// anywhere in this file. See docs/features/activity-reports/DESIGN.md.
// Reuses ProjectTimeEntriesService/MeetingTimeEntriesService's existing
// cross-project grouping (the same data GET /time-entries/project-summary
// and GET /time-entries/daily-summary already build) rather than
// re-querying TimeEntry/MeetingTimeEntry a second time here.
@Injectable()
export class DeveloperReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectTimeEntriesService: ProjectTimeEntriesService,
    private readonly meetingTimeEntriesService: MeetingTimeEntriesService,
  ) {}

  async getDeveloperReport(
    actorId: string,
    actorRole: Role,
    query: QueryDeveloperReportDto,
  ) {
    const isStaff = actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER;
    if (query.userId && query.userId !== actorId && !isStaff) {
      throw new ForbiddenException(
        'You can only view your own developer report',
      );
    }
    const userId = query.userId ?? actorId;
    const { projectId } = query;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
    }

    const rangeStart = toDateOnly(new Date(query.startDate));
    const rangeEndExclusive = endOfRangeExclusive(new Date(query.endDate));
    const rangeEndInclusive = new Date(rangeEndExclusive.getTime() - 1);

    // Meeting time is never attached to any project, so it plays no part
    // once a projectId filter is given, see computeProjectScopedHours()
    // below.
    const [
      hours,
      dailyWorkReportCompliance,
      blockers,
      leaveDaysTaken,
      projectsTouched,
      holidays,
    ] = await Promise.all([
      projectId
        ? this.computeProjectScopedHours(
            userId,
            projectId,
            rangeStart,
            rangeEndExclusive,
          )
        : this.computeCrossProjectHours(
            actorId,
            actorRole,
            userId,
            query.startDate,
            query.endDate,
          ),
      this.computeDailyWorkReportCompliance(
        userId,
        rangeStart,
        rangeEndInclusive,
        projectId,
      ),
      this.computeBlockers(userId, rangeStart, rangeEndExclusive, projectId),
      this.computeLeaveDaysTaken(userId, rangeStart, rangeEndInclusive),
      this.computeProjectsTouched(
        userId,
        rangeStart,
        rangeEndExclusive,
        rangeEndInclusive,
        projectId,
      ),
      this.prisma.holiday.findMany({
        where: {
          startDate: { lte: rangeEndInclusive },
          endDate: { gte: rangeStart },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);

    const workingDaysInRange = countWorkingDaysInRange(
      rangeStart,
      rangeEndInclusive,
      holidays,
    );
    const totalHours = toHours(hours.projectMinutes + hours.meetingMinutes);

    return {
      userId,
      projectId: projectId ?? null,
      range: { startDate: query.startDate, endDate: query.endDate },
      projectHours: toHours(hours.projectMinutes),
      meetingHours: toHours(hours.meetingMinutes),
      totalHours,
      hoursByProject: hours.hoursByProject,
      hoursByDay: hours.hoursByDay,
      workingDaysInRange,
      hoursGoalRate:
        workingDaysInRange === 0
          ? null
          : Math.round(
              (totalHours / (workingDaysInRange * TARGET_HOURS_PER_DAY)) * 100,
            ) / 100,
      dailyWorkReportCompliance: {
        ...dailyWorkReportCompliance,
        planningCoverageRate:
          workingDaysInRange === 0
            ? null
            : Math.round(
                (dailyWorkReportCompliance.daysPlanned / workingDaysInRange) *
                  100,
              ) / 100,
      },
      blockersReported: blockers.reported,
      blockersResolved: blockers.resolved,
      averageResolutionMinutes: blockers.averageResolutionMinutes,
      leaveDaysTaken,
      projectsTouched,
    };
  }

  // Cross-project: reuses ProjectTimeEntriesService/MeetingTimeEntriesService's
  // existing grouping (the same data GET /time-entries/project-summary and
  // GET /time-entries/daily-summary already build) rather than re-querying
  // TimeEntry/MeetingTimeEntry a second time here.
  private async computeCrossProjectHours(
    actorId: string,
    actorRole: Role,
    userId: string,
    startDate: string,
    endDate: string,
  ) {
    const [dailySummary, projectSummary] = await Promise.all([
      this.meetingTimeEntriesService.findDailySummaryForUser(
        actorId,
        actorRole,
        userId,
        startDate,
        endDate,
      ),
      this.projectTimeEntriesService.findProjectSummaryForUser(
        actorId,
        actorRole,
        userId,
        startDate,
        endDate,
      ),
    ]);
    return {
      projectMinutes: dailySummary.totalProjectMinutes,
      meetingMinutes: dailySummary.totalMeetingMinutes,
      hoursByProject: projectSummary.projects,
      hoursByDay: dailySummary.days,
    };
  }

  // Project scoped: meeting time is never attached to any project, so it is
  // always 0 here, not a company wide figure that would misleadingly
  // inflate what is supposed to be this one project's total.
  private async computeProjectScopedHours(
    userId: string,
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const [entries, project] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: {
          userId,
          projectId,
          durationMinutes: { not: null },
          startedAt: { gte: start, lt: endExclusive },
        },
        select: { startedAt: true, durationMinutes: true },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      }),
    ]);

    const minutesByDay = new Map<string, number>();
    let totalMinutes = 0;
    for (const entry of entries) {
      const day = entry.startedAt.toISOString().slice(0, 10);
      const minutes = entry.durationMinutes ?? 0;
      minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + minutes);
      totalMinutes += minutes;
    }

    return {
      projectMinutes: totalMinutes,
      meetingMinutes: 0,
      hoursByProject: [
        {
          projectId,
          projectName: project?.name ?? null,
          totalMinutes,
          totalHours: toHours(totalMinutes),
        },
      ],
      hoursByDay: [...minutesByDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, minutes]) => ({
          date,
          projectMinutes: minutes,
          meetingMinutes: 0,
          totalMinutes: minutes,
        })),
    };
  }

  private async computeDailyWorkReportCompliance(
    userId: string,
    start: Date,
    endInclusive: Date,
    projectId?: string,
  ) {
    const today = toDateOnly(new Date());

    if (projectId) {
      // Scoped via DailyProjectEntry rather than DailyWorkReport directly,
      // the same trick ProjectReportService uses, since a DailyWorkReport
      // can span other projects too.
      const entries = await this.prisma.dailyProjectEntry.findMany({
        where: {
          projectId,
          dailyWorkReport: { userId, date: { gte: start, lte: endInclusive } },
        },
        select: {
          plan: true,
          accomplishments: true,
          dailyWorkReport: { select: { status: true, date: true } },
        },
      });

      const daysPlanned = entries.filter(
        (entry) =>
          entry.dailyWorkReport.status ===
            DailyWorkReportStatus.PLAN_SUBMITTED ||
          entry.dailyWorkReport.status === DailyWorkReportStatus.COMPLETED,
      ).length;
      const daysWrappedUp = entries.filter(
        (entry) =>
          entry.dailyWorkReport.status === DailyWorkReportStatus.COMPLETED,
      ).length;
      const openPlansWithoutWrapUp = entries.filter(
        (entry) =>
          entry.plan !== null &&
          entry.accomplishments === null &&
          entry.dailyWorkReport.date.getTime() !== today.getTime(),
      ).length;

      return {
        daysPlanned,
        daysWrappedUp,
        planFollowThroughRate:
          daysPlanned === 0
            ? null
            : Math.round((daysWrappedUp / daysPlanned) * 100) / 100,
        openPlansWithoutWrapUp,
      };
    }

    const [reports, openPlansWithoutWrapUp] = await Promise.all([
      this.prisma.dailyWorkReport.findMany({
        where: { userId, date: { gte: start, lte: endInclusive } },
        select: { status: true },
      }),
      this.prisma.dailyProjectEntry.count({
        where: {
          plan: { not: null },
          accomplishments: null,
          dailyWorkReport: {
            userId,
            date: { gte: start, lte: endInclusive, not: today },
          },
        },
      }),
    ]);

    const daysPlanned = reports.filter(
      (report) =>
        report.status === DailyWorkReportStatus.PLAN_SUBMITTED ||
        report.status === DailyWorkReportStatus.COMPLETED,
    ).length;
    const daysWrappedUp = reports.filter(
      (report) => report.status === DailyWorkReportStatus.COMPLETED,
    ).length;

    return {
      daysPlanned,
      daysWrappedUp,
      planFollowThroughRate:
        daysPlanned === 0
          ? null
          : Math.round((daysWrappedUp / daysPlanned) * 100) / 100,
      openPlansWithoutWrapUp,
    };
  }

  private async computeBlockers(
    userId: string,
    start: Date,
    endExclusive: Date,
    projectId?: string,
  ) {
    const [reported, resolvedInRange] = await Promise.all([
      this.prisma.blocker.count({
        where: {
          reportedById: userId,
          createdAt: { gte: start, lt: endExclusive },
          ...(projectId && { projectId }),
        },
      }),
      this.prisma.blocker.findMany({
        where: {
          resolvedById: userId,
          resolvedAt: { gte: start, lt: endExclusive },
          ...(projectId && { projectId }),
        },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    const resolutionMinutes = resolvedInRange.map(
      (blocker) =>
        (blocker.resolvedAt!.getTime() - blocker.createdAt.getTime()) /
        MS_PER_MINUTE,
    );
    const averageResolutionMinutes =
      resolutionMinutes.length === 0
        ? null
        : Math.round(
            resolutionMinutes.reduce((sum, minutes) => sum + minutes, 0) /
              resolutionMinutes.length,
          );

    return {
      reported,
      resolved: resolvedInRange.length,
      averageResolutionMinutes,
    };
  }

  // Overlap, not containment: a leave request that only partially falls
  // inside the requested range still counts, the same "any activity in
  // range" spirit the rest of this report uses.
  private async computeLeaveDaysTaken(
    userId: string,
    start: Date,
    endInclusive: Date,
  ) {
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: LeaveStatus.APPROVED,
        startDate: { lte: endInclusive },
        endDate: { gte: start },
      },
      select: { days: true },
    });
    return requests.reduce((sum, request) => sum + request.days, 0);
  }

  // Full historical record, decided in the design doc: any TimeEntry or
  // DailyProjectEntry activity in range counts, regardless of whether the
  // person is still staffed on that project today. When projectId is given,
  // narrowed to just that one project, so this still answers "was this
  // project actually touched in range" rather than listing every other
  // project too, which would be redundant once everything else in the
  // report is already scoped to the one project.
  private async computeProjectsTouched(
    userId: string,
    start: Date,
    endExclusive: Date,
    endInclusive: Date,
    projectId?: string,
  ) {
    const [timeEntryProjects, dailyEntryProjects] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: {
          userId,
          startedAt: { gte: start, lt: endExclusive },
          ...(projectId && { projectId }),
        },
        select: { projectId: true },
        distinct: ['projectId'],
      }),
      this.prisma.dailyProjectEntry.findMany({
        where: {
          dailyWorkReport: { userId, date: { gte: start, lte: endInclusive } },
          ...(projectId && { projectId }),
        },
        select: { projectId: true },
        distinct: ['projectId'],
      }),
    ]);

    const projectIds = new Set([
      ...timeEntryProjects.map((entry) => entry.projectId),
      ...dailyEntryProjects.map((entry) => entry.projectId),
    ]);
    if (projectIds.size === 0) {
      return [];
    }

    const [projects, activeMemberships] = await Promise.all([
      this.prisma.project.findMany({
        where: { id: { in: [...projectIds] } },
        select: { id: true, name: true },
      }),
      this.prisma.projectMember.findMany({
        where: { userId, projectId: { in: [...projectIds] }, leftAt: null },
        select: { projectId: true },
      }),
    ]);
    const nameById = new Map(
      projects.map((project) => [project.id, project.name]),
    );
    const activeProjectIds = new Set(
      activeMemberships.map((membership) => membership.projectId),
    );

    return [...projectIds].map((projectId) => ({
      projectId,
      projectName: nameById.get(projectId) ?? null,
      active: activeProjectIds.has(projectId),
    }));
  }
}
