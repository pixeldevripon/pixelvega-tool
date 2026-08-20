import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  DailyWorkReportStatus,
  NotificationType,
  Prisma,
  ProjectStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackService } from '@/slack/slack.service';
import { toDateOnly } from '@/common/working-day/working-day.util';
import { NotificationsService } from './notifications.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEADLINE_LOOKAHEAD_DAYS = 2;
const NON_TERMINAL_STATUSES: ProjectStatus[] = Object.values(
  ProjectStatus,
).filter(
  (status) =>
    status !== ProjectStatus.COMPLETED && status !== ProjectStatus.CANCELLED,
);
const STANDUP_ELIGIBLE_ROLES: Role[] = [
  Role.DEVELOPER,
  Role.DESIGNER,
  Role.PROJECT_MANAGER,
];

// The two reminders that are caused by time passing rather than an action,
// see docs/features/notifications/DESIGN.md. Both @Cron times are given an
// explicit Asia/Dhaka timeZone rather than hand converted to UTC, since
// this team's own notion of "9:30 AM"/"11 PM" is local time, not UTC.
// Every check dedupes against today's own Notification rows first, a
// restart mid cron window (a deploy, for example) must never double
// notify the same person for the same day.
@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly slackService: SlackService,
  ) {}

  @Cron('30 9 * * *', { timeZone: 'Asia/Dhaka' })
  async checkMissedStandups(): Promise<void> {
    if (this.isDhakaFriday()) {
      return;
    }

    const today = toDateOnly(new Date());
    const [eligibleUsers, submittedReports] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: { in: STANDUP_ELIGIBLE_ROLES }, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.dailyWorkReport.findMany({
        where: { date: today },
        select: { userId: true },
      }),
    ]);

    const submittedUserIds = new Set(submittedReports.map((r) => r.userId));
    const missingUserIds = eligibleUsers
      .map((user) => user.id)
      .filter((userId) => !submittedUserIds.has(userId));

    await this.notifyEachOncePerDay(
      missingUserIds,
      NotificationType.STANDUP_MISSED,
      "You haven't submitted today's daily standup yet",
    );
  }

  @Cron('0 23 * * *', { timeZone: 'Asia/Dhaka' })
  async checkMissedWrapUps(): Promise<void> {
    if (this.isDhakaFriday()) {
      return;
    }

    const today = toDateOnly(new Date());
    const incompleteReports = await this.prisma.dailyWorkReport.findMany({
      where: { date: today, status: DailyWorkReportStatus.PLAN_SUBMITTED },
      select: { userId: true },
    });

    await this.notifyEachOncePerDay(
      incompleteReports.map((r) => r.userId),
      NotificationType.WRAP_UP_MISSED,
      "You haven't submitted today's wrap up yet",
    );
  }

  // Deliberately not skipped on Friday, unlike the two reminders above, a
  // deadline two days away is real regardless of what day it is.
  @Cron('0 9 * * *', { timeZone: 'Asia/Dhaka' })
  async checkDeadlinesApproaching(): Promise<void> {
    const targetDayStart = new Date(
      toDateOnly(new Date()).getTime() + DEADLINE_LOOKAHEAD_DAYS * MS_PER_DAY,
    );
    const targetDayEndExclusive = new Date(
      targetDayStart.getTime() + MS_PER_DAY,
    );

    const projects = await this.prisma.project.findMany({
      where: {
        status: { in: NON_TERMINAL_STATUSES },
        deadline: { gte: targetDayStart, lt: targetDayEndExclusive },
      },
      select: { id: true, name: true, slackChannelId: true },
    });

    for (const project of projects) {
      await this.notifyDeadlineApproaching(project);
    }
  }

  private async notifyDeadlineApproaching(project: {
    id: string;
    name: string;
    slackChannelId: string | null;
  }): Promise<void> {
    const [allIds, pmAndAdminIds] = await Promise.all([
      this.notificationsService.resolveAllActiveMembersAndAdminIds(project.id),
      this.notificationsService.resolveManagingPmAndAdminIds(project.id),
    ]);
    const pmAndAdminIdSet = new Set(pmAndAdminIds);

    const notifiedAnyone = (
      await Promise.all(
        allIds.map((userId) =>
          this.notifyOncePerDay(
            userId,
            NotificationType.DEADLINE_APPROACHING,
            `${project.name}'s deadline is in ${DEADLINE_LOOKAHEAD_DAYS} days`,
            { projectId: project.id },
            pmAndAdminIdSet.has(userId),
          ),
        ),
      )
    ).some(Boolean);

    // One post for the whole project, not one per recipient, a channel
    // message is shared, unlike the per person in app row/DM above. Only
    // posted if at least one recipient was actually notified this run, so
    // a rerun on the same day (a restart, for example) does not repost.
    if (project.slackChannelId && notifiedAnyone) {
      this.slackService
        .postMessage(
          project.slackChannelId,
          `⏰ *${project.name}*'s deadline is in ${DEADLINE_LOOKAHEAD_DAYS} days.`,
        )
        .catch((error) => {
          this.logger.warn(
            `Failed to post deadline reminder to Slack channel ${project.slackChannelId}: ${error}`,
          );
        });
    }
  }

  private async notifyEachOncePerDay(
    userIds: string[],
    type: NotificationType,
    title: string,
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.notifyOncePerDay(userId, type, title)),
    );
  }

  // Returns whether a notification was actually sent (false when skipped
  // as an already sent today dupe), so callers that also need to know
  // "did anything go out this run" (the Slack channel post above) do not
  // have to re-derive it separately.
  private async notifyOncePerDay(
    userId: string,
    type: NotificationType,
    title: string,
    metadata?: Prisma.InputJsonValue,
    slackDm = false,
  ): Promise<boolean> {
    const alreadySentToday = await this.hasNotifiedToday(userId, type);
    if (alreadySentToday) {
      return false;
    }
    await this.notificationsService.notify({
      userId,
      type,
      title,
      metadata,
      slackDm,
    });
    return true;
  }

  private async hasNotifiedToday(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const todayStart = toDateOnly(new Date());
    const count = await this.prisma.notification.count({
      where: { userId, type, createdAt: { gte: todayStart } },
    });
    return count > 0;
  }

  private isDhakaFriday(): boolean {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      weekday: 'short',
    }).format(new Date());
    return weekday === 'Fri';
  }
}
