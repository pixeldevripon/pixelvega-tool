import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BlockerStatus, NotificationType, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { SlackService } from '@/slack/slack.service';
import { ProjectActivityService } from '@/projects/activity/project-activity.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { DEFAULT_BLOCKER_REASON_NAME } from '@/projects/blockers/reasons/blocker-reasons.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';
import { formatDuration } from '@/common/utils/duration.util';
import {
  BLOCKER_INCLUDE,
  BlockerContext,
  BlockerWithRelations,
  toBlockerResponse,
} from '@/projects/blockers/blocker.mapper';
import {
  AddBlockerDto,
  QueryBlockersDto,
  QueryProjectBlockersDto,
  UpdateBlockerDto,
} from '@/projects/blockers/dto/blocker.dto';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatBullets(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');
}

// This only moves forward. RESOLVED is terminal and never reaches this map
// as a "current" status, since updateBlocker() rejects any edit once a
// blocker is already RESOLVED before this is ever consulted.
const STATUS_ORDER: Record<BlockerStatus, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  RESOLVED: 2,
};

// This lives flat in ProjectsModule, not its own module, so it can share
// the same ProjectActivityService/ProjectMember checks as the rest of the module.
@Injectable()
export class BlockerService {
  private readonly logger = new Logger(BlockerService.name);

  constructor(
    private readonly projectScope: ProjectScopeService,
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
    private readonly slackService: SlackService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async addBlocker(
    projectId: string,
    dto: AddBlockerDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanReport(projectId, actorId, actorRole);
    const reasonId = await this.resolveReasonId(dto.reasonId);

    const blocker = await this.prisma.blocker.create({
      data: {
        projectId,
        description: dto.description,
        severity: dto.severity,
        reportedById: actorId,
        reasonId,
      },
      include: BLOCKER_INCLUDE,
    });

    await this.projectActivity.log(projectId, actorId, 'BLOCKER_ADDED', {
      message: `Blocker reported: "${blocker.description}"`,
      metadata: { blockerId: blocker.id, severity: blocker.severity },
    });

    this.postBlockerAddedToSlack(blocker).catch((error) => {
      this.logger.warn(
        `Failed to post blocker ${blocker.id} to Slack: ${error}`,
      );
    });

    return toBlockerResponse(
      blocker,
      await this.buildBlockerContext(blocker.projectId, actorId, actorRole),
    );
  }

  async updateBlocker(
    projectId: string,
    blockerId: string,
    dto: UpdateBlockerDto,
    actorId: string,
    actorRole: Role,
  ) {
    const blocker = await this.getBlockerOrThrow(projectId, blockerId);

    if (blocker.status === BlockerStatus.RESOLVED) {
      throw new ConflictException(
        'This blocker is already resolved and can no longer be edited',
      );
    }

    await this.assertCanUpdate(blocker, actorId, actorRole);

    if (dto.status) {
      this.assertValidTransition(blocker.status, dto.status);
    }

    if (dto.status === BlockerStatus.RESOLVED && !dto.resolutionNotes) {
      throw new BadRequestException(
        'resolutionNotes is required when resolving a blocker',
      );
    }
    if (
      dto.resolutionNotes !== undefined &&
      dto.status !== BlockerStatus.RESOLVED
    ) {
      throw new BadRequestException(
        'resolutionNotes only applies when resolving a blocker',
      );
    }
    if (
      dto.deadlineExtensionDays !== undefined &&
      dto.status !== BlockerStatus.RESOLVED
    ) {
      throw new BadRequestException(
        'deadlineExtensionDays only applies when resolving a blocker',
      );
    }

    if (dto.reasonId !== undefined) {
      await this.assertReasonExists(dto.reasonId);
    }

    const assignedToId = await this.resolveAssignment(blocker, dto, actorId);
    const isReassigning = assignedToId !== undefined;
    const isResolving = dto.status === BlockerStatus.RESOLVED;

    const updated = await this.prisma.blocker.update({
      where: { id: blockerId },
      data: {
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
        reasonId: dto.reasonId,
        resolutionNotes: dto.resolutionNotes,
        deadlineExtensionDays: dto.deadlineExtensionDays,
        ...(isReassigning && {
          assignedToId,
          assignedAt: new Date(),
        }),
        ...(isResolving && { resolvedAt: new Date(), resolvedById: actorId }),
      },
      include: BLOCKER_INCLUDE,
    });

    if (isResolving && dto.deadlineExtensionDays) {
      await this.applyDeadlineExtension(
        blocker.projectId,
        dto.deadlineExtensionDays,
      );
    }

    if (isReassigning) {
      await this.projectActivity.log(
        blocker.projectId,
        actorId,
        'BLOCKER_ASSIGNED',
        {
          message: `Blocker assigned to ${updated.assignedTo?.name}`,
          metadata: { blockerId, assignedToId },
        },
      );

      // Matches the build spec's exact wording, PM only, not the assignee
      // themselves, who already knows they were just assigned.
      const pmAndAdminIds =
        await this.notificationsService.resolveManagingPmAndAdminIds(
          blocker.projectId,
        );
      await Promise.all(
        pmAndAdminIds
          .filter((recipientId) => recipientId !== actorId)
          .map((recipientId) =>
            this.notificationsService.notify({
              userId: recipientId,
              type: NotificationType.BLOCKER_ASSIGNED,
              title: `Blocker assigned to ${updated.assignedTo?.name}`,
              message: updated.description,
              metadata: { projectId: blocker.projectId, blockerId },
            }),
          ),
      );
    }

    if (dto.status && dto.status !== blocker.status) {
      await this.projectActivity.log(
        blocker.projectId,
        actorId,
        'BLOCKER_STATUS_CHANGED',
        {
          message: `Blocker status changed from ${blocker.status} to ${dto.status}`,
          metadata: {
            blockerId,
            from: blocker.status,
            to: dto.status,
          },
        },
      );

      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { name: true },
      });
      if (actor) {
        this.postBlockerStatusChangedToSlack(
          updated,
          blocker.status,
          actor.name,
        ).catch((error) => {
          this.logger.warn(
            `Failed to post blocker ${blockerId} status change to Slack: ${error}`,
          );
        });
      }
    }

