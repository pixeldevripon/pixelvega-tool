import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DailyWorkReportStatus, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { SlackService } from '@/slack/slack.service';
import { ProjectActivityService } from '@/projects/activity/project-activity.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';
import {
  canEditPlan,
  canEditWrapUp,
  toDailyWorkReportResponse,
  toProjectDailyEntryResponse,
} from '@/projects/daily-work-reports/daily-work-report.mapper';
import {
  DailyEntryTypeFilter,
  QueryDailyWorkReportsDto,
  QueryProjectDailyEntriesDto,
  SubmitPlanDto,
  SubmitWrapUpDto,
  UpdatePlanDto,
  UpdateWrapUpDto,
} from '@/projects/daily-work-reports/dto/daily-work-report.dto';

const REPORT_INCLUDE = {
  entries: {
    include: {
      project: { select: { id: true, name: true, slackChannelId: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  },
};

const PROJECT_ENTRY_INCLUDE = {
  dailyWorkReport: {
    select: {
      date: true,
      status: true,
      userId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  reviewedBy: { select: { id: true, name: true, email: true } },
};

function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

const FEED_TITLE_BY_KIND: Record<'plan' | 'wrap-up', string> = {
  plan: 'Daily Plan & Updates',
  'wrap-up': 'Wrap Up & Updates',
};

// MM-DD-YYYY, matching this team's standup/wrap-up date convention, not the
// ISO format used elsewhere in this API's JSON responses (this only formats
// the Slack message text below, never the stored/returned date field).
function formatDateOnly(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${month}-${day}-${year}`;
}

// Shared by every Slack message this module posts, so they all read the
// same way.
function formatBullets(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');
}

// One combined message per report for the feed channel, covering every
// project the author touched that day, not one message per project (that's
// what the per entry, per project channel posts are for). Edited in place
// using its stored ts on every later change, so the text itself doesn't
// distinguish a first submission from an edit.
function buildCombinedFeedText(
  authorName: string,
  kind: 'plan' | 'wrap-up',
  date: Date,
  sections: Array<{
    projectName: string;
    slackChannelId: string | null;
    content: string;
  }>,
): string {
  const header = `*${authorName} — ${FEED_TITLE_BY_KIND[kind]} (${formatDateOnly(date)})*`;
  const body = sections
    .map((section) => {
      const projectHeader = section.slackChannelId
        ? `<#${section.slackChannelId}>`
        : `*${section.projectName}*`;
      return `${projectHeader}\n${formatBullets(section.content)}`;
    })
    .join('\n\n');
  return `${header}\n\n${body}`;
}

// Same style as buildCombinedFeedText, but with no project header, since
// this message is already posted inside that project's own channel.
function buildSingleProjectSlackText(
  authorName: string,
  kind: 'plan' | 'wrap-up',
  date: Date,
  content: string,
): string {
  const header = `*${authorName} — ${FEED_TITLE_BY_KIND[kind]} (${formatDateOnly(date)})*`;
  return `${header}\n\n${formatBullets(content)}`;
}

// PLAN -> only entries with a plan submitted; WRAP_UP -> only entries with a
// wrap up submitted; undefined -> no filter (both kinds included).
function entryTypeWhere(type?: DailyEntryTypeFilter) {
  if (type === 'PLAN') {
    return { plan: { not: null } };
  }
  if (type === 'WRAP_UP') {
    return { accomplishments: { not: null } };
  }
  return undefined;
}

@Injectable()
export class DailyWorkReportService {
  private readonly logger = new Logger(DailyWorkReportService.name);

  constructor(
    private readonly projectScope: ProjectScopeService,
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
    private readonly slackService: SlackService,
  ) {}

  async create(userId: string, dto: SubmitPlanDto) {
    this.assertNoDuplicateProjects(dto.entries.map((entry) => entry.projectId));

    for (const entry of dto.entries) {
      await this.projectScope.assertStaffedOnProject(entry.projectId, userId);
    }

    const date = toDateOnly(new Date());
    const existing = await this.prisma.dailyWorkReport.findUnique({
      where: { userId_date: { userId, date } },
    });
    if (existing) {
      throw new ConflictException(
        'A daily work report already exists for today',
      );
    }

    const report = await this.prisma.dailyWorkReport.create({
      data: {
        userId,
        date,
        status: DailyWorkReportStatus.PLAN_SUBMITTED,
        planSubmittedAt: new Date(),
        entries: {
          create: dto.entries.map((entry) => ({
            projectId: entry.projectId,
            plan: entry.plan,
          })),
        },
      },
      include: REPORT_INCLUDE,
    });
    for (const entry of dto.entries) {
      await this.projectActivity.log(
        entry.projectId,
        userId,
        'PLAN_SUBMITTED',
        {
          message: 'Daily plan submitted',
          metadata: { dailyWorkReportId: report.id },
        },
      );
    }

    this.postPlanToSlack(report).catch((error) => {
      this.logger.warn(
        `Failed to post plan to Slack for report ${report.id}: ${error}`,
      );
    });

    // Same as above: the caller's own report, so no review rights to compute.
    return toDailyWorkReportResponse(report, { callerId: userId });
  }

  findByUserAndDate(userId: string, date: Date) {
    return this.prisma.dailyWorkReport.findUnique({
      where: { userId_date: { userId, date: toDateOnly(date) } },
      include: REPORT_INCLUDE,
    });
  }

  // All of one project's daily plan and wrap up entries, across every
  // developer and every day. Can be narrowed to one team member and/or a
  // date range.
  async findByProject(
    projectId: string,
    query: QueryProjectDailyEntriesDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanReadProjectEntries(projectId, actorId, actorRole);

    const { page = 1, pageSize = 20, userId, startDate, endDate, type } = query;

    const where = {
      projectId,
      ...entryTypeWhere(type),
      dailyWorkReport: {
        ...(userId && { userId }),
        ...((startDate || endDate) && {
          date: {
            ...(startDate && { gte: toDateOnly(new Date(startDate)) }),
            ...(endDate && { lte: toDateOnly(new Date(endDate)) }),
          },
        }),
      },
    };

    const result = await paginate(
      (args) =>
        this.prisma.dailyProjectEntry.findMany({
          where,
          orderBy: { dailyWorkReport: { date: 'desc' } },
          include: PROJECT_ENTRY_INCLUDE,
          ...args,
        }),
      () => this.prisma.dailyProjectEntry.count({ where }),
      page,
      pageSize,
    );

    // One project, known from the parameter: every entry on this page has it.
    const managedProjectIds = await this.managedProjectIds(
      [projectId],
      actorId,
      actorRole,
    );

    return {
      ...result,
      items: result.items.map((entry) =>
        toProjectDailyEntryResponse(entry, {
          callerId: actorId,
          managedProjectIds,
        }),
      ),
    };
  }

  // One user's daily reports across every project, over a date range or all
  // time. This is the counterpart to findByProject() above that spans
  // projects instead of one project. DEVELOPER/DESIGNER may only view their
  // own (403 if they pass someone else's userId); PROJECT_MANAGER/
  // ADMIN/SYSTEM_ADMIN may view anyone.
  async findAllForUser(
    actorId: string,
    actorRole: Role,
    query: QueryDailyWorkReportsDto,
  ) {
    const {
      page = 1,
      pageSize = 20,
      userId: requestedUserId,
      startDate,
      endDate,
      type,
    } = query;

    const isStaff = actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER;
    if (requestedUserId && requestedUserId !== actorId && !isStaff) {
      throw new ForbiddenException(
        'You can only view your own daily work reports',
      );
    }
    const userId = requestedUserId ?? actorId;

    const entryWhere = entryTypeWhere(type);

    const where = {
      userId,
      ...((startDate || endDate) && {
        date: {
          ...(startDate && { gte: toDateOnly(new Date(startDate)) }),
          ...(endDate && { lte: toDateOnly(new Date(endDate)) }),
        },
      }),
      // A report is only included if it has at least one entry matching the
      // type filter. Otherwise a day with only a plan would still show up
      // empty when the caller asked only for WRAP_UP entries.
      ...(entryWhere && { entries: { some: entryWhere } }),
    };

    const result = await paginate(
      (args) =>
        this.prisma.dailyWorkReport.findMany({
          where,
          orderBy: { date: 'desc' },
          include: {
            entries: {
              ...(entryWhere && { where: entryWhere }),
              include: {
                project: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
          ...args,
        }),
      () => this.prisma.dailyWorkReport.count({ where }),
      page,
      pageSize,
    );

    const managedProjectIds = await this.managedProjectIds(
      result.items.flatMap((report) =>
        report.entries.map((entry) => entry.projectId),
      ),
      actorId,
      actorRole,
    );

    return {
      ...result,
      items: result.items.map((report) =>
        toDailyWorkReportResponse(report, {
          callerId: actorId,
          managedProjectIds,
        }),
      ),
    };
  }

  async updatePlan(reportId: string, userId: string, dto: UpdatePlanDto) {
    const report = await this.getOwnReportOrThrow(reportId, userId);
    this.assertNoDuplicateProjects(dto.entries.map((entry) => entry.projectId));

    if (!canEditPlan(report)) {
      throw new ConflictException('Plan locked after wrap-up submitted');
    }

    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    for (const entry of dto.entries) {
      await this.projectScope.assertStaffedOnProject(entry.projectId, userId);

      const updatedEntry = await this.prisma.dailyProjectEntry.upsert({
        where: {
          dailyWorkReportId_projectId: {
            dailyWorkReportId: report.id,
            projectId: entry.projectId,
          },
        },
        update: { plan: entry.plan },
        create: {
          dailyWorkReportId: report.id,
          projectId: entry.projectId,
          plan: entry.plan,
        },
        include: {
          project: { select: { name: true, slackChannelId: true } },
        },
      });

      await this.projectActivity.log(entry.projectId, userId, 'PLAN_UPDATED', {
        message: 'Daily plan updated',
        metadata: { dailyWorkReportId: report.id },
      });

      if (author && updatedEntry.plan) {
        this.updateEntryPlanProjectMessage(
          updatedEntry,
          author.name,
          report.date,
        ).catch((error) => {
          this.logger.warn(
            `Failed to update plan on Slack for entry ${updatedEntry.id}: ${error}`,
          );
        });
      }
    }

    if (author) {
      this.syncCombinedPlanFeedMessage(report.id, author.name).catch(
        (error) => {
          this.logger.warn(
            `Failed to sync combined plan feed message for report ${report.id}: ${error}`,
          );
        },
      );
    }

    return toDailyWorkReportResponse(
      await this.getOwnReportOrThrow(reportId, userId),
      // No `managedProjectIds`: this is the caller's OWN report, and reviewing
      // your own work is never a review, so `canReview` is false regardless.
      { callerId: userId },
    );
  }

  async submitWrapUp(reportId: string, userId: string, dto: SubmitWrapUpDto) {
    const report = await this.getOwnReportOrThrow(reportId, userId);
    this.assertNoDuplicateProjects(dto.entries.map((entry) => entry.projectId));

    // A plan is mandatory. A report only reaches PLAN_SUBMITTED once a plan
    // has been submitted, so this also rejects a report that's already
    // COMPLETED (a wrap up was already submitted once).
    if (report.status !== DailyWorkReportStatus.PLAN_SUBMITTED) {
      throw new ConflictException('Must submit plan before submitting wrap-up');
    }

    const updatedEntries: Array<{
      id: string;
      accomplishments: string | null;
      project: { name: string; slackChannelId: string | null };
    }> = [];

    for (const entry of dto.entries) {
      await this.projectScope.assertStaffedOnProject(entry.projectId, userId);

      // A wrap up may include a project that wasn't part of the morning plan
      // (unplanned or urgent work). The upsert creates a fresh entry for those.
      const updatedEntry = await this.prisma.dailyProjectEntry.upsert({
        where: {
          dailyWorkReportId_projectId: {
            dailyWorkReportId: report.id,
            projectId: entry.projectId,
          },
        },
        update: { accomplishments: entry.accomplishments },
        create: {
          dailyWorkReportId: report.id,
          projectId: entry.projectId,
          accomplishments: entry.accomplishments,
        },
        include: {
          project: { select: { name: true, slackChannelId: true } },
        },
      });
      updatedEntries.push(updatedEntry);

      await this.projectActivity.log(
        entry.projectId,
        userId,
        'WRAP_UP_SUBMITTED',
        {
          message: 'Daily wrap-up submitted',
          metadata: { dailyWorkReportId: report.id },
        },
      );
    }

    await this.prisma.dailyWorkReport.update({
      where: { id: report.id },
      data: {
        status: DailyWorkReportStatus.COMPLETED,
        wrapUpSubmittedAt: new Date(),
      },
    });

    this.postWrapUpToSlack(
      report.id,
      report.date,
      userId,
      updatedEntries,
    ).catch((error) => {
      this.logger.warn(
        `Failed to post wrap-up to Slack for report ${report.id}: ${error}`,
      );
    });

    return toDailyWorkReportResponse(
      await this.getOwnReportOrThrow(reportId, userId),
      // No `managedProjectIds`: this is the caller's OWN report, and reviewing
      // your own work is never a review, so `canReview` is false regardless.
      { callerId: userId },
    );
  }

  async updateWrapUp(reportId: string, userId: string, dto: UpdateWrapUpDto) {
    const report = await this.getOwnReportOrThrow(reportId, userId);

    if (!canEditWrapUp(report)) {
      throw new ConflictException(
        'Wrap-up locked after 2 hours. Contact admin if correction needed.',
      );
    }

    const reportedProjectIds = new Set(
      report.entries.map((entry) => entry.projectId),
    );

    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    for (const entry of dto.entries) {
      if (!reportedProjectIds.has(entry.projectId)) {
        throw new BadRequestException(
          `Project ${entry.projectId} is not part of this report's wrap-up`,
        );
      }

      const updatedEntry = await this.prisma.dailyProjectEntry.update({
        where: {
          dailyWorkReportId_projectId: {
            dailyWorkReportId: report.id,
            projectId: entry.projectId,
          },
        },
        data: { accomplishments: entry.accomplishments },
        include: {
          project: { select: { name: true, slackChannelId: true } },
        },
      });

      await this.projectActivity.log(
        entry.projectId,
        userId,
        'WRAP_UP_UPDATED',
        {
          message: 'Daily wrap-up updated',
          metadata: { dailyWorkReportId: report.id },
        },
      );

      if (author && updatedEntry.accomplishments) {
        this.updateEntryWrapUpProjectMessage(
          updatedEntry,
          author.name,
          report.date,
        ).catch((error) => {
          this.logger.warn(
            `Failed to update wrap-up on Slack for entry ${updatedEntry.id}: ${error}`,
          );
        });
      }
    }

    if (author) {
      this.syncCombinedWrapUpFeedMessage(report.id, author.name).catch(
        (error) => {
          this.logger.warn(
            `Failed to sync combined wrap-up feed message for report ${report.id}: ${error}`,
          );
        },
      );
    }

    return toDailyWorkReportResponse(
      await this.getOwnReportOrThrow(reportId, userId),
      // No `managedProjectIds`: this is the caller's OWN report, and reviewing
      // your own work is never a review, so `canReview` is false regardless.
      { callerId: userId },
    );
  }

  /**
   * Which of these projects does the caller manage?
   *
   * `canReview` needs it, and reviewing is a manager's act. Computed once for
   * the whole page and deduplicated, so a report spanning five projects costs
   * five checks rather than one per entry.
   */
  private async managedProjectIds(
    projectIds: string[],
    actorId: string,
    actorRole: Role,
  ): Promise<ReadonlySet<string>> {
    const distinct = [...new Set(projectIds)];
    const answers = await Promise.all(
      distinct.map((projectId) =>
        this.projectScope.managesProject(projectId, actorId, actorRole),
      ),
    );
    return new Set(distinct.filter((_projectId, index) => answers[index]));
  }

  private assertNoDuplicateProjects(projectIds: string[]) {
    if (new Set(projectIds).size !== projectIds.length) {
      throw new BadRequestException(
        'Duplicate projectId in the same submission',
      );
    }
  }

  private async getOwnReportOrThrow(reportId: string, userId: string) {
    const report = await this.prisma.dailyWorkReport.findUnique({
      where: { id: reportId },
      include: REPORT_INCLUDE,
    });
    if (!report) {
      throw new NotFoundException('Daily work report not found');
    }
    if (report.userId !== userId) {
      throw new ForbiddenException(
        'You can only manage your own daily work report',
      );
    }
    return report;
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

  private async assertCanReadProjectEntries(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER) {
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: actorId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }
  }

  private async postPlanToSlack(report: {
    id: string;
    userId: string;
    date: Date;
    entries: Array<{
      id: string;
      plan: string | null;
      project: { name: string; slackChannelId: string | null };
    }>;
  }): Promise<void> {
    const author = await this.prisma.user.findUnique({
      where: { id: report.userId },
      select: { name: true },
    });
    if (!author) {
      return;
    }

    for (const entry of report.entries) {
      if (!entry.plan) {
        continue;
      }
      await this.postEntryPlanProjectMessage(
        entry.id,
        entry.project,
        author.name,
        report.date,
        entry.plan,
      );
    }

    await this.syncCombinedPlanFeedMessage(report.id, author.name);
  }

  private async postEntryPlanProjectMessage(
    entryId: string,
    project: { name: string; slackChannelId: string | null },
    authorName: string,
    date: Date,
    plan: string,
  ): Promise<void> {
    if (!project.slackChannelId) {
      return;
    }
    const text = buildSingleProjectSlackText(authorName, 'plan', date, plan);
    const ts = await this.slackService.postMessage(
      project.slackChannelId,
      text,
    );
    if (ts) {
      await this.prisma.dailyProjectEntry.update({
        where: { id: entryId },
        data: { planProjectSlackTs: ts },
      });
    }
  }

  // One combined message per report, covering every project's plan at once.
  // It always refetches the report's current entries and rebuilds the whole
  // message, so it stays correct even if only one project changed.
  private async syncCombinedPlanFeedMessage(
    reportId: string,
    authorName: string,
  ): Promise<void> {
    const feedChannelId = process.env.SLACK_DAILY_FEED_CHANNEL_ID;
    if (!feedChannelId) {
      return;
    }

    const report = await this.prisma.dailyWorkReport.findUnique({
      where: { id: reportId },
      include: {
        entries: {
          where: { plan: { not: null } },
          include: {
            project: { select: { name: true, slackChannelId: true } },
          },
        },
      },
    });
    if (!report || report.entries.length === 0) {
      return;
    }

    const text = buildCombinedFeedText(
      authorName,
      'plan',
      report.date,
      report.entries.map((entry) => ({
        projectName: entry.project.name,
        slackChannelId: entry.project.slackChannelId,
        content: entry.plan as string,
      })),
    );

    if (report.planFeedSlackTs) {
      await this.slackService.updateMessage(
        feedChannelId,
        report.planFeedSlackTs,
        text,
      );
      return;
    }

    const ts = await this.slackService.postMessage(feedChannelId, text);
    if (ts) {
      await this.prisma.dailyWorkReport.update({
        where: { id: reportId },
        data: { planFeedSlackTs: ts },
      });
    }
  }

  private async postWrapUpToSlack(
    reportId: string,
    date: Date,
    userId: string,
    entries: Array<{
      id: string;
      accomplishments: string | null;
      project: { name: string; slackChannelId: string | null };
    }>,
  ): Promise<void> {
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!author) {
      return;
    }

    for (const entry of entries) {
      if (!entry.accomplishments) {
        continue;
      }
      await this.postEntryWrapUpProjectMessage(
        entry.id,
        entry.project,
        author.name,
        date,
        entry.accomplishments,
      );
    }

    await this.syncCombinedWrapUpFeedMessage(reportId, author.name);
  }

  private async postEntryWrapUpProjectMessage(
    entryId: string,
    project: { name: string; slackChannelId: string | null },
    authorName: string,
    date: Date,
    accomplishments: string,
  ): Promise<void> {
    if (!project.slackChannelId) {
      return;
    }
    const text = buildSingleProjectSlackText(
      authorName,
      'wrap-up',
      date,
      accomplishments,
    );
    const ts = await this.slackService.postMessage(
      project.slackChannelId,
      text,
    );
    if (ts) {
      await this.prisma.dailyProjectEntry.update({
        where: { id: entryId },
        data: { wrapUpProjectSlackTs: ts },
      });
    }
  }

  // Same shape as syncCombinedPlanFeedMessage: one combined message per
  // report for every project's wrap up, refetched and rebuilt in full on
  // every call rather than patched per project.
  private async syncCombinedWrapUpFeedMessage(
    reportId: string,
    authorName: string,
  ): Promise<void> {
    const feedChannelId = process.env.SLACK_DAILY_FEED_CHANNEL_ID;
    if (!feedChannelId) {
      return;
    }

    const report = await this.prisma.dailyWorkReport.findUnique({
      where: { id: reportId },
      include: {
        entries: {
          where: { accomplishments: { not: null } },
          include: {
            project: { select: { name: true, slackChannelId: true } },
          },
        },
      },
    });
    if (!report || report.entries.length === 0) {
      return;
    }

    const text = buildCombinedFeedText(
      authorName,
      'wrap-up',
      report.date,
      report.entries.map((entry) => ({
        projectName: entry.project.name,
        slackChannelId: entry.project.slackChannelId,
        content: entry.accomplishments as string,
      })),
    );

    if (report.wrapUpFeedSlackTs) {
      await this.slackService.updateMessage(
        feedChannelId,
        report.wrapUpFeedSlackTs,
        text,
      );
      return;
    }

    const ts = await this.slackService.postMessage(feedChannelId, text);
    if (ts) {
      await this.prisma.dailyWorkReport.update({
        where: { id: reportId },
        data: { wrapUpFeedSlackTs: ts },
      });
    }
  }

  // If the project's channel exists now but this entry never got a ts for
  // it (e.g. the channel didn't exist yet at submission time, and was only
  // connected afterward via connectSlackChannel()), there is no prior
  // message to edit, so post a fresh one now instead of silently never
  // catching up, and persist the returned ts for any later update.
  private async updateEntryPlanProjectMessage(
    entry: {
      id: string;
      plan: string | null;
      planProjectSlackTs: string | null;
      project: { name: string; slackChannelId: string | null };
    },
    authorName: string,
    date: Date,
  ): Promise<void> {
    if (!entry.project.slackChannelId) {
      return;
    }
    const text = buildSingleProjectSlackText(
      authorName,
      'plan',
      date,
      entry.plan as string,
    );

    if (entry.planProjectSlackTs) {
      await this.slackService.updateMessage(
        entry.project.slackChannelId,
        entry.planProjectSlackTs,
        text,
      );
      return;
    }

    const ts = await this.slackService.postMessage(
      entry.project.slackChannelId,
      text,
    );
    if (ts) {
      await this.prisma.dailyProjectEntry.update({
        where: { id: entry.id },
        data: { planProjectSlackTs: ts },
      });
    }
  }

  // Same fallback as updateEntryPlanProjectMessage, for the wrap up project
  // channel message.
  private async updateEntryWrapUpProjectMessage(
    entry: {
      id: string;
      accomplishments: string | null;
      wrapUpProjectSlackTs: string | null;
      project: { name: string; slackChannelId: string | null };
    },
    authorName: string,
    date: Date,
  ): Promise<void> {
    if (!entry.project.slackChannelId) {
      return;
    }
    const text = buildSingleProjectSlackText(
      authorName,
      'wrap-up',
      date,
      entry.accomplishments as string,
    );

    if (entry.wrapUpProjectSlackTs) {
      await this.slackService.updateMessage(
        entry.project.slackChannelId,
        entry.wrapUpProjectSlackTs,
        text,
      );
      return;
    }

    const ts = await this.slackService.postMessage(
      entry.project.slackChannelId,
      text,
    );
    if (ts) {
      await this.prisma.dailyProjectEntry.update({
        where: { id: entry.id },
        data: { wrapUpProjectSlackTs: ts },
      });
    }
  }
}
