import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, Role } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

/**
 * Project scoping: whether THIS caller may act on THIS project.
 *
 * ── Why this exists ──
 * The permission gate answers "may this role ever do this" (D2). It cannot
 * answer "may they do it to this project", because that depends on
 * `ProjectMember` rows. That second question was previously answered by twelve
 * private copies of the same three helpers across eleven services: seven
 * byte-identical copies of `assertManagesProject`, four of `assertActiveMember`,
 * and one genuine variant. They had not drifted, but nothing was stopping them:
 * a fix to an authorization rule had eleven places to land and no way to know it
 * had missed one.
 *
 * ── The predicates are the primitives, the assertions wrap them ──
 * Capability flags (ADR 0002) and enforcement have to agree, or the UI offers a
 * button that 403s. Deriving both from the same `boolean` is what makes that
 * structurally true rather than a thing to remember.
 */
@Injectable()
export class ProjectScopeService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Predicates. Capability flags read these.
  // ══════════════════════════════════════════════════════════════════════════

  /** Is this user currently staffed on this project, in any project role? */
  async isActiveMember(projectId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId, leftAt: null },
      select: { id: true },
    });
    return membership !== null;
  }

  /**
   * May this caller act as the project's manager?
   *
   * Holding the PROJECT_MANAGER *role* is not enough: they must be staffed onto
   * this project as its PROJECT_MANAGER. Only ADMIN and SYSTEM_ADMIN skip the
   * staffing check, which is the deliberate superset rule from
   * `roles.config.ts`.
   */
  async managesProject(
    projectId: string,
    userId: string,
    role: Role,
  ): Promise<boolean> {
    if (role === Role.ADMIN || role === Role.SYSTEM_ADMIN) {
      return true;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        role: ProjectRole.PROJECT_MANAGER,
        leftAt: null,
      },
      select: { id: true },
    });
    return membership !== null;
  }

  /**
   * Does the staffing check apply to this role at all?
   *
   * Only DEVELOPER and DESIGNER are scoped by membership for reads. Everyone
   * above them sees every project, so asking the database would be a query
   * whose answer is already known.
   */
  isScopedByMembership(role: Role): boolean {
    return role === Role.DEVELOPER || role === Role.DESIGNER;
  }

  /**
   * May this caller move THIS project's status?
   *
   * A PROJECT_MANAGER must actually manage the project. Everyone else is
   * governed by the read rule: DEVELOPER and DESIGNER must be staffed on it,
   * ADMIN and SYSTEM_ADMIN are not scoped by membership at all.
   *
   * It lives here, next to its assertion, because the capability flag and the
   * enforcement have to be the SAME boolean. `canChangeStatus` used to be
   * `has(CHANGE_PROJECT_STATUS) && !isArchived`, missing the scope half
   * entirely, so a project manager was offered a status control on every
   * project they could see and got a 403 from the one they did not manage.
   */
  async mayChangeProjectStatus(
    projectId: string,
    userId: string,
    role: Role,
  ): Promise<boolean> {
    if (role === Role.PROJECT_MANAGER) {
      return this.managesProject(projectId, userId, role);
    }
    if (!this.isScopedByMembership(role)) {
      return true;
    }
    return this.isActiveMember(projectId, userId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Assertions. Services call these.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Read scoping. A no-op for anyone who is not a DEVELOPER or DESIGNER.
   *
   * Replaces the four identical private copies.
   */
  async assertActiveMember(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ): Promise<void> {
    if (!this.isScopedByMembership(actorRole)) {
      return;
    }
    if (!(await this.isActiveMember(projectId, actorId))) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }
  }

  /** Replaces the seven identical private copies. */
  async assertManagesProject(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ): Promise<void> {
    if (!(await this.managesProject(projectId, actorId, actorRole))) {
      throw new ForbiddenException('You do not manage this project');
    }
  }

  /** Paired with `mayChangeProjectStatus`, so the two can never disagree. */
  async assertMayChangeProjectStatus(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ): Promise<void> {
    if (!(await this.mayChangeProjectStatus(projectId, actorId, actorRole))) {
      throw new ForbiddenException(
        actorRole === Role.PROJECT_MANAGER
          ? 'You do not manage this project'
          : 'You are not an active member of this project',
      );
    }
  }

  /**
   * Membership required of EVERY role, admins included.
   *
   * Deliberately not `assertActiveMember`, though it was named that in
   * `daily-work-report.service.ts`. It guards logging work against a project,
   * where being an admin is not a reason to appear on a project's timesheet: to
   * log work you must be staffed on it, full stop. Same shape, different rule,
   * and the old shared name hid that.
   */
  async assertStaffedOnProject(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!(await this.isActiveMember(projectId, userId))) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }
  }
}