    return toBlockerResponse(
      updated,
      await this.buildBlockerContext(updated.projectId, actorId, actorRole),
    );
  }

  async findAll(query: QueryBlockersDto, actorId: string, actorRole: Role) {
    const {
      page = 1,
      pageSize = 20,
      status,
      severity,
      projectId,
      assignedToId,
    } = query;
    const isStaffScoped =
      actorRole === Role.DEVELOPER || actorRole === Role.DESIGNER;
    const where = {
      ...(status && { status }),
      ...(severity && { severity }),
      ...(projectId && { projectId }),
      ...(assignedToId && { assignedToId }),
      ...(isStaffScoped && {
        project: { members: { some: { userId: actorId, leftAt: null } } },
      }),
    };

    const result = await paginate(
      (args) =>
        this.prisma.blocker.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: BLOCKER_INCLUDE,
          ...args,
        }),
      () => this.prisma.blocker.count({ where }),
      page,
      pageSize,
    );

    const contexts = new Map<string, BlockerContext>();
    for (const item of result.items) {
      if (!contexts.has(item.projectId)) {
        contexts.set(
          item.projectId,
          await this.buildBlockerContext(item.projectId, actorId, actorRole),
        );
      }
    }
    return {
      ...result,
      items: result.items.map((item) =>
        toBlockerResponse(item, contexts.get(item.projectId) as BlockerContext),
      ),
    };
  }

  // Any PROJECT_MANAGER (plus ADMIN/SYSTEM_ADMIN automatically) can view any
  // project's blockers here. Viewing doesn't require being staffed as PM on
  // this project, only editing one does (see assertCanUpdate()).
  // DEVELOPER/DESIGNER, on the other hand, must be an active ProjectMember
  // of this specific project (assertCanRead()).
  async findByProject(
    projectId: string,
    query: QueryProjectBlockersDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    const { page = 1, pageSize = 20, status, severity, assignedToId } = query;
    const where = {
      projectId,
      ...(status && { status }),
      ...(severity && { severity }),
      ...(assignedToId && { assignedToId }),
    };

    const result = await paginate(
      (args) =>
        this.prisma.blocker.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: BLOCKER_INCLUDE,
          ...args,
        }),
      () => this.prisma.blocker.count({ where }),
      page,
      pageSize,
    );

    const contexts = new Map<string, BlockerContext>();
    for (const item of result.items) {
      if (!contexts.has(item.projectId)) {
        contexts.set(
          item.projectId,
          await this.buildBlockerContext(item.projectId, actorId, actorRole),
        );
      }
    }
    return {
      ...result,
      items: result.items.map((item) =>
        toBlockerResponse(item, contexts.get(item.projectId) as BlockerContext),
      ),
    };
  }

  // Answers "how much did blockers cost this project." Computed fresh from
  // existing rows each time, not stored.
  async getDeadlineImpactSummary(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    const resolved = await this.prisma.blocker.findMany({
      where: { projectId, status: BlockerStatus.RESOLVED },
      select: {
        createdAt: true,
        resolvedAt: true,
        deadlineExtensionDays: true,
      },
    });

    const totalResolutionMinutes = resolved.reduce((sum, blocker) => {
      if (!blocker.resolvedAt) {
        return sum;
      }
      return (
        sum +
        Math.round(
          (blocker.resolvedAt.getTime() - blocker.createdAt.getTime()) /
            MS_PER_MINUTE,
        )
      );
    }, 0);

    const blockersWithExtension = resolved.filter(
      (blocker) => (blocker.deadlineExtensionDays ?? 0) > 0,
    ).length;

    const totalDeadlineExtensionDays = resolved.reduce(
      (sum, blocker) => sum + (blocker.deadlineExtensionDays ?? 0),
      0,
    );

    return {
      resolvedCount: resolved.length,
      totalResolutionMinutes,
      totalResolutionLabel: formatDuration(totalResolutionMinutes) as string,
      totalDeadlineExtensionDays,
      blockersWithExtension,
    };
  }

  // resolutionTime (minutes) once resolved, daysOpen while still active, and
  // causedDeadlineExtension once resolved are all derived on read, never
  // stored, so they can't drift out of sync with the underlying dates.

  // Additive on top of the project's current deadline, never an absolute
  // override. A project with no deadline yet extends from today.
  private async applyDeadlineExtension(projectId: string, days: number) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        deadline: new Date(
          (project.deadline?.getTime() ?? Date.now()) + days * MS_PER_DAY,
        ),
      },
    });
  }

  // Returns the new assignedToId when the assignment should change, or
  // undefined when it shouldn't (so callers can tell "no change" apart from
  // "unassign", which this feature doesn't support). An explicit
  // dto.assignedToId always wins; otherwise moving to IN_PROGRESS with no
  // assignee yet assigns the actor automatically.
  private async resolveAssignment(
    blocker: BlockerWithRelations,
    dto: UpdateBlockerDto,
    actorId: string,
  ): Promise<string | undefined> {
    if (dto.assignedToId !== undefined) {
      if (dto.assignedToId === blocker.assignedToId) {
        return undefined;
      }
      await this.assertIsActiveMember(blocker.projectId, dto.assignedToId);
      return dto.assignedToId;
    }

    if (dto.status === BlockerStatus.IN_PROGRESS && !blocker.assignedToId) {
      return actorId;
    }

    return undefined;
  }

  // Falls back to the seeded "Unspecified" reason when the caller doesn't
  // pass one.
  private async resolveReasonId(reasonId?: string): Promise<string> {
    if (reasonId) {
      await this.assertReasonExists(reasonId);
      return reasonId;
    }

    const defaultReason = await this.prisma.blockerReason.findFirst({
      where: { name: DEFAULT_BLOCKER_REASON_NAME, deletedAt: null },
    });
    if (!defaultReason) {
      throw new NotFoundException(
        'Default blocker reason is missing; specify a reasonId',
      );
    }
    return defaultReason.id;
  }

  private async assertReasonExists(reasonId: string): Promise<void> {
    const reason = await this.prisma.blockerReason.findFirst({
      where: { id: reasonId, deletedAt: null },
    });
    if (!reason) {
      throw new NotFoundException('Blocker reason not found');
    }
  }

  // A blocker list can span projects, so the context is cached per project id
  // rather than recomputed per row: two queries per distinct project, not two
  // per blocker.
  private async buildBlockerContext(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ): Promise<BlockerContext> {
    const [managesProject, isProjectMember] = await Promise.all([
      this.projectScope.managesProject(projectId, actorId, actorRole),
      this.projectScope.isActiveMember(projectId, actorId),
    ]);
    return { callerId: actorId, managesProject, isProjectMember };
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

  /**
   * Scoped by BOTH ids, not just the blocker's.
   *
   * The route is `/projects/:projectId/blockers/:blockerId`, so a blocker that
   * belongs to a different project is a 404 rather than a silent success. A
   * lookup on the blocker id alone would make the project segment decorative:
   * any project id in the path would edit any blocker, and a client that mixed
   * two ids up would never find out.
   */
  private async getBlockerOrThrow(projectId: string, blockerId: string) {
    const blocker = await this.prisma.blocker.findFirst({
      where: { id: blockerId, projectId },
      include: BLOCKER_INCLUDE,
    });
    if (!blocker) {
      throw new NotFoundException('Blocker not found');
    }
    return blocker;
  }

  private assertValidTransition(current: BlockerStatus, next: BlockerStatus) {
    if (STATUS_ORDER[next] < STATUS_ORDER[current]) {
      throw new ConflictException(
        `Cannot move a blocker backward from ${current} to ${next}`,
      );
    }
  }

  // Only the person who reported it, a PROJECT_MANAGER of that project, or
  // ADMIN/SYSTEM_ADMIN may update it. The reporter's own membership is
  // checked again here too, not just at report time. If they've since left
  // the project, reporting it once doesn't grant a standing right to keep
  // editing it.
  private async assertCanUpdate(
    blocker: BlockerWithRelations,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      return;
    }
    if (blocker.reportedById === actorId) {
      await this.assertIsActiveMember(blocker.projectId, actorId);
      return;
    }
    await this.projectScope.assertManagesProject(
      blocker.projectId,
      actorId,
      actorRole,
    );
  }

  // Reporting requires being an active member of the target project in any
  // role (DEVELOPER/DESIGNER/PROJECT_MANAGER alike). Unlike reads, PM does
  // NOT get a bypass for every project here, only ADMIN/SYSTEM_ADMIN do.
  private async assertCanReport(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      return;
    }
    await this.assertIsActiveMember(projectId, actorId);
  }

  private async assertCanRead(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER) {
      return;
    }
    await this.assertIsActiveMember(projectId, actorId);
  }

  // Membership required of every role, admins included: reporting or editing a
  // blocker means being staffed on the project, full stop.
  //
  // Built on ProjectScopeService's shared `isActiveMember` predicate rather
  // than on a private query of its own, which is what this was: the thirteenth
  // copy of the twelve that service was created to replace.
  //
  // Deliberately NOT `assertStaffedOnProject`, which also checks the project
  // exists. Every caller here has already called `getProjectOrThrow`, so that
  // would be a second round trip to the same row on the hot path of every
  // blocker read and write.
  private async assertIsActiveMember(projectId: string, actorId: string) {
    if (!(await this.projectScope.isActiveMember(projectId, actorId))) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }
  }

  // No ts is stored for blocker posts. Each status change is its own new
  // Slack message, not an edit of the previous one.
  private async postBlockerAddedToSlack(
    blocker: BlockerWithRelations,
  ): Promise<void> {
    if (!blocker.project.slackChannelId) {
      return;
    }
    const header = `*${blocker.reportedBy.name} — Blocker Reported (${blocker.severity}) (${formatDateOnly(blocker.createdAt)})*`;
    const text = `${header}\n\n${formatBullets(blocker.description)}`;
    await this.slackService.postMessage(blocker.project.slackChannelId, text);
  }

  private async postBlockerStatusChangedToSlack(
    blocker: BlockerWithRelations,
    previousStatus: BlockerStatus,
    actorName: string,
  ): Promise<void> {
    if (!blocker.project.slackChannelId) {
      return;
    }
    const isResolved = blocker.status === BlockerStatus.RESOLVED;
    const header = `*${actorName} — Blocker ${isResolved ? 'Resolved' : 'Status Update'} (${formatDateOnly(blocker.updatedAt)})*`;
    const statusLine = `${previousStatus} → ${blocker.status}`;
    const assigneeLine = blocker.assignedTo
      ? `\nAssigned to: ${blocker.assignedTo.name}`
      : '';
    const resolutionSection =
      isResolved && blocker.resolutionNotes
        ? `\n\n*Resolution:*\n${formatBullets(blocker.resolutionNotes)}`
        : '';
    const text = `${header}\n${statusLine}${assigneeLine}\n\n${formatBullets(blocker.description)}${resolutionSection}`;
    await this.slackService.postMessage(blocker.project.slackChannelId, text);
  }
}
