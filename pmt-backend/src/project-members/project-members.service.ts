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
  ProjectRole,
  ProjectStatus,
  Role,
  User,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { SlackService } from '@/slack/slack.service';
import { SlackUserResolverService } from '@/slack/slack-user-resolver.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { AddProjectMemberDto } from '@/project-members/dto/add-project-member.dto';
import { QueryProjectMembersDto } from '@/project-members/dto/query-project-members.dto';
import { RECOMMENDED_MAX_ACTIVE_PROJECTS } from '@/projects/workload.constants';
import { ProjectScopeService } from '@/project-scope/project-scope.service';

const MEMBER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, role: true } },
};

// A ProjectMember's role must match the user's actual global Role one to
// one. The global Role is the source of truth; ProjectRole just narrows it
// to the staffing context.
const ALLOWED_GLOBAL_ROLES: Record<ProjectRole, Role[]> = {
  [ProjectRole.PROJECT_MANAGER]: [Role.PROJECT_MANAGER],
  [ProjectRole.DEVELOPER]: [Role.DEVELOPER],
  [ProjectRole.DESIGNER]: [Role.DESIGNER],
};

const NON_TERMINAL_STATUSES: ProjectStatus[] = Object.values(
  ProjectStatus,
).filter(
  (status) =>
    status !== ProjectStatus.COMPLETED && status !== ProjectStatus.CANCELLED,
);

@Injectable()
export class ProjectMembersService {
  private readonly logger = new Logger(ProjectMembersService.name);

  constructor(
    private readonly projectScope: ProjectScopeService,
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
    private readonly slackService: SlackService,
    private readonly slackUserResolver: SlackUserResolverService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    projectId: string,
    query: QueryProjectMembersDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.projectScope.assertActiveMember(projectId, actorId, actorRole);

    const { page = 1, pageSize = 20, includeLeft = false } = query;
    const where = {
      projectId,
      ...(includeLeft ? {} : { leftAt: null }),
    };

    return paginate(
      (args) =>
        this.prisma.projectMember.findMany({
          where,
          orderBy: { joinedAt: 'asc' },
          include: MEMBER_INCLUDE,
          ...args,
        }),
      () => this.prisma.projectMember.count({ where }),
      page,
      pageSize,
    );
  }

  async add(
    projectId: string,
    dto: AddProjectMemberDto,
    actorId: string,
    actorRole: Role,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    await this.projectScope.assertManagesProject(projectId, actorId, actorRole);

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!ALLOWED_GLOBAL_ROLES[dto.role].includes(user.role)) {
      throw new BadRequestException(
        `A user with role ${user.role} cannot be assigned as ${dto.role} on a project`,
      );
    }

