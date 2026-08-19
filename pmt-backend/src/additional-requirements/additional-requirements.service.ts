import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdditionalRequirementStatus,
  AiJobType,
  NotificationType,
  ProjectRole,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { ProjectActivityService } from '@/projects/project-activity.service';
import { AiJobsService } from '@/ai/ai-jobs.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { CreateAdditionalRequirementDto } from '@/additional-requirements/dto/create-additional-requirement.dto';
import { ReviewAdditionalRequirementDto } from '@/additional-requirements/dto/review-additional-requirement.dto';
import { QueryAdditionalRequirementsDto } from '@/additional-requirements/dto/query-additional-requirements.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const REQUIREMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class AdditionalRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
    private readonly aiJobsService: AiJobsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    projectId: string,
    query: QueryAdditionalRequirementsDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    const { page = 1, pageSize = 20, status } = query;
    const where = { projectId, ...(status && { status }) };

    return paginate(
      (args) =>
        this.prisma.additionalRequirement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: REQUIREMENT_INCLUDE,
          ...args,
        }),
      () => this.prisma.additionalRequirement.count({ where }),
      page,
      pageSize,
    );
  }

  async findOne(
    projectId: string,
    id: string,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    return this.getRequirementOrThrow(projectId, id);
  }

  async create(
    projectId: string,
    dto: CreateAdditionalRequirementDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertManagesProject(projectId, actorId, actorRole);

    const requirement = await this.prisma.additionalRequirement.create({
      data: {
        projectId,
        description: dto.description,
        sourceChannel: dto.sourceChannel,
        uploadedById: actorId,
      },
      include: REQUIREMENT_INCLUDE,
    });

    await this.projectActivity.log(
      projectId,
      actorId,
      'ADDITIONAL_REQUIREMENT_ADDED',
      {
        message: `Additional requirement added: "${requirement.description}"`,
        metadata: { additionalRequirementId: requirement.id },
      },
    );

    await this.notifyManagingPms(
      projectId,
      actorId,
      NotificationType.ADDITIONAL_REQUIREMENT_SUBMITTED,
      'A new additional requirement was submitted',
      requirement.description,
      { additionalRequirementId: requirement.id },
    );

    return requirement;
  }

  // Approving is additive on top of the project's current
  // estimatedHours/deadline, never an absolute override. A project with no
  // deadline yet extends from today rather than failing outright.
  async review(
    projectId: string,
    id: string,
    dto: ReviewAdditionalRequirementDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getRequirementOrThrow(projectId, id);

    if (existing.status !== AdditionalRequirementStatus.PENDING_REVIEW) {
      throw new ConflictException(
        'This additional requirement has already been reviewed',
      );
    }

    await this.assertManagesProject(projectId, actorId, actorRole);

    if (
      dto.decision === AdditionalRequirementStatus.REJECTED &&
      (dto.approvedAdditionalHours !== undefined ||
        dto.deadlineExtensionDays !== undefined)
    ) {
      throw new BadRequestException(
        'approvedAdditionalHours/deadlineExtensionDays only apply when approving',
      );
    }

    const updated = await this.prisma.additionalRequirement.update({
      where: { id },
      data: {
        status: dto.decision,
        reviewedById: actorId,
        reviewedAt: new Date(),
        approvedAdditionalHours: dto.approvedAdditionalHours,
        deadlineExtensionDays: dto.deadlineExtensionDays,
      },
      include: REQUIREMENT_INCLUDE,
    });

    if (dto.decision === AdditionalRequirementStatus.APPROVED) {
      await this.applyApprovedChanges(projectId, dto);
    }

    await this.projectActivity.log(
      projectId,
      actorId,
      'ADDITIONAL_REQUIREMENT_REVIEWED',
      {
        message: `Additional requirement ${dto.decision.toLowerCase()}`,
        metadata: {
          additionalRequirementId: id,
          decision: dto.decision,
          approvedAdditionalHours: dto.approvedAdditionalHours,
          deadlineExtensionDays: dto.deadlineExtensionDays,
        },
      },
    );

    await this.notifyManagingPms(
      projectId,
      actorId,
      dto.decision === AdditionalRequirementStatus.APPROVED
        ? NotificationType.ADDITIONAL_REQUIREMENT_APPROVED
        : NotificationType.ADDITIONAL_REQUIREMENT_REJECTED,
      `Additional requirement ${dto.decision.toLowerCase()}`,
      existing.description,
      { additionalRequirementId: id },
    );

    // Both PM and staffed Developer/Designer, but only when the approval
    // actually changed something, an APPROVED decision with neither field
    // set is a no-op on the project, nothing to notify about.
    if (
      dto.decision === AdditionalRequirementStatus.APPROVED &&
      (dto.approvedAdditionalHours !== undefined ||
        dto.deadlineExtensionDays !== undefined)
    ) {
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
              type: NotificationType.ADDITIONAL_REQUIREMENT_HOURS_OR_DEADLINE_CHANGED,
              title:
                "An approved requirement changed this project's hours or deadline",
              metadata: {
                projectId,
                additionalRequirementId: id,
                approvedAdditionalHours: dto.approvedAdditionalHours,
                deadlineExtensionDays: dto.deadlineExtensionDays,
              },
            }),
          ),
      );
    }

    return updated;
  }

  // On demand only, never automatic, AdditionalRequirementsService.create()
  // above deliberately does not enqueue anything itself. Callable regardless
  // of the requirement's current status, calling it again just overwrites
  // aiScopeAnalysis with a fresh result, it is advisory context, not an
  // append only history table.
  async checkScope(
    projectId: string,
    id: string,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getRequirementOrThrow(projectId, id);
    await this.assertManagesProject(projectId, actorId, actorRole);

    const job = await this.aiJobsService.enqueue(AiJobType.CHECK_SCOPE, {
      projectId,
      requestedById: actorId,
      input: { requirementId: id },
    });
    return { jobId: job.id };
  }

  private async applyApprovedChanges(
    projectId: string,
    dto: ReviewAdditionalRequirementDto,
  ) {
    if (
      dto.approvedAdditionalHours === undefined &&
      dto.deadlineExtensionDays === undefined
    ) {
      return;
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.approvedAdditionalHours !== undefined && {
          estimatedHours:
            (project.estimatedHours ?? 0) + dto.approvedAdditionalHours,
        }),
        ...(dto.deadlineExtensionDays !== undefined && {
          deadline: new Date(
            (project.deadline?.getTime() ?? Date.now()) +
              dto.deadlineExtensionDays * MS_PER_DAY,
          ),
        }),
      },
    });
  }

  // Shared by create()/review() above: every notification type this
  // service produces (SUBMITTED/APPROVED/REJECTED) is PM only, matching
  // the build spec's exact wording, no Developer/Designer bullet exists
  // for any of the three.
  private async notifyManagingPms(
    projectId: string,
    actorId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const recipientIds =
      await this.notificationsService.resolveManagingPmAndAdminIds(projectId);
    await Promise.all(
      recipientIds
        .filter((recipientId) => recipientId !== actorId)
        .map((recipientId) =>
          this.notificationsService.notify({
            userId: recipientId,
            type,
            title,
            message,
            metadata: { projectId, ...metadata },
          }),
        ),
    );
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

  private async getRequirementOrThrow(projectId: string, id: string) {
    const requirement = await this.prisma.additionalRequirement.findFirst({
      where: { id, projectId },
      include: REQUIREMENT_INCLUDE,
    });
    if (!requirement) {
      throw new NotFoundException('Additional requirement not found');
    }
    return requirement;
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
