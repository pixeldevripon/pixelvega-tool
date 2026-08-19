import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  ProjectPriority,
  ProjectRole,
  ProjectStatus,
  ProjectType,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { SlackService } from '@/slack/slack.service';
import { SlackUserResolverService } from '@/slack/slack-user-resolver.service';
import { buildChannelName } from '@/slack/slack-channel-naming.util';
import { NotificationsService } from '@/notifications/notifications.service';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { ProjectScopeService } from '@/project-scope/project-scope.service';
import { PermissionsService } from '@/auth/permissions/permissions.service';
import {
  ProjectContext,
  toClientProjectResponse,
  toProjectActivityResponse,
  toProjectResponse,
} from '@/projects/project.mapper';
import { RECOMMENDED_MAX_ACTIVE_PROJECTS } from './workload.constants';
import {
  ConnectSlackChannelDto,
  CreateProjectDto,
  QueryMyProjectsDto,
  QueryProjectsDto,
  UpdateEstimatedHoursDto,
  UpdateProjectDto,
  UpdateProjectPriorityDto,
  UpdateProjectStatusDto,
  UpdateProjectTypesDto,
} from '@/projects/dto/project.dto';

// Sequence validation only. Who is allowed to trigger a given transition is
// checked separately, in assertCanChangeStatus() below.
export const ALLOWED_STATUS_TRANSITIONS: Record<
  ProjectStatus,
  ProjectStatus[]
> = {
  PLANNING: ['SCHEDULED', 'READY_FOR_WORK', 'CANCELLED'],
  SCHEDULED: ['READY_FOR_WORK', 'CANCELLED'],
  READY_FOR_WORK: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'INTERNAL_REVIEW', 'CANCELLED'],
  ON_HOLD: ['READY_FOR_WORK', 'CANCELLED'],
  // READY_FOR_CLIENT/READY_FOR_WORK are deliberately not reachable from
  // here. Only InternalReviewsService.create() can make either move, so a
  // ProjectInternalReview record always exists for both.
  INTERNAL_REVIEW: ['CANCELLED'],
  READY_FOR_CLIENT: ['WAITING_FOR_FEEDBACK', 'CANCELLED'],
  // COMPLETED/READY_FOR_WORK are deliberately not reachable from here either,
  // same reasoning as INTERNAL_REVIEW above: only
  // ClientFeedbackService.create()'s first round can make either move, so a
  // ClientFeedback record always exists to explain how a project left
  // WAITING_FOR_FEEDBACK.
  WAITING_FOR_FEEDBACK: ['CANCELLED'],
  // READY_FOR_WORK here is the same-day "undo a mistake" path, ADMIN/
  // SYSTEM_ADMIN only (see updateStatus() below) and only while the project
  // hasn't been archived yet. Once archived, restore() is the only way back.
  COMPLETED: ['READY_FOR_WORK'],
  CANCELLED: ['READY_FOR_WORK'],
};

const PROJECT_INCLUDE = {
  projectTypeTags: true,
  client: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
};

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_INCLUDE;
}>;

// What a CLIENT sees for their own project. Deliberately excludes internal
// fields like priority, rushReason, onHoldReason, cancellationReason, and
// who created/manages the project.
const CLIENT_PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  plannedStartDate: true,
  deadline: true,
  completedAt: true,
  createdAt: true,
  projectTypeTags: { select: { type: true } },
};

// Projects with an active status ("Ready For Work", "In Progress") sort
// first on a staff member's dashboard; everything else sorts after.
export const DASHBOARD_ACTIVE_STATUSES: ProjectStatus[] = [
  ProjectStatus.READY_FOR_WORK,
  ProjectStatus.IN_PROGRESS,
];

