import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveStatus,
  NotificationType,
  Permission,
  Role,
} from '@prisma/client';
import { PermissionsService } from '@/auth/permissions/permissions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { LeaveBalancesService } from '@/leave/requests/leave-balances.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { daysBetweenInclusive } from '@/common/utils/date.util';
import { paginate } from '@/common/utils/pagination.util';
import { toCsv } from '@/common/utils/csv.util';
import { toLeaveRequestResponse } from '@/leave/leave.mapper';
import { ROLE_DISPLAY, toEnumDisplay } from '@/common/utils/enum-display.util';
import { EnumDisplayDto } from '@/common/dto/display.dto';
import {
  CreateLeaveRequestDto,
  QueryLeaveRequestsDto,
  QueryLeaveSummaryDto,
  RejectLeaveRequestDto,
} from '@/leave/dto/leave.dto';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface LeaveSummaryRequest {
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
}

export interface LeaveSummaryUser {
  userId: string;
  name: string;
  email: string;
  // A display object, not a raw Role: this report is rendered directly, and
  // the CSV export reads `.label` for its Role column (ADR 0001).
  role: EnumDisplayDto;
  byLeaveType: Record<string, number>;
  totalDays: number;
  requests?: LeaveSummaryRequest[];
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly leaveBalances: LeaveBalancesService,
    private readonly notificationsService: NotificationsService,
    private readonly permissions: PermissionsService,
  ) {}

  // ADMIN/SYSTEM_ADMIN never submit a leave request, they only approve or
  // reject one. ADMIN holds every lower role's permissions by design (see
  // ROLE_PERMISSIONS in src/config/roles.config.ts), so REQUEST_LEAVE is
  // reachable by them at the route. The restriction is a business rule about
  // WHO the request is for, not a capability, so it stays enforced here.
  async create(dto: CreateLeaveRequestDto, userId: string, actorRole: Role) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'ADMIN and SYSTEM_ADMIN do not submit leave requests, only approve or reject them',
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
    const days = daysBetweenInclusive(startDate, endDate);

    // Always created as PENDING, even if it exceeds the remaining balance.
    // The balance is only ever checked or used at approval time, not here.
    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        days,
        reason: dto.reason,
        status: 'PENDING',
      },
      include: { leaveType: true },
    });

    await this.auditLog.log({
      userId,
      action: 'leave.requested',
      targetType: 'LeaveRequest',
      targetId: leaveRequest.id,
      metadata: { leaveTypeId: dto.leaveTypeId, days },
    });

    // Matches the build spec's exact wording: Admin/System Admin only,
    // only for a Developer/Designer's own request, a PROJECT_MANAGER can
    // also submit a leave request (EMPLOYEE_ROLES includes it) but that
    // case has no submission notification bullet in the build spec.
    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, role: true },
    });
    if (requester.role === Role.DEVELOPER || requester.role === Role.DESIGNER) {
      const admins = await this.prisma.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SYSTEM_ADMIN] },
          deletedAt: null,
        },
        select: { id: true },
      });
      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.notify({
            userId: admin.id,
            type: NotificationType.LEAVE_REQUEST_SUBMITTED,
            title: `${requester.name} submitted a leave request`,
            message: dto.reason,
            metadata: { leaveRequestId: leaveRequest.id },
          }),
        ),
      );
    }

    return toLeaveRequestResponse(leaveRequest, {
      callerId: userId,
      canReviewLeave: false,
    });
  }

  async findOwn(userId: string) {
    const requests = await this.prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { leaveType: true },
    });
    // Every row here is the caller's own, so they may cancel a pending one and
    // review none of them.
    return requests.map((request) =>
      toLeaveRequestResponse(request, {
        callerId: userId,
        canReviewLeave: false,
      }),
    );
  }

  ownBalance(userId: string) {
    return this.leaveBalances.findAllForUser(userId, new Date().getFullYear());
  }

  // For an ADMIN/PROJECT_MANAGER looking up an arbitrary user's balance.
  // Same lookup as ownBalance, just addressed by a path param instead of
  // the caller's own id, so the target user must be validated to exist
  // first.
  async balanceForUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.leaveBalances.findAllForUser(userId, new Date().getFullYear());
  }

  // ADMIN sees every request regardless of status. PROJECT_MANAGER sees
  // everyone's requests too (there's no assignment scoped to a project
  // yet), but REJECTED must never be returned to a PROJECT_MANAGER.
  async findAll(
    actorRole: Role,
    query: QueryLeaveRequestsDto,
    actorId: string,
  ) {
    const { page = 1, pageSize = 20, userId, status, leaveTypeId } = query;

    /**
     * Which statuses this caller may see AT ALL. A PROJECT_MANAGER must never
     * be shown a REJECTED request: they can approve leave but not see that
     * somebody's was turned down, which is the requester's business and the
     * admin's.
     */
    const visibleStatuses =
      actorRole === Role.PROJECT_MANAGER
        ? [LeaveStatus.PENDING, LeaveStatus.APPROVED]
        : null;

    /**
     * The caller's `status` filter NARROWS the visible set, it never replaces
     * it. Written as an intersection on purpose: spreading the requested status
     * after the role clause would overwrite it, and `?status=REJECTED` would
     * then hand a PROJECT_MANAGER exactly the rows the rule above exists to
     * withhold. A filter that widens what a role may see is a privilege
     * escalation with a query string for a key.
     *
     * Asking for a status outside the visible set yields `{ in: [] }`, which
     * matches nothing. Empty rather than forbidden, because the alternative
     * confirms which statuses exist to somebody probing for them.
     */
    const statusClause = visibleStatuses
      ? {
          status: {
            in: status
              ? visibleStatuses.filter((allowed) => allowed === status)
              : visibleStatuses,
          },
        }
      : status
        ? { status }
        : {};

    const where = {
      ...statusClause,
      ...(userId && { userId }),
      ...(leaveTypeId && { leaveTypeId }),
    };

    const result = await paginate(
      (args) =>
        this.prisma.leaveRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            leaveType: true,
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          ...args,
        }),
      () => this.prisma.leaveRequest.count({ where }),
      page,
      pageSize,
    );

    // Derived from the permission, NOT hardcoded true. Reaching this listing
    // only required VIEW_LEAVE_REQUESTS, and PROJECT_MANAGER holds that WITHOUT
    // holding REVIEW_LEAVE_REQUEST, which is what `/approve` and `/reject` are
    // gated on. Hardcoding it showed a project manager an Approve button on
    // every pending request in the list, and the route then answered 403.
    const context = {
      callerId: actorId,
      canReviewLeave: this.permissions.hasAll({ role: actorRole }, [
        Permission.REVIEW_LEAVE_REQUEST,
      ]).granted,
    };
    return {
      ...result,
      items: result.items.map((item) => toLeaveRequestResponse(item, context)),
    };
  }

  // Admin only report: for a date range, how many approved leave days each
  // person took, broken down by leave type. Only APPROVED requests count,
  // the same rule approve() already uses to credit LeaveBalance.usedDays.
  // The range is matched against startDate, since that is also the field
  // approve() derives its year from, there is no stored year on
  // LeaveRequest itself (only LeaveBalance has one).
  async getSummary(query: QueryLeaveSummaryDto) {
    const now = new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.UTC(now.getFullYear(), 0, 1));
    const endDate = query.endDate ? new Date(query.endDate) : now;

    const leaveTypes = await this.prisma.leaveType.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { gte: startDate, lte: endDate },
        ...(query.userId && { userId: query.userId }),
        user: {
          deletedAt: null,
          ...(query.role && query.role.length > 0
            ? { role: { in: query.role } }
            : {}),
        },
      },
      orderBy: { startDate: 'asc' },
      include: {
        leaveType: { select: { name: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const usersById = new Map<string, LeaveSummaryUser>();
    for (const leaveRequest of leaveRequests) {
      let user = usersById.get(leaveRequest.userId);
      if (!user) {
        user = {
          userId: leaveRequest.user.id,
          name: leaveRequest.user.name,
          email: leaveRequest.user.email,
          role: toEnumDisplay(ROLE_DISPLAY, leaveRequest.user.role),
          byLeaveType: Object.fromEntries(
            leaveTypes.map((leaveType) => [leaveType.name, 0]),
          ),
          totalDays: 0,
          requests: query.includeDetails ? [] : undefined,
        };
        usersById.set(leaveRequest.userId, user);
      }

      const leaveTypeName = leaveRequest.leaveType.name;
      user.byLeaveType[leaveTypeName] =
        (user.byLeaveType[leaveTypeName] ?? 0) + leaveRequest.days;
      user.totalDays += leaveRequest.days;
      user.requests?.push({
        leaveType: leaveTypeName,
        startDate: toDateOnly(leaveRequest.startDate),
        endDate: toDateOnly(leaveRequest.endDate),
        days: leaveRequest.days,
        reason: leaveRequest.reason,
      });
    }

    const users = [...usersById.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return {
      startDate: toDateOnly(startDate),
      endDate: toDateOnly(endDate),
      leaveTypes: leaveTypes.map((leaveType) => ({
        id: leaveType.id,
        name: leaveType.name,
      })),
      users,
      grandTotalDays: users.reduce((sum, user) => sum + user.totalDays, 0),
    };
  }

  // Same report as getSummary(), rendered as CSV instead of JSON. Without
  // includeDetails this is a pivot, one row per person with a column per
  // leave type, matching how getSummary() already shapes byLeaveType.
  // With includeDetails it switches to one row per individual leave
  // request instead, since a pivot cannot show individual date ranges,
  // followed by a Total row per person and a Grand Total when the report
  // covers more than one person.
  async getSummaryCsv(
    query: QueryLeaveSummaryDto,
  ): Promise<{ filename: string; content: string }> {
    const summary = await this.getSummary(query);
    const filename = `leave-summary-${summary.startDate}_${summary.endDate}.csv`;

    if (query.includeDetails) {
      const rows: Array<Array<string | number>> = [
        ['Name', 'Role', 'Leave Type', 'Start Date', 'End Date', 'Days'],
      ];
      for (const user of summary.users) {
        for (const request of user.requests ?? []) {
          rows.push([
            user.name,
            user.role.label,
            request.leaveType,
            request.startDate,
            request.endDate,
            request.days,
          ]);
        }
        rows.push([`Total, ${user.name}`, '', '', '', '', user.totalDays]);
      }
      if (summary.users.length > 1) {
        rows.push(['Grand Total', '', '', '', '', summary.grandTotalDays]);
      }
      return { filename, content: toCsv(rows) };
    }

    const leaveTypeNames = summary.leaveTypes.map(
      (leaveType) => leaveType.name,
    );
    const rows: Array<Array<string | number>> = [
      ['Name', 'Email', 'Role', ...leaveTypeNames, 'Total'],
    ];
    for (const user of summary.users) {
      rows.push([
        user.name,
        user.email,
        user.role.label,
        ...leaveTypeNames.map((name) => user.byLeaveType[name] ?? 0),
        user.totalDays,
      ]);
    }
    rows.push([
      'Total',
      '',
      '',
      ...leaveTypeNames.map((name) =>
        summary.users.reduce(
          (sum, user) => sum + (user.byLeaveType[name] ?? 0),
          0,
        ),
      ),
      summary.grandTotalDays,
    ]);
    return { filename, content: toCsv(rows) };
  }

  private async findPending(id: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });
    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }
    if (leaveRequest.status !== 'PENDING') {
      throw new ConflictException('Leave request has already been reviewed');
    }
    return leaveRequest;
  }

  async approve(id: string, actorId: string) {
    const leaveRequest = await this.findPending(id);

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
      include: { leaveType: true },
    });

    await this.leaveBalances.incrementUsedDays(
      leaveRequest.userId,
      leaveRequest.leaveTypeId,
      leaveRequest.startDate.getFullYear(),
      leaveRequest.days,
    );

    await this.auditLog.log({
      userId: actorId,
      action: 'leave.approved',
      targetType: 'LeaveRequest',
      targetId: id,
    });

    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: leaveRequest.userId },
      select: { id: true, name: true, role: true },
    });
    await this.notificationsService.notify({
      userId: leaveRequest.userId,
      type: NotificationType.LEAVE_REQUEST_APPROVED,
      title: 'Your leave request was approved',
      metadata: { leaveRequestId: id },
    });

    // Only when the requester is a Developer/Designer: every PM currently
    // staffed on any project that developer is currently staffed on, so
    // they can plan coverage. Resolved as an open question in
    // docs/features/notifications/DESIGN.md: an approval may need
    // staffing action, a rejection changes nothing so gets no PM
    // notification at all (see reject() below).
    if (requester.role === Role.DEVELOPER || requester.role === Role.DESIGNER) {
      const activeProjectIds = await this.prisma.projectMember.findMany({
        where: { userId: leaveRequest.userId, leftAt: null },
        select: { projectId: true },
        distinct: ['projectId'],
      });
      const recipientIdsByProject = await Promise.all(
        activeProjectIds.map((member) =>
          this.notificationsService.resolveManagingPmAndAdminIds(
            member.projectId,
          ),
        ),
      );
      const recipientIds = [...new Set(recipientIdsByProject.flat())].filter(
        (recipientId) =>
          recipientId !== leaveRequest.userId && recipientId !== actorId,
      );
      await Promise.all(
        recipientIds.map((recipientId) =>
          this.notificationsService.notify({
            userId: recipientId,
            type: NotificationType.LEAVE_REQUEST_APPROVED,
            title: `${requester.name}'s leave request was approved`,
            metadata: { leaveRequestId: id, userId: leaveRequest.userId },
          }),
        ),
      );
    }

    return toLeaveRequestResponse(updated, {
      callerId: actorId,
      canReviewLeave: true,
    });
  }

  // Only the requester can cancel their own request, and only while it's
  // still PENDING. Once an ADMIN has reviewed it, use reject/approve instead.
  async cancel(id: string, userId: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });
    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }
    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException(
        'You can only cancel your own leave request',
      );
    }
    if (leaveRequest.status !== 'PENDING') {
      throw new ConflictException(
        'Only a pending leave request can be cancelled',
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { leaveType: true },
    });

    await this.auditLog.log({
      userId,
      action: 'leave.cancelled',
      targetType: 'LeaveRequest',
      targetId: id,
    });

    return toLeaveRequestResponse(updated, {
      callerId: userId,
      canReviewLeave: false,
    });
  }

  async reject(id: string, dto: RejectLeaveRequestDto, actorId: string) {
    await this.findPending(id);

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
      include: { leaveType: true },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'leave.rejected',
      targetType: 'LeaveRequest',
      targetId: id,
      metadata: dto.reason ? { reason: dto.reason } : undefined,
    });

    // Requester only, never any PM, a rejection changes nothing about the
    // requester's availability so there is nothing for a PM to act on. See
    // the same resolved open question referenced in approve() above.
    await this.notificationsService.notify({
      userId: updated.userId,
      type: NotificationType.LEAVE_REQUEST_REJECTED,
      title: 'Your leave request was rejected',
      message: dto.reason,
      metadata: { leaveRequestId: id },
    });

    return toLeaveRequestResponse(updated, {
      callerId: actorId,
      canReviewLeave: true,
    });
  }
}
