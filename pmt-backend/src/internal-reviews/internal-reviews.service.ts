import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InternalReviewDecision,
  NotificationType,
  ProjectRole,
  ProjectStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { CreateInternalReviewDto } from '@/internal-reviews/dto/create-internal-review.dto';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

const REVIEW_INCLUDE = {
  reviewedBy: { select: { id: true, name: true, email: true } },
};

const NEXT_STATUS_BY_DECISION: Record<InternalReviewDecision, ProjectStatus> = {
  APPROVED: ProjectStatus.READY_FOR_CLIENT,
  CHANGES_REQUIRED: ProjectStatus.READY_FOR_WORK,
};

@Injectable()
export class InternalReviewsService {
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
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    const { page = 1, pageSize = 20 } = query;
    const where = { projectId };

    return paginate(
      (args) =>
        this.prisma.projectInternalReview.findMany({
          where,
          orderBy: { reviewRound: 'asc' },
          include: REVIEW_INCLUDE,
          ...args,
        }),
      () => this.prisma.projectInternalReview.count({ where }),
      page,
      pageSize,
    );
  }

  // A PM reviewing work submitted for INTERNAL_REVIEW. APPROVED moves the
  // project on to READY_FOR_CLIENT, CHANGES_REQUIRED sends it back to
  // READY_FOR_WORK for another pass. This is the only path that can make
  // either transition. The generic PATCH /projects/:id/status no longer
  // allows them, so a review record always exists for both.
  async create(
    projectId: string,
    dto: CreateInternalReviewDto,
    actorId: string,
    actorRole: Role,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    await this.assertManagesProject(projectId, actorId, actorRole);

    if (project.status !== ProjectStatus.INTERNAL_REVIEW) {
      throw new ConflictException(
        'This project is not currently in internal review',
      );
    }
    if (
      dto.decision === InternalReviewDecision.CHANGES_REQUIRED &&
      !dto.comments
    ) {
      throw new BadRequestException(
        'comments are required when requesting changes',
      );
    }

    const reviewRound =
      (await this.prisma.projectInternalReview.count({
        where: { projectId },
      })) + 1;

    const review = await this.prisma.projectInternalReview.create({
      data: {
        projectId,
        reviewedById: actorId,
        decision: dto.decision,
        comments: dto.comments,
        reviewRound,
      },
      include: REVIEW_INCLUDE,
    });

    const nextStatus = NEXT_STATUS_BY_DECISION[dto.decision];
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: nextStatus },
    });

    await this.projectActivity.log(
      projectId,
      actorId,
      'INTERNAL_FEEDBACK_RECEIVED',
      {
        message: `Internal review round ${reviewRound}: ${dto.decision}`,
        metadata: {
          reviewRound,
          decision: dto.decision,
          comments: dto.comments,
        },
      },
    );
    await this.projectActivity.log(projectId, actorId, 'STATUS_CHANGED', {
      metadata: { from: ProjectStatus.INTERNAL_REVIEW, to: nextStatus },
    });

    if (dto.decision === InternalReviewDecision.APPROVED) {
      // Build spec only gives PM this one, no Developer/Designer bullet.
      const pmAndAdminIds =
        await this.notificationsService.resolveManagingPmAndAdminIds(projectId);
      await Promise.all(
        pmAndAdminIds
          .filter((recipientId) => recipientId !== actorId)
          .map((recipientId) =>
            this.notificationsService.notify({
              userId: recipientId,
              type: NotificationType.PROJECT_READY_FOR_CLIENT,
              title: `A project is ready for the client`,
              metadata: { projectId, reviewRound },
              slackDm: true,
            }),
          ),
      );
    } else {
      // Both PM and staffed Developer/Designer get this one.
      const recipientIds =
        await this.notificationsService.resolveAllActiveMembersAndAdminIds(
          projectId,
        );
      await Promise.all(
        recipientIds
          .filter((recipientId) => recipientId !== actorId)
          .map((recipientId) =>
            this.notificationsService.notify({
              userId: recipientId,
              type: NotificationType.INTERNAL_REVIEW_CHANGES_REQUIRED,
              title: `Internal review requested changes`,
              message: dto.comments,
              metadata: { projectId, reviewRound },
            }),
          ),
      );
    }

    return review;
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

  // CLIENT never reaches here; it's excluded at the controller's @Roles level.
  private async assertCanRead(
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

  private async assertManagesProject(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
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
