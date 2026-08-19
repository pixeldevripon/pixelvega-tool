import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdditionalRequirementStatus,
  BlockerSeverity,
  BlockerStatus,
  ClientFeedbackDecision,
  DailyWorkReportStatus,
  InternalReviewDecision,
  ProjectActivityType,
  ProjectStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';
import {
  countWorkingDaysInRange,
  endOfRangeExclusive,
  toDateOnly,
} from '@/projects/reports/working-day/working-day.util';
import { QueryProjectReportDto } from '@/projects/reports/dto/project-report.dto';
import {
  PROJECT_PRIORITY_DISPLAY,
  PROJECT_ROLE_DISPLAY,
  PROJECT_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function countBySeverity(
  rows: Array<{ severity: BlockerSeverity }>,
): Record<BlockerSeverity, number> {
  const counts: Record<BlockerSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
  };
  for (const row of rows) {
    counts[row.severity]++;
  }
  return counts;
}

// Plain calculated numbers over a date range for one project, no Claude
// call anywhere in this file. See docs/features/activity-reports/DESIGN.md.
// ai-integration's project summary and AI status report both call
// getProjectReport() for their numeric side rather than querying these
// same tables a second time, see "Reusing the calculated Project Report"
// in docs/features/ai-integration/DESIGN.MD.
@Injectable()
export class ProjectReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectScope: ProjectScopeService,
  ) {}

  async getProjectReport(
    projectId: string,
    actorId: string,
    actorRole: Role,
    query: QueryProjectReportDto,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    await this.projectScope.assertActiveMember(projectId, actorId, actorRole);

    const rangeStart = toDateOnly(new Date(query.startDate));
    const rangeEndExclusive = endOfRangeExclusive(new Date(query.endDate));
    const rangeEndInclusive = new Date(rangeEndExclusive.getTime() - 1);

    const activeMembers = await this.prisma.projectMember.findMany({
      where: { projectId, leftAt: null },
      include: { user: { select: { id: true, name: true } } },
    });
    const activeUserIds = activeMembers.map((member) => member.userId);

    const [
      hoursByMember,
      statusChanges,
      staffingChanges,
      blockers,
      additionalRequirements,
      internalReview,
      clientFeedback,
      dailyWorkReportCompliance,
      firstRoundApprovals,
      holidays,
    ] = await Promise.all([
      this.computeHoursByMember(projectId, rangeStart, rangeEndExclusive),
      this.computeStatusChanges(projectId, rangeStart, rangeEndExclusive),
      this.computeStaffingChanges(projectId, rangeStart, rangeEndExclusive),
      this.computeBlockers(projectId, rangeStart, rangeEndExclusive),
      this.computeAdditionalRequirements(
        projectId,
        rangeStart,
        rangeEndExclusive,
      ),
      this.computeInternalReview(projectId, rangeStart, rangeEndExclusive),
      this.computeClientFeedback(projectId, rangeStart, rangeEndExclusive),
      this.computeDailyWorkReportCompliance(
        projectId,
        activeUserIds,
        rangeStart,
        rangeEndInclusive,
      ),
      this.computeFirstRoundApprovals(projectId),
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

    return {
      status: toEnumDisplay(PROJECT_STATUS_DISPLAY, project.status),
      priority: toEnumDisplay(PROJECT_PRIORITY_DISPLAY, project.priority),
      estimatedHours: project.estimatedHours,
      actualHours: project.actualHours,
      remainingHours:
        project.estimatedHours === null
          ? null
          : project.estimatedHours - project.actualHours,
      plannedStartDate: project.plannedStartDate,
      deadline: project.deadline,
      roster: activeMembers.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        role: toEnumDisplay(PROJECT_ROLE_DISPLAY, member.role),
      })),
      internalReviewFirstRoundApproved:
        firstRoundApprovals.internalReviewFirstRoundApproved,
      clientFeedbackFirstRoundApproved:
        firstRoundApprovals.clientFeedbackFirstRoundApproved,
      range: { startDate: query.startDate, endDate: query.endDate },
      hoursByMember,
      statusChanges,
      staffingChanges,
      blockers,
      additionalRequirements,
      internalReview,
      clientFeedback,
      workingDaysInRange,
      dailyWorkReportCompliance: {
        ...dailyWorkReportCompliance,
        // Literal formula from the design doc: daysPlanned / workingDaysInRange.
        // For a team of more than one active member this can read above 1,
        // since daysPlanned is summed across everyone while the denominator
        // is not multiplied by roster size. Flagged as a known limitation
        // of the spec as written, not fixed silently here.
        planningCoverageRate:
          workingDaysInRange === 0
            ? null
            : Math.round(
                (dailyWorkReportCompliance.daysPlanned / workingDaysInRange) *
                  100,
              ) / 100,
      },
    };
  }

  private async computeHoursByMember(
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        projectId,
        durationMinutes: { not: null },
        startedAt: { gte: start, lt: endExclusive },
      },
      select: { userId: true, durationMinutes: true },
    });

    const minutesByUser = new Map<string, number>();
    for (const entry of entries) {
      minutesByUser.set(
        entry.userId,
        (minutesByUser.get(entry.userId) ?? 0) + (entry.durationMinutes ?? 0),
      );
    }
    if (minutesByUser.size === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...minutesByUser.keys()] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((user) => [user.id, user.name]));

    return [...minutesByUser.entries()]
      .map(([userId, minutes]) => ({
        userId,
        name: nameById.get(userId) ?? 'Unknown',
        hours: Math.round((minutes / 60) * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours);
  }

  private async computeStatusChanges(
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const activities = await this.prisma.projectActivity.findMany({
      where: {
        projectId,
        type: ProjectActivityType.STATUS_CHANGED,
        createdAt: { gte: start, lt: endExclusive },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, metadata: true },
    });

    return activities.map((activity) => {
      const metadata = activity.metadata as {
        from?: string;
        to?: string;
      } | null;
      return {
        changedAt: activity.createdAt,
        // The activity metadata holds raw enum strings written at the time, so
        // a value this build does not know about is possible. toEnumDisplay
        // degrades to the raw value rather than throwing on an old row.
        // Cast because the metadata is untyped JSON written at the time of the
        // change: it is a string, and nothing guarantees this build still knows
        // that member. That is precisely the case toEnumDisplay degrades on.
        from: toEnumDisplay(
          PROJECT_STATUS_DISPLAY,
          (metadata?.from ?? null) as ProjectStatus | null,
        ),
        to: toEnumDisplay(
          PROJECT_STATUS_DISPLAY,
          (metadata?.to ?? null) as ProjectStatus | null,
        ),
      };
    });
  }

  private async computeStaffingChanges(
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const [joined, left] = await Promise.all([
      this.prisma.projectActivity.count({
        where: {
          projectId,
          type: ProjectActivityType.MEMBER_JOINED,
          createdAt: { gte: start, lt: endExclusive },
        },
      }),
      this.prisma.projectActivity.count({
        where: {
          projectId,
          type: ProjectActivityType.MEMBER_LEFT,
          createdAt: { gte: start, lt: endExclusive },
        },
      }),
    ]);
    return { joined, left };
  }

  private async computeBlockers(
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const [openedInRange, resolvedInRange, currentlyOpen] = await Promise.all([
      this.prisma.blocker.findMany({
        where: { projectId, createdAt: { gte: start, lt: endExclusive } },
        select: { severity: true },
      }),
      this.prisma.blocker.findMany({
        where: { projectId, resolvedAt: { gte: start, lt: endExclusive } },
        select: {
          severity: true,
          createdAt: true,
          resolvedAt: true,
          deadlineExtensionDays: true,
        },
      }),
      this.prisma.blocker.findMany({
        where: {
          projectId,
          status: { in: [BlockerStatus.OPEN, BlockerStatus.IN_PROGRESS] },
        },
        select: { createdAt: true },
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

    const now = Date.now();
    const currentlyOpenDaysOpen = currentlyOpen.map((blocker) =>
      Math.floor((now - blocker.createdAt.getTime()) / MS_PER_DAY),
    );
    const currentlyOpenAverageDaysOpen =
      currentlyOpenDaysOpen.length === 0
        ? null
        : Math.round(
            (currentlyOpenDaysOpen.reduce((sum, days) => sum + days, 0) /
              currentlyOpenDaysOpen.length) *
              10,
          ) / 10;

    return {
      openedCount: openedInRange.length,
      resolvedCount: resolvedInRange.length,
      openedBySeverity: countBySeverity(openedInRange),
      resolvedBySeverity: countBySeverity(resolvedInRange),
      averageResolutionMinutes,
      currentlyOpenCount: currentlyOpen.length,
      currentlyOpenAverageDaysOpen,
      deadlineExtensionCount: resolvedInRange.filter(
        (blocker) => (blocker.deadlineExtensionDays ?? 0) > 0,
      ).length,
    };
  }

  // "Received" is scoped by createdAt, "approved"/"rejected" by reviewedAt,
  // the same two-different-timestamps-per-action shape blockers use above
  // (opened by createdAt, resolved by resolvedAt).
  private async computeAdditionalRequirements(
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const [receivedCount, approved, rejectedCount] = await Promise.all([
      this.prisma.additionalRequirement.count({
        where: { projectId, createdAt: { gte: start, lt: endExclusive } },
      }),
      this.prisma.additionalRequirement.findMany({
        where: {
          projectId,
          status: AdditionalRequirementStatus.APPROVED,
          reviewedAt: { gte: start, lt: endExclusive },
        },
        select: { approvedAdditionalHours: true, deadlineExtensionDays: true },
      }),
      this.prisma.additionalRequirement.count({
        where: {
          projectId,
          status: AdditionalRequirementStatus.REJECTED,
          reviewedAt: { gte: start, lt: endExclusive },
        },
      }),
    ]);

    return {
      receivedCount,
      approvedCount: approved.length,
      rejectedCount,
      totalApprovedAdditionalHours: approved.reduce(
        (sum, requirement) => sum + (requirement.approvedAdditionalHours ?? 0),
        0,
      ),
      totalDeadlineExtensionDays: approved.reduce(
        (sum, requirement) => sum + (requirement.deadlineExtensionDays ?? 0),
        0,
      ),
    };
  }

  private async computeInternalReview(
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const rounds = await this.prisma.projectInternalReview.findMany({
      where: { projectId, createdAt: { gte: start, lt: endExclusive } },
      select: { decision: true },
    });
    return {
      approvedCount: rounds.filter(
        (round) => round.decision === InternalReviewDecision.APPROVED,
      ).length,
      changesRequiredCount: rounds.filter(
        (round) => round.decision === InternalReviewDecision.CHANGES_REQUIRED,
      ).length,
    };
  }

  private async computeClientFeedback(
    projectId: string,
    start: Date,
    endExclusive: Date,
  ) {
    const rounds = await this.prisma.clientFeedback.findMany({
      where: { projectId, createdAt: { gte: start, lt: endExclusive } },
      select: { decision: true },
    });
    return {
      approvedCount: rounds.filter(
        (round) => round.decision === ClientFeedbackDecision.APPROVED,
      ).length,
      changesRequestedCount: rounds.filter(
        (round) => round.decision === ClientFeedbackDecision.CHANGES_REQUESTED,
      ).length,
    };
  }

  // Evaluated against round 1 specifically, a fixed fact about the
  // project's own history, not something the requested range changes, see
  // docs/features/activity-reports/DESIGN.md.
  private async computeFirstRoundApprovals(projectId: string) {
    const [internalRoundOne, clientRoundOne] = await Promise.all([
      this.prisma.projectInternalReview.findUnique({
        where: { projectId_reviewRound: { projectId, reviewRound: 1 } },
        select: { decision: true },
      }),
      this.prisma.clientFeedback.findUnique({
        where: { projectId_feedbackRound: { projectId, feedbackRound: 1 } },
        select: { decision: true },
      }),
    ]);
    return {
      internalReviewFirstRoundApproved: internalRoundOne
        ? internalRoundOne.decision === InternalReviewDecision.APPROVED
        : null,
      clientFeedbackFirstRoundApproved: clientRoundOne
        ? clientRoundOne.decision === ClientFeedbackDecision.APPROVED
        : null,
    };
  }

  // daysPlanned/daysWrappedUp counted via DailyProjectEntry rows for this
  // project (each row is one user's one day touching this project), not
  // DailyWorkReport directly, since a work report can span other projects
  // too.
  private async computeDailyWorkReportCompliance(
    projectId: string,
    activeUserIds: string[],
    start: Date,
    endInclusive: Date,
  ) {
    if (activeUserIds.length === 0) {
      return { daysPlanned: 0, daysWrappedUp: 0, planFollowThroughRate: null };
    }

    const entries = await this.prisma.dailyProjectEntry.findMany({
      where: {
        projectId,
        dailyWorkReport: {
          userId: { in: activeUserIds },
          date: { gte: start, lte: endInclusive },
        },
      },
      select: { dailyWorkReport: { select: { status: true } } },
    });

    const daysPlanned = entries.filter(
      (entry) =>
        entry.dailyWorkReport.status === DailyWorkReportStatus.PLAN_SUBMITTED ||
        entry.dailyWorkReport.status === DailyWorkReportStatus.COMPLETED,
    ).length;
    const daysWrappedUp = entries.filter(
      (entry) =>
        entry.dailyWorkReport.status === DailyWorkReportStatus.COMPLETED,
    ).length;

    return {
      daysPlanned,
      daysWrappedUp,
      planFollowThroughRate:
        daysPlanned === 0
          ? null
          : Math.round((daysWrappedUp / daysPlanned) * 100) / 100,
    };
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