export const PRIORITY_RANK: Record<ProjectPriority, number> = {
  CRITICAL: 0,
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

export function compareNullableDates(a: Date | null, b: Date | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // nulls sort last
  if (b === null) return -1;
  return a.getTime() - b.getTime();
}

// Sort order: active status first, then Priority, then Deadline, then
// Planned Start Date, all ascending (most urgent/soonest first).
export function compareForDashboard(
  a: ProjectWithRelations,
  b: ProjectWithRelations,
): number {
  const aActive = DASHBOARD_ACTIVE_STATUSES.includes(a.status) ? 0 : 1;
  const bActive = DASHBOARD_ACTIVE_STATUSES.includes(b.status) ? 0 : 1;
  if (aActive !== bActive) return aActive - bActive;

  const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDiff !== 0) return priorityDiff;

  const deadlineDiff = compareNullableDates(a.deadline, b.deadline);
  if (deadlineDiff !== 0) return deadlineDiff;

  return compareNullableDates(a.plannedStartDate, b.plannedStartDate);
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly projectScope: ProjectScopeService,
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
    private readonly slackService: SlackService,
    private readonly slackUserResolver: SlackUserResolverService,
    private readonly notificationsService: NotificationsService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(dto: CreateProjectDto, actorId: string, actorRole: Role) {
    const client = await this.prisma.user.findFirst({
      where: { id: dto.clientId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    if (client.role !== Role.CLIENT) {
      throw new BadRequestException('clientId must reference a CLIENT user');
    }

    const projectTypes = [...new Set(dto.projectTypes)];

    // Always created in PLANNING with no team assigned yet; it moves to
    // SCHEDULED/READY_FOR_WORK automatically once both a Project Manager and
    // a Developer or Designer are staffed on it.
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        clientId: dto.clientId,
        createdById: actorId,
        plannedStartDate: dto.plannedStartDate
          ? new Date(dto.plannedStartDate)
          : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        projectTypeTags: {
          createMany: { data: projectTypes.map((type) => ({ type })) },
        },
      },
      include: PROJECT_INCLUDE,
    });

    await this.projectActivity.log(project.id, actorId, 'PROJECT_CREATED', {
      message: `Project "${project.name}" created`,
      metadata: { clientId: dto.clientId, projectTypes },
    });

    // Writes on a project require being staffed as PM on it, so the creator
    // is staffed automatically here. Otherwise they'd be locked out of the
    // project they just created. ADMIN/SYSTEM_ADMIN skip this: they already have
    // unscoped access and don't hold the PROJECT_MANAGER global role a
    // ProjectMember row requires.
    if (actorRole === Role.PROJECT_MANAGER) {
      await this.prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: actorId,
          role: ProjectRole.PROJECT_MANAGER,
        },
      });
      await this.projectActivity.log(project.id, actorId, 'MEMBER_JOINED', {
        message: 'Project creator auto-staffed as Project Manager',
        metadata: { userId: actorId, role: ProjectRole.PROJECT_MANAGER },
      });
    }

    // Never awaited on purpose, so a Slack outage can never fail project
    // creation. Every failure inside is caught and logged, not thrown again.
    this.syncSlackChannelForNewProject(
      project.id,
      project.name,
      projectTypes,
      actorId,
      actorRole,
    ).catch((error) => {
      this.logger.warn(
        `Failed to set up Slack channel for project ${project.id}: ${error}`,
      );
    });

    // Other PMs and Admin/System Admin learning a new project exists, not
    // the creator notifying themselves, they already know. See "Whether
    // PROJECT_CREATED means the creating PM notifying themselves" in
    // docs/features/notifications/DESIGN.md's open questions, resolved.
    const otherPmsAndAdmins = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.PROJECT_MANAGER, Role.ADMIN, Role.SYSTEM_ADMIN] },
        deletedAt: null,
        id: { not: actorId },
      },
      select: { id: true },
    });
    await Promise.all(
      otherPmsAndAdmins.map((recipient) =>
        this.notificationsService.notify({
          userId: recipient.id,
          type: NotificationType.PROJECT_CREATED,
          title: `New project created: ${project.name}`,
          message: `A new project, "${project.name}", was created.`,
          metadata: { projectId: project.id },
        }),
      ),
    );

    return project;
  }

  // This runs once, when the project is created. It does not keep the
  // channel members in sync later.
  private async syncSlackChannelForNewProject(
    projectId: string,
    projectName: string,
    projectTypes: ProjectType[],
    creatorId: string,
    creatorRole: Role,
  ): Promise<void> {
    const channelName = buildChannelName(projectTypes, projectName);
    const slackChannelId =
      await this.slackService.createProjectChannel(channelName);
    if (!slackChannelId) {
      return;
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { slackChannelId },
    });

    if (creatorRole === Role.PROJECT_MANAGER) {
      const creator = await this.prisma.user.findUnique({
        where: { id: creatorId },
        select: { id: true, email: true, slackUserId: true },
      });
      if (creator) {
        const creatorSlackId =
          await this.slackUserResolver.resolveSlackUserId(creator);
        if (creatorSlackId) {
          await this.slackService.inviteToChannel(
            slackChannelId,
            creatorSlackId,
          );
        }
      }
    }

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SYSTEM_ADMIN] }, deletedAt: null },
      select: { id: true, email: true, slackUserId: true },
    });
    for (const admin of admins) {
      const adminSlackId =
        await this.slackUserResolver.resolveSlackUserId(admin);
      if (adminSlackId) {
        await this.slackService.inviteToChannel(slackChannelId, adminSlackId);
      }
    }
  }

  async findAll(query: QueryProjectsDto, actorId: string, actorRole: Role) {
    const {
      page = 1,
      pageSize = 20,
      status,
      priority,
      clientId,
      projectTypes,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      archived = false,
      search,
    } = query;
    const where: Prisma.ProjectWhereInput = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(clientId && { clientId }),
      ...(projectTypes &&
        projectTypes.length > 0 && {
          projectTypeTags: { some: { type: { in: projectTypes } } },
        }),
      archivedAt: archived ? { not: null } : null,
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    };

    const result = await paginate(
      (args) =>
        this.prisma.project.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          include: PROJECT_INCLUDE,
          ...args,
        }),
      () => this.prisma.project.count({ where }),
      page,
      pageSize,
    );
    const contexts = await this.buildProjectContexts(
      result.items.map((item) => item.id),
      actorId,
      actorRole,
    );
    return {
      ...result,
      items: result.items.map((item) =>
        toProjectResponse(item, contexts.get(item.id) as ProjectContext),
      ),
    };
  }

  // CLIENT sees only their own project, with a reduced field set. Staff
  // (PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN) see any project. DEVELOPER/DESIGNER
  // see any project they're an active member of.
  async findOne(id: string, actorId: string, actorRole: Role) {
    if (actorRole === Role.CLIENT) {
      const project = await this.prisma.project.findFirst({
        where: { id, clientId: actorId },
        select: CLIENT_PROJECT_SELECT,
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      return toClientProjectResponse(project);
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: PROJECT_INCLUDE,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.projectScope.assertActiveMember(id, actorId, actorRole);
    return toProjectResponse(
      project,
      await this.buildProjectContext(id, actorId, actorRole),
    );
  }

  // Staff only, no CLIENT. The activity timeline includes internal events
  // (priority changes, internal reviews, etc.) that aren't part of the
  // Client facing "status only" view.
  async findActivities(
    id: string,
    query: PaginationQueryDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(id);
    await this.projectScope.assertActiveMember(id, actorId, actorRole);

    const { page = 1, pageSize = 20 } = query;
    const where = { projectId: id };

    const result = await paginate(
      (args) =>
        this.prisma.projectActivity.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
          ...args,
        }),
      () => this.prisma.projectActivity.count({ where }),
      page,
      pageSize,
    );

    return {
      ...result,
      items: result.items.map(toProjectActivityResponse),
    };
  }

  // The Developer/Designer Dashboard (staff) and "my projects" (CLIENT) in
  // one endpoint. Scope and ordering differ by the caller's role.
  async findMine(actorId: string, actorRole: Role, query: QueryMyProjectsDto) {
    if (actorRole === Role.CLIENT) {
      const { page = 1, pageSize = 20 } = query;
      const where = { clientId: actorId };
      const clientResult = await paginate(
        (args) =>
          this.prisma.project.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: CLIENT_PROJECT_SELECT,
            ...args,
          }),
        () => this.prisma.project.count({ where }),
        page,
        pageSize,
      );
      return {
        ...clientResult,
        items: clientResult.items.map(toClientProjectResponse),
      };
    }

    // PROJECT_MANAGER/DEVELOPER/DESIGNER (and ADMIN/SYSTEM_ADMIN, who will
    // just get an empty list here unless they also happen to hold a
    // membership, since they already have full access via GET /projects).
    return this.findByActiveMembership(actorId, actorRole, query);
  }

  // Lets a PM/ADMIN check "how many projects is this person already on"
  // before assigning new work. Same logic as findMine()'s staff branch,
  // just for a chosen userId instead of the caller.
  async findForUser(userId: string, query: QueryMyProjectsDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.findByActiveMembership(userId, user.role, query);
  }

  private async findByActiveMembership(
    userId: string,
    role: Role,
    query: QueryMyProjectsDto,
  ) {
    const { page = 1, pageSize = 20, archived = false } = query;

    const projects = await this.prisma.project.findMany({
      where: {
        members: { some: { userId, leftAt: null } },
        archivedAt: archived ? { not: null } : null,
      },
      include: PROJECT_INCLUDE,
    });
    const sorted = projects.sort(compareForDashboard);
    const total = sorted.length;

    // Advisory only, and only meaningful for individual contributors. A
    // PROJECT_MANAGER overseeing many projects at once isn't "overloaded"
    // the same way, so this stays unset for PM/ADMIN/SYSTEM_ADMIN.
    const isIndividualContributor =
      role === Role.DEVELOPER || role === Role.DESIGNER;

    const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize);
    const contexts = await this.buildProjectContexts(
      pageItems.map((item) => item.id),
      userId,
      role,
    );

    return {
      items: pageItems.map((item) =>
        toProjectResponse(item, contexts.get(item.id) as ProjectContext),
      ),
      total,
      page,
      pageSize,
      ...(isIndividualContributor && {
        overloaded: total > RECOMMENDED_MAX_ACTIVE_PROJECTS,
      }),
    };
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getProjectOrThrow(id);
    await this.projectScope.assertManagesProject(id, actorId, actorRole);

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.plannedStartDate !== undefined) {
      data.plannedStartDate = new Date(dto.plannedStartDate);
    }
    if (dto.deadline !== undefined) {
      data.deadline = new Date(dto.deadline);
    }

    if (Object.keys(data).length === 0) {
      return this.getProjectWithInclude(id);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data,
      include: PROJECT_INCLUDE,
    });

    const detailChanges: Record<
      string,
      { from: string | null; to: string | null }
    > = {};
    if (dto.name !== undefined && dto.name !== existing.name) {
      detailChanges.name = { from: existing.name, to: updated.name };
    }
    if (
      dto.description !== undefined &&
      dto.description !== existing.description
    ) {
      detailChanges.description = {
        from: existing.description,
        to: updated.description,
      };
    }
    if (
      dto.plannedStartDate !== undefined &&
      existing.plannedStartDate?.getTime() !==
        updated.plannedStartDate?.getTime()
    ) {
      detailChanges.plannedStartDate = {
        from: existing.plannedStartDate?.toISOString() ?? null,
        to: updated.plannedStartDate?.toISOString() ?? null,
      };
    }
    if (Object.keys(detailChanges).length > 0) {
      await this.projectActivity.log(id, actorId, 'PROJECT_DETAILS_UPDATED', {
        metadata: { changes: detailChanges },
      });
    }

    if (
      dto.deadline !== undefined &&
      existing.deadline?.getTime() !== updated.deadline?.getTime()
    ) {
      await this.projectActivity.log(id, actorId, 'DEADLINE_CHANGED', {
        metadata: {
          from: existing.deadline?.toISOString() ?? null,
          to: updated.deadline?.toISOString() ?? null,
        },
      });
    }

    return updated;
  }

  async updatePriority(
    id: string,
    dto: UpdateProjectPriorityDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getProjectOrThrow(id);
    await this.projectScope.assertManagesProject(id, actorId, actorRole);

    const requiresRushReason =
      dto.priority === ProjectPriority.URGENT ||
      dto.priority === ProjectPriority.CRITICAL;
    if (requiresRushReason && !dto.rushReason) {
      throw new BadRequestException(
        'rushReason is required when setting priority to URGENT or CRITICAL',
      );
    }

    if (dto.priority === existing.priority) {
      return this.getProjectWithInclude(id);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        priority: dto.priority,
        rushReason: requiresRushReason ? dto.rushReason : null,
      },
      include: PROJECT_INCLUDE,
    });

    await this.projectActivity.log(id, actorId, 'PRIORITY_CHANGED', {
      metadata: {
        from: existing.priority,
        to: dto.priority,
        rushReason: updated.rushReason,
      },
    });

    // Only on a raise to URGENT/CRITICAL specifically, never on every
    // priority change, matching the build spec's exact wording.
    if (requiresRushReason) {
      await this.notifyProjectAudience(
        id,
        actorId,
        NotificationType.PROJECT_PRIORITY_RAISED,
        `${updated.name} priority raised to ${dto.priority}`,
        dto.rushReason,
      );
    }

    return updated;
  }

  // actualHours is never touched here. It only ever comes from recalculating
  // logged time entries.
  async updateEstimatedHours(
    id: string,
    dto: UpdateEstimatedHoursDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getProjectOrThrow(id);
    await this.projectScope.assertManagesProject(id, actorId, actorRole);

    if (dto.estimatedHours === existing.estimatedHours) {
      return toProjectResponse(
        await this.getProjectWithInclude(id),
        await this.buildProjectContext(id, actorId, actorRole),
      );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: { estimatedHours: dto.estimatedHours },
      include: PROJECT_INCLUDE,
    });

    await this.projectActivity.log(id, actorId, 'ESTIMATED_HOURS_CHANGED', {
      metadata: { from: existing.estimatedHours, to: dto.estimatedHours },
    });

    return toProjectResponse(
      updated,
      await this.buildProjectContext(id, actorId, actorRole),
    );
  }

  // The caller sends the full desired set of types, not a delta, and this
  // diffs it against what's currently tagged, so a PM fixing a wrong type
  // (e.g. WORDPRESS to WEBFLOW) just resends the corrected full list rather
  // than issuing separate add/remove calls.
  async updateTypes(
    id: string,
    dto: UpdateProjectTypesDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(id);
    await this.projectScope.assertManagesProject(id, actorId, actorRole);

    const existingTags = await this.prisma.projectTypeTag.findMany({
      where: { projectId: id },
    });
    const existingTypes = existingTags.map((tag) => tag.type);
    const newTypes = [...new Set(dto.projectTypes)];

    const added = newTypes.filter((type) => !existingTypes.includes(type));
    const removed = existingTypes.filter((type) => !newTypes.includes(type));

    if (added.length === 0 && removed.length === 0) {
      return this.getProjectWithInclude(id);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        projectTypeTags: {
          ...(removed.length > 0 && { deleteMany: { type: { in: removed } } }),
          ...(added.length > 0 && {
            createMany: { data: added.map((type) => ({ type })) },
          }),
        },
      },
      include: PROJECT_INCLUDE,
    });

    await this.projectActivity.log(id, actorId, 'PROJECT_TYPES_CHANGED', {
      metadata: { added, removed },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateProjectStatusDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getProjectOrThrow(id);
    await this.assertCanChangeStatus(id, actorId, actorRole);

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[existing.status];
    if (!allowedNext.includes(dto.status)) {
      throw new ConflictException(
        `Cannot move a project from ${existing.status} to ${dto.status}`,
      );
    }

    if (dto.status === ProjectStatus.CANCELLED) {
      if (actorRole !== Role.ADMIN && actorRole !== Role.SYSTEM_ADMIN) {
        throw new ForbiddenException(
          'Only ADMIN or SYSTEM_ADMIN can cancel a project',
        );
      }
      if (!dto.reason) {
        throw new BadRequestException(
          'reason is required when cancelling a project',
        );
      }
    }
    if (dto.status === ProjectStatus.ON_HOLD) {
      if (
        actorRole !== Role.PROJECT_MANAGER &&
        actorRole !== Role.ADMIN &&
        actorRole !== Role.SYSTEM_ADMIN
      ) {
        throw new ForbiddenException(
          'Only PROJECT_MANAGER, ADMIN, or SYSTEM_ADMIN can move a project to ON_HOLD',
        );
      }
      if (!dto.reason) {
        throw new BadRequestException(
          'reason is required when moving a project to ON_HOLD',
        );
      }
    }

    const isReopening =
      (existing.status === ProjectStatus.COMPLETED ||
        existing.status === ProjectStatus.CANCELLED) &&
      dto.status === ProjectStatus.READY_FOR_WORK;
    if (isReopening) {
      this.assertIsAdmin(actorRole, 'reopen');
      if (existing.archivedAt) {
        throw new ConflictException(
          'This project is archived, use restore instead',
        );
      }
    }

    const data: Prisma.ProjectUpdateInput = { status: dto.status };
    if (dto.status === ProjectStatus.ON_HOLD) {
      data.onHoldReason = dto.reason;
    }
    if (dto.status === ProjectStatus.CANCELLED) {
      data.cancellationReason = dto.reason;
    }
    if (dto.status === ProjectStatus.COMPLETED) {
      data.completedAt = new Date();
    }
    if (isReopening) {
      data.completedAt = null;
      data.cancellationReason = null;
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data,
      include: PROJECT_INCLUDE,
    });

    await this.projectActivity.log(id, actorId, 'STATUS_CHANGED', {
      metadata: { from: existing.status, to: dto.status, reason: dto.reason },
    });
    if (dto.status === ProjectStatus.COMPLETED) {
      await this.projectActivity.log(id, actorId, 'PROJECT_COMPLETED');
    }
    if (dto.status === ProjectStatus.CANCELLED) {
      await this.projectActivity.log(id, actorId, 'PROJECT_CANCELLED', {
        metadata: { reason: dto.reason },
      });
    }

    await this.notifyStatusChanged(
      id,
      updated.name,
      existing.status,
      dto,
      actorId,
    );

    return updated;
  }

  // A project's status change always notifies someone, but which type and
  // which audience depends on the transition. ON_HOLD/CANCELLED are their
  // own specific types, replacing the generic one, not stacked alongside
  // it, for everyone staffed. Moving IN_PROGRESS to INTERNAL_REVIEW is a
  // deliberate split instead: the managing PM(s)/Admin get the specific
  // INTERNAL_REVIEW_SUBMITTED type (the build spec only gives PM this one,
  // the developer who just submitted it is the actor and needs no
  // notification about their own action), while any other staffed
  // Developer/Designer, who is not also a managing PM, gets the generic
  // PROJECT_STATUS_CHANGED instead, so nobody sees this one transition
  // twice under two different types. Every other transition is the plain
  // generic type for the whole staffed audience.
  private async notifyStatusChanged(
    projectId: string,
    projectName: string,
    fromStatus: ProjectStatus,
    dto: UpdateProjectStatusDto,
    actorId: string,
  ): Promise<void> {
    if (dto.status === ProjectStatus.INTERNAL_REVIEW) {
      const pmAndAdminIds =
        await this.notificationsService.resolveManagingPmAndAdminIds(projectId);
      await Promise.all(
        pmAndAdminIds
          .filter((recipientId) => recipientId !== actorId)
          .map((recipientId) =>
            this.notificationsService.notify({
              userId: recipientId,
              type: NotificationType.INTERNAL_REVIEW_SUBMITTED,
              title: `${projectName} submitted for internal review`,
              metadata: { projectId },
            }),
          ),
      );

      const allIds =
        await this.notificationsService.resolveAllActiveMembersAndAdminIds(
          projectId,
        );
      const alreadyNotified = new Set([...pmAndAdminIds, actorId]);
      await Promise.all(
        allIds
          .filter((recipientId) => !alreadyNotified.has(recipientId))
          .map((recipientId) =>
            this.notificationsService.notify({
              userId: recipientId,
              type: NotificationType.PROJECT_STATUS_CHANGED,
              title: `${projectName} status changed to ${dto.status}`,
              metadata: { projectId, from: fromStatus, to: dto.status },
            }),
          ),
      );
      return;
    }

    const type =
      dto.status === ProjectStatus.ON_HOLD
        ? NotificationType.PROJECT_ON_HOLD
        : dto.status === ProjectStatus.CANCELLED
          ? NotificationType.PROJECT_CANCELLED
          : NotificationType.PROJECT_STATUS_CHANGED;
    const title =
      dto.status === ProjectStatus.ON_HOLD
        ? `${projectName} moved to On Hold`
        : dto.status === ProjectStatus.CANCELLED
          ? `${projectName} was cancelled`
          : `${projectName} status changed to ${dto.status}`;

    await this.notifyProjectAudience(
      projectId,
      actorId,
      type,
      title,
      dto.reason,
    );
  }

  // Shared by updateStatus()/updatePriority(): the whole staffed audience
  // (any active ProjectMember role, plus Admin/System Admin) minus the
  // actor, one notification each. Used whenever the build spec says both
  // the managing PM(s) and staffed Developer/Designer should hear about
  // the same event.
  private async notifyProjectAudience(
    projectId: string,
    actorId: string,
    type: NotificationType,
    title: string,
    message?: string,
  ): Promise<void> {
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
            type,
            title,
            message,
            metadata: { projectId },
          }),
        ),
    );
  }

  async archive(id: string, actorId: string, actorRole: Role) {
    const existing = await this.getProjectOrThrow(id);
    this.assertIsAdmin(actorRole, 'archive');

    if (
      existing.status !== ProjectStatus.COMPLETED &&
      existing.status !== ProjectStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Only a COMPLETED or CANCELLED project can be archived',
      );
    }
    if (existing.archivedAt) {
      throw new ConflictException('Project is already archived');
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: PROJECT_INCLUDE,
    });

    await this.projectActivity.log(id, actorId, 'PROJECT_ARCHIVED');

    return updated;
  }

  // The counterpart to archive() above: brings an archived project back to
  // READY_FOR_WORK in one step. A COMPLETED/CANCELLED project that was never
  // archived in the first place uses the direct reopen path in
  // updateStatus() instead (see isReopening there), not this method.
  async restore(id: string, actorId: string, actorRole: Role) {
    const existing = await this.getProjectOrThrow(id);
    this.assertIsAdmin(actorRole, 'restore');

    if (!existing.archivedAt) {
      throw new ConflictException('Project is not archived');
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        archivedAt: null,
        status: ProjectStatus.READY_FOR_WORK,
        completedAt: null,
        cancellationReason: null,
      },
      include: PROJECT_INCLUDE,
    });

    await this.projectActivity.log(id, actorId, 'PROJECT_RESTORED');

    return updated;
  }

  private assertIsAdmin(actorRole: Role, action: string) {
    if (actorRole !== Role.ADMIN && actorRole !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        `Only ADMIN or SYSTEM_ADMIN can ${action} a project`,
      );
    }
  }

  // For a project that never got a Slack channel (e.g. Slack wasn't set up
  // yet, or syncSlackChannelForNewProject() failed and was never retried).
  // Unlike that first attempt, this invites every current active member
  // plus all admins, not just the creator.
  async connectSlackChannel(
    id: string,
    dto: ConnectSlackChannelDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getProjectWithInclude(id);
    await this.projectScope.assertManagesProject(id, actorId, actorRole);

    if (existing.slackChannelId) {
      throw new ConflictException(
        'This project is already connected to a Slack channel',
      );
    }

    let slackChannelId: string;
    if (dto.slackChannelId) {
      const accessible = await this.slackService.verifyChannelAccessible(
        dto.slackChannelId,
      );
      if (!accessible) {
        throw new BadRequestException(
          'Could not access a Slack channel with that id. Make sure the bot has been added to it and it is not archived',
        );
      }
      slackChannelId = dto.slackChannelId;
    } else {
      const projectTypes = existing.projectTypeTags.map((tag) => tag.type);
      const channelName = buildChannelName(projectTypes, existing.name);
      const created = await this.slackService.createProjectChannel(channelName);
      if (!created) {
        throw new BadRequestException(
          'Failed to create a Slack channel — check the Slack configuration and try again',
        );
      }
      slackChannelId = created;
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: { slackChannelId },
      include: PROJECT_INCLUDE,
    });

    await this.inviteCurrentRosterToSlackChannel(id, slackChannelId);

    return toProjectResponse(
      updated,
      await this.buildProjectContext(id, actorId, actorRole),
    );
  }

  private async inviteCurrentRosterToSlackChannel(
    projectId: string,
    slackChannelId: string,
  ): Promise<void> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId, leftAt: null },
      select: {
        user: { select: { id: true, email: true, slackUserId: true } },
      },
    });
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SYSTEM_ADMIN] }, deletedAt: null },
      select: { id: true, email: true, slackUserId: true },
    });

    const users = [...members.map((member) => member.user), ...admins];
    for (const user of users) {
      const slackUserId = await this.slackUserResolver.resolveSlackUserId(user);
      if (slackUserId) {
        await this.slackService.inviteToChannel(slackChannelId, slackUserId);
      }
    }
  }

  private async getProjectOrThrow(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  // Unscoped full project fetch for the staff only mutation methods above,
  // which are already gated to PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN at the
  // controller level. Unlike findOne(), no CLIENT/DEVELOPER/DESIGNER
  // scoping applies here.
  // Resolved once per request. `permissions` depends only on the caller, so it
  // is asked once; `managesProject` depends on the project, so it is asked per
  // distinct project id and cached for the rest of the page.
  private async buildProjectContext(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ): Promise<ProjectContext> {
    return {
      permissions: this.permissions.getEffectivePermissions({
        role: actorRole,
      }),
      managesProject: await this.projectScope.managesProject(
        projectId,
        actorId,
        actorRole,
      ),
    };
  }

  private async buildProjectContexts(
    projectIds: string[],
    actorId: string,
    actorRole: Role,
  ): Promise<Map<string, ProjectContext>> {
    const permissions = this.permissions.getEffectivePermissions({
      role: actorRole,
    });
    const contexts = new Map<string, ProjectContext>();
    for (const projectId of new Set(projectIds)) {
      contexts.set(projectId, {
        permissions,
        managesProject: await this.projectScope.managesProject(
          projectId,
          actorId,
          actorRole,
        ),
      });
    }
    return contexts;
  }

  private async getProjectWithInclude(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: PROJECT_INCLUDE,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  // PATCH /projects/:id/status is the one mutation open to PROJECT_MANAGER,
  // DEVELOPER, and DESIGNER alike, so it needs its own branch rather than
  // reusing assertManagesProject (PM only) or assertActiveMember (does
  // nothing for PM) individually. ADMIN/SYSTEM_ADMIN fall through to
  // assertActiveMember, which itself does nothing for anything other than
  // DEVELOPER/DESIGNER.
  private async assertCanChangeStatus(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.PROJECT_MANAGER) {
      await this.projectScope.assertManagesProject(
        projectId,
        actorId,
        actorRole,
      );
      return;
    }
    await this.projectScope.assertActiveMember(projectId, actorId, actorRole);
  }
}