    const existingActiveMembership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: dto.userId, role: dto.role, leftAt: null },
    });
    if (existingActiveMembership) {
      throw new ConflictException(
        'This user is already an active member of this project in that role',
      );
    }

    // Checked before creating the new row, a rejoin (this exact person has
    // been on this exact project before, in any role, and left) gets a
    // distinct notification for the managing PM(s), see below.
    const hadPriorMembership =
      (await this.prisma.projectMember.count({
        where: { projectId, userId: dto.userId, leftAt: { not: null } },
      })) > 0;

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, role: dto.role },
      include: MEMBER_INCLUDE,
    });

    await this.projectActivity.log(projectId, actorId, 'MEMBER_JOINED', {
      message: `${user.name} joined as ${dto.role}`,
      metadata: { userId: user.id, role: dto.role },
    });

    await this.notifyMemberAssigned(
      project,
      user,
      dto.role,
      hadPriorMembership,
      actorId,
    );

    if (project.slackChannelId) {
      this.inviteMemberToSlackChannel(project.slackChannelId, user).catch(
        (error) => {
          this.logger.warn(
            `Failed to invite ${user.id} to Slack channel ${project.slackChannelId}: ${error}`,
          );
        },
      );
    }

    await this.autoTransitionFromPlanning(
      project.id,
      project.status,
      project.plannedStartDate,
      actorId,
    );

    // Advisory only, and never blocks the assignment. A Developer/Designer
    // can be over the recommended load on paper (e.g. one project barely
    // needs their time right now) so this just flags it for the PM rather
    // than rejecting the request. PROJECT_MANAGER is exempt: overseeing
    // several projects at once is their job, not the load of an individual
    // contributor.
    let workloadWarning: string | undefined;
    if (
      dto.role === ProjectRole.DEVELOPER ||
      dto.role === ProjectRole.DESIGNER
    ) {
      const activeProjectCount = await this.prisma.projectMember.count({
        where: {
          userId: dto.userId,
          leftAt: null,
          project: { status: { in: NON_TERMINAL_STATUSES } },
        },
      });
      if (activeProjectCount > RECOMMENDED_MAX_ACTIVE_PROJECTS) {
        workloadWarning = `${user.name} is now assigned to ${activeProjectCount} active projects (recommended max: ${RECOMMENDED_MAX_ACTIVE_PROJECTS}) — they may be overloaded.`;
      }
    }

    return { ...member, ...(workloadWarning && { workloadWarning }) };
  }

  async remove(
    projectId: string,
    memberId: string,
    actorId: string,
    actorRole: Role,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    await this.projectScope.assertManagesProject(projectId, actorId, actorRole);

    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      include: MEMBER_INCLUDE,
    });
    if (!member) {
      throw new NotFoundException('Project member not found');
    }
    if (member.leftAt) {
      throw new ConflictException('This member has already left the project');
    }

    const updated = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: { leftAt: new Date() },
      include: MEMBER_INCLUDE,
    });

    await this.projectActivity.log(projectId, actorId, 'MEMBER_LEFT', {
      message: `${member.user.name} left the project`,
      metadata: { userId: member.userId, role: member.role },
    });

    await this.notifyMemberRemoved(project, member.user, member.role, actorId);

    if (project.slackChannelId) {
      this.removeMemberFromSlackChannelById(
        project.slackChannelId,
        member.userId,
      ).catch((error) => {
        this.logger.warn(
          `Failed to remove ${member.userId} from Slack channel ${project.slackChannelId}: ${error}`,
        );
      });
    }

    // Removing a member, even the last Developer/Designer or the only
    // Project Manager, never changes the project's status on its own. It
    // just stays in whatever status it was already in.
    return updated;
  }

  // Covers the case where a member was added to the project before they had
  // a Slack account (or one under a different email). inviteMemberToSlackChannel
  // only ever runs once, at add() time, and never retries on its own. This
  // runs that same resolve and invite again for an existing active member
  // without requiring them to leave and rejoin the project.
  async resyncSlackChannelMembership(
    projectId: string,
    memberId: string,
    actorId: string,
    actorRole: Role,
  ) {
    const project = await this.getProjectOrThrow(projectId);
    await this.projectScope.assertManagesProject(projectId, actorId, actorRole);

    if (!project.slackChannelId) {
      throw new BadRequestException(
        'This project has no Slack channel to invite the member to',
      );
    }

    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId, leftAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true, slackUserId: true },
        },
      },
    });
    if (!member) {
      throw new NotFoundException('Active project member not found');
    }

    const slackUserId = await this.slackUserResolver.resolveSlackUserId(
      member.user,
    );
    if (!slackUserId) {
      return {
        invited: false,
        message: `No Slack account found for ${member.user.email}. They may not have joined the Slack workspace yet, or use a different email there.`,
      };
    }

    await this.slackService.inviteToChannel(
      project.slackChannelId,
      slackUserId,
    );

    return {
      invited: true,
      message: `${member.user.name} was invited to the project's Slack channel.`,
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

  // "A project stays in Planning until a Project Manager and at least one
  // Developer or Designer are assigned," plus the date driven split between
  // Scheduled and Ready For Work. This only moves in one direction: it only
  // fires while the project is still in PLANNING, so it never retriggers or
  // reverts a later status.
  private async autoTransitionFromPlanning(
    projectId: string,
    currentStatus: ProjectStatus,
    plannedStartDate: Date | null,
    actorId: string,
  ) {
    if (currentStatus !== ProjectStatus.PLANNING) {
      return;
    }

    const [hasProjectManager, hasDeveloperOrDesigner] = await Promise.all([
      this.hasActiveMemberWithRole(projectId, [ProjectRole.PROJECT_MANAGER]),
      this.hasActiveMemberWithRole(projectId, [
        ProjectRole.DEVELOPER,
        ProjectRole.DESIGNER,
      ]),
    ]);
    if (!hasProjectManager || !hasDeveloperOrDesigner) {
      return;
    }

    const startsInFuture =
      plannedStartDate !== null && plannedStartDate.getTime() > Date.now();
    const nextStatus = startsInFuture
      ? ProjectStatus.SCHEDULED
      : ProjectStatus.READY_FOR_WORK;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: nextStatus },
    });

    await this.projectActivity.log(projectId, actorId, 'STATUS_CHANGED', {
      message: `Project automatically moved from PLANNING to ${nextStatus} once staffing was complete`,
      metadata: { from: ProjectStatus.PLANNING, to: nextStatus },
    });
  }

  private async hasActiveMemberWithRole(
    projectId: string,
    roles: ProjectRole[],
  ) {
    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, role: { in: roles }, leftAt: null },
    });
    return member !== null;
  }

  private async inviteMemberToSlackChannel(
    channelId: string,
    user: Pick<User, 'id' | 'email' | 'slackUserId'>,
  ): Promise<void> {
    const slackUserId = await this.slackUserResolver.resolveSlackUserId(user);
    if (slackUserId) {
      await this.slackService.inviteToChannel(channelId, slackUserId);
    }
  }

  // Only DEVELOPER/DESIGNER additions get a notification at all, matching
  // the build spec's exact wording ("PM is notified when a developer or
  // designer is assigned..."), a second PM being staffed is not covered.
  // Two independent decisions: whether the assignee's own notification
  // reads "new project" or "existing project, full handover history" (the
  // project's status BEFORE this add, still PLANNING means nothing has
  // happened yet), and whether the managing PM(s) get told this is a fresh
  // assignment or a rejoin (hadPriorMembership), the build spec only gives
  // PM a distinct "reassigned" type, not the assignee, so the assignee
  // always gets the new/handover distinction regardless of rejoin status.
  private async notifyMemberAssigned(
    project: { id: string; name: string; status: ProjectStatus },
    user: Pick<User, 'id' | 'name'>,
    role: ProjectRole,
    hadPriorMembership: boolean,
    actorId: string,
  ): Promise<void> {
    if (role !== ProjectRole.DEVELOPER && role !== ProjectRole.DESIGNER) {
      return;
    }

    const isHandover = project.status !== ProjectStatus.PLANNING;
    await this.notificationsService.notify({
      userId: user.id,
      type: isHandover
        ? NotificationType.MEMBER_HANDOVER
        : NotificationType.MEMBER_ASSIGNED,
      title: isHandover
        ? `You've been assigned to ${project.name}`
        : `You've been assigned to a new project: ${project.name}`,
      message: isHandover
        ? `You've joined an existing project, review its history to get up to speed.`
        : `You've been assigned to a brand new project.`,
      metadata: { projectId: project.id },
      // Only the handover case gets a Slack DM per the build spec, plain
      // MEMBER_ASSIGNED (a genuinely new project with nothing to hand
      // over yet) does not.
      slackDm: isHandover,
    });

    const recipientIds =
      await this.notificationsService.resolveManagingPmAndAdminIds(project.id);
    await Promise.all(
      recipientIds
        // Never notify the assignee about their own assignment twice, and
        // never notify the acting PM/Admin about an action they just took
        // themselves.
        .filter(
          (recipientId) => recipientId !== user.id && recipientId !== actorId,
        )
        .map((recipientId) =>
          this.notificationsService.notify({
            userId: recipientId,
            type: hadPriorMembership
              ? NotificationType.MEMBER_REASSIGNED
              : NotificationType.MEMBER_ASSIGNED,
            title: hadPriorMembership
              ? `${user.name} was reassigned to ${project.name}`
              : `${user.name} was assigned to ${project.name}`,
            metadata: { projectId: project.id, userId: user.id, role },
          }),
        ),
    );
  }

  // Same DEVELOPER/DESIGNER only restriction as notifyMemberAssigned above.
  private async notifyMemberRemoved(
    project: { id: string; name: string },
    user: Pick<User, 'id' | 'name'>,
    role: ProjectRole,
    actorId: string,
  ): Promise<void> {
    if (role !== ProjectRole.DEVELOPER && role !== ProjectRole.DESIGNER) {
      return;
    }

    await this.notificationsService.notify({
      userId: user.id,
      type: NotificationType.MEMBER_REMOVED,
      title: `You were removed from ${project.name}`,
      metadata: { projectId: project.id },
    });

    const recipientIds =
      await this.notificationsService.resolveManagingPmAndAdminIds(project.id);
    await Promise.all(
      recipientIds
        .filter(
          (recipientId) => recipientId !== user.id && recipientId !== actorId,
        )
        .map((recipientId) =>
          this.notificationsService.notify({
            userId: recipientId,
            type: NotificationType.MEMBER_REMOVED,
            title: `${user.name} was removed from ${project.name}`,
            metadata: { projectId: project.id, userId: user.id, role },
          }),
        ),
    );
  }

  private async removeMemberFromSlackChannelById(
    channelId: string,
    userId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, slackUserId: true },
    });
    if (!user) {
      return;
    }
    const slackUserId = await this.slackUserResolver.resolveSlackUserId(user);
    if (slackUserId) {
      await this.slackService.removeFromChannel(channelId, slackUserId);
    }
  }
}
