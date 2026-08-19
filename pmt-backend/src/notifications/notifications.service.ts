import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Notification,
  NotificationType,
  Prisma,
  ProjectRole,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { SlackService } from '@/slack/slack.service';
import { SlackUserResolverService } from '@/slack/slack-user-resolver.service';
import { QueryNotificationsDto } from '@/notifications/dto/notification.dto';
import {
  NOTIFICATION_TYPE_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

export interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  metadata?: Prisma.InputJsonValue;
  // Only for the specific events the build spec marks "Slack DM": member
  // handover, ready for client, client approved, client changes requested.
  // Never awaited by notify()'s own caller, a Slack outage must never
  // delay or fail an in app notification, same convention every other
  // Slack call site in this codebase already follows.
  slackDm?: boolean;
}

// The one place that writes a Notification row, called explicitly from
// whichever existing service owns the real event (ProjectsService,
// ProjectMembersService, LeaveRequestsService, ...), the same convention
// ProjectActivityService/AuditLogService already use rather than a generic
// request interceptor. Slack project channel delivery is a distinct, later
// phase; this covers only the in app row (always) and an optional Slack DM
// (opted into per call site), see docs/features/notifications/DESIGN.md.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slackService: SlackService,
    private readonly slackUserResolver: SlackUserResolverService,
  ) {}

  async notify(options: NotifyOptions): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: options.userId,
        type: options.type,
        title: options.title,
        message: options.message,
        metadata: options.metadata,
      },
    });

    if (options.slackDm) {
      this.sendSlackDm(options.userId, options.title, options.message).catch(
        (error) => {
          this.logger.warn(
            `Failed to send Slack DM to ${options.userId}: ${error}`,
          );
        },
      );
    }

    return notification;
  }

  // No-ops silently if the user has no resolvable Slack account, the same
  // as every other Slack call site in this codebase. chat.postMessage
  // accepts a Slack user id directly as "channel", opening a DM, no
  // separate Slack API call needed beyond the existing postMessage().
  private async sendSlackDm(
    userId: string,
    title: string,
    message?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, slackUserId: true },
    });
    if (!user) {
      return;
    }
    const slackUserId = await this.slackUserResolver.resolveSlackUserId(user);
    if (!slackUserId) {
      return;
    }
    const text = message ? `*${title}*\n${message}` : `*${title}*`;
    await this.slackService.postMessage(slackUserId, text);
  }

  async findAllForUser(userId: string, query: QueryNotificationsDto) {
    const { page = 1, pageSize = 20, unreadOnly } = query;
    const where = {
      userId,
      ...(unreadOnly && { readAt: null }),
    };

    const result = await paginate(
      (args) =>
        this.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...args,
        }),
      () => this.prisma.notification.count({ where }),
      page,
      pageSize,
    );

    return {
      ...result,
      items: result.items.map((notification) => ({
        ...notification,
        type: toEnumDisplay(NOTIFICATION_TYPE_DISPLAY, notification.type),
      })),
    };
  }

  getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  // Marking an already read notification read again is a harmless no-op,
  // not an error, there is no reason to make a caller check first.
  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.readAt) {
      return notification;
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  // "Admin/System Admin receive every notification a PM receives" is one of
  // the two floor rules in docs/features/notifications/DESIGN.md, and
  // "who currently manages this project" is by far the most repeated
  // recipient question across every phase of this feature, so it lives
  // here once rather than being re-queried by every triggering service.
  // Deduped, since an ADMIN could in theory also hold an active
  // ProjectMember row (unusual, but not impossible), and callers should
  // never have to worry about double notifying the same person.
  async resolveManagingPmAndAdminIds(projectId: string): Promise<string[]> {
    const [managingPms, admins] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: {
          projectId,
          role: ProjectRole.PROJECT_MANAGER,
          leftAt: null,
        },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SYSTEM_ADMIN] },
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    return [
      ...new Set([
        ...managingPms.map((member) => member.userId),
        ...admins.map((admin) => admin.id),
      ]),
    ];
  }

  // The other repeated recipient shape: every currently staffed member of
  // any role (PM, Developer, Designer) plus Admin/System Admin, used by
  // events the build spec says both a managing PM and any staffed
  // Developer/Designer should hear about (a project's status change, a
  // document upload, ...), as opposed to resolveManagingPmAndAdminIds
  // above, which is PM only events.
  async resolveAllActiveMembersAndAdminIds(
    projectId: string,
  ): Promise<string[]> {
    const [activeMembers, admins] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId, leftAt: null },
        select: { userId: true },
      }),
      this.prisma.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SYSTEM_ADMIN] },
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    return [
      ...new Set([
        ...activeMembers.map((member) => member.userId),
        ...admins.map((admin) => admin.id),
      ]),
    ];
  }
}
