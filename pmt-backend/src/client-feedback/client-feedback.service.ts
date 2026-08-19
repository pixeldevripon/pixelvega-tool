import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientFeedbackDecision,
  NotificationType,
  ProjectRole,
  ProjectStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { CreateClientFeedbackDto } from '@/client-feedback/dto/create-client-feedback.dto';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

const FEEDBACK_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  recordedBy: { select: { id: true, name: true, email: true } },
};

const NEXT_STATUS_BY_DECISION: Record<ClientFeedbackDecision, ProjectStatus> = {
  APPROVED: ProjectStatus.COMPLETED,
  CHANGES_REQUESTED: ProjectStatus.READY_FOR_WORK,
};

@Injectable()
export class ClientFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    projectId: string,
    query: PaginationQueryDto,
    actorId: string,
    actorRole: Role,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    await this.assertCanRead(project, actorId, actorRole);

    const { page = 1, pageSize = 20 } = query;
    const where = { projectId };

    return paginate(
      (args) =>
        this.prisma.clientFeedback.findMany({
          where,
          orderBy: { feedbackRound: 'asc' },
          include: FEEDBACK_INCLUDE,
          ...args,
        }),
      () => this.prisma.clientFeedback.count({ where }),
      page,
      pageSize,
    );
  }

  // Only the first round for a project moves project.status (APPROVED ->
  // COMPLETED, CHANGES_REQUESTED -> READY_FOR_WORK). Every later round is
  // commentary-only: it's accepted regardless of the project's current
  // status (blocked only once COMPLETED/CANCELLED) but never touches
  // project.status again, so a developer actively IN_PROGRESS on the first
  // round's decision is never interrupted by later client input.
  async create(
    projectId: string,
    dto: CreateClientFeedbackDto,
    actorId: string,
    actorRole: Role,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    await this.assertCanSubmit(project, actorId, actorRole);

    if (
      dto.decision === ClientFeedbackDecision.CHANGES_REQUESTED &&
      !dto.comments
    ) {
      throw new BadRequestException(
        'comments are required when requesting changes',
      );
    }

    const existingCount = await this.prisma.clientFeedback.count({
      where: { projectId },
    });
    const isFirstRound = existingCount === 0;

    if (isFirstRound && project.status !== ProjectStatus.WAITING_FOR_FEEDBACK) {
      throw new ConflictException(
        'This project is not currently waiting for client feedback',
      );
    }
    if (
      !isFirstRound &&
      (project.status === ProjectStatus.COMPLETED ||
        project.status === ProjectStatus.CANCELLED)
    ) {
      throw new ConflictException('This project is already closed');
    }

    const feedback = await this.prisma.clientFeedback.create({
      data: {
        projectId,
        clientId: project.clientId,
        recordedById: actorRole === Role.CLIENT ? null : actorId,
        decision: dto.decision,
        comments: dto.comments,
        feedbackRound: existingCount + 1,
      },
      include: FEEDBACK_INCLUDE,
    });

    await this.projectActivity.log(
      projectId,
      actorId,
      'CLIENT_FEEDBACK_RECEIVED',
      {
        message: `Client feedback round ${feedback.feedbackRound}: ${dto.decision}`,
        metadata: {
          feedbackRound: feedback.feedbackRound,
          decision: dto.decision,
          comments: dto.comments,
        },
      },
    );

    if (isFirstRound) {
      const nextStatus = NEXT_STATUS_BY_DECISION[dto.decision];
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: nextStatus,
          ...(nextStatus === ProjectStatus.COMPLETED && {
            completedAt: new Date(),
          }),
        },
      });
      await this.projectActivity.log(projectId, actorId, 'STATUS_CHANGED', {
        metadata: { from: project.status, to: nextStatus },
      });
    }

    // Both PM and staffed Developer/Designer, every round, not just the
    // first, "a client approves a delivery" is a general statement in the
    // build spec, not restricted to round 1. Only the PM/Admin subset gets
    // a Slack DM though, the build spec marks this "(in-app, Slack DM)" on
    // the PM side but only "(in-app)" on the Developer side.
    const [recipientIds, pmAndAdminIds] = await Promise.all([
      this.notificationsService.resolveAllActiveMembersAndAdminIds(projectId),
      this.notificationsService.resolveManagingPmAndAdminIds(projectId),
    ]);
    const pmAndAdminIdSet = new Set(pmAndAdminIds);
    const otherRecipientIds = recipientIds.filter(
      (recipientId) => recipientId !== actorId,
    );
    const feedbackType =
      dto.decision === ClientFeedbackDecision.APPROVED
        ? NotificationType.CLIENT_FEEDBACK_APPROVED
        : NotificationType.CLIENT_FEEDBACK_CHANGES_REQUESTED;
    await Promise.all(
      otherRecipientIds.map((recipientId) =>
        this.notificationsService.notify({
          userId: recipientId,
          type: feedbackType,
          title:
            dto.decision === ClientFeedbackDecision.APPROVED
              ? 'Client approved a delivery'
              : 'Client requested changes on a delivery',
          message: dto.comments,
          metadata: { projectId, feedbackRound: feedback.feedbackRound },
          slackDm: pmAndAdminIdSet.has(recipientId),
        }),
      ),
    );

    // Only the first round's APPROVED decision actually moves the project
    // to COMPLETED, a separate, additional fact worth its own notification
    // on top of the "client approved" one above, not a replacement for it.
    if (isFirstRound && dto.decision === ClientFeedbackDecision.APPROVED) {
      await Promise.all(
        otherRecipientIds.map((recipientId) =>
          this.notificationsService.notify({
            userId: recipientId,
            type: NotificationType.PROJECT_AUTO_COMPLETED,
            title: 'Project automatically marked Completed',
            metadata: { projectId },
          }),
        ),
      );
    }

    return feedback;
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

  // PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN read company-wide, DEVELOPER/DESIGNER
  // must be an active ProjectMember, and CLIENT must be this project's own
  // client — the one read-scope difference from Internal Review, which
  // excludes CLIENT entirely.
  private async assertCanRead(
    project: { id: string; clientId: string },
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.CLIENT) {
      if (project.clientId !== actorId) {
        throw new ForbiddenException('You do not have access to this project');
      }
      return;
    }
    if (actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER) {
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: actorId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }
  }

  // CLIENT must be this project's own client; PROJECT_MANAGER must be
  // actively staffed as PM on this specific project; ADMIN/SYSTEM_ADMIN are
  // unrestricted. DEVELOPER/DESIGNER never reach this — excluded at the
  // controller's @Roles level.
  private async assertCanSubmit(
    project: { id: string; clientId: string },
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      return;
    }
    if (actorRole === Role.CLIENT) {
      if (project.clientId !== actorId) {
        throw new ForbiddenException('You do not have access to this project');
      }
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId: project.id,
        userId: actorId,
        role: ProjectRole.PROJECT_MANAGER,
        leftAt: null,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You do not manage this project');
    }
  }
}
