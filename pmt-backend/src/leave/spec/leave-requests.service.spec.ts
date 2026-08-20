/**
 * Unit tests for the leave approval arithmetic.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * The invariant: balance is touched at APPROVAL time only. A request is always
 * created PENDING even when it exceeds the remaining balance, approve()
 * increments usedDays, and reject() must leave the balance completely alone.
 * Getting that wrong silently corrupts everyone's remaining leave.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PermissionsService } from '@/auth/permissions/permissions.service';
import { LeaveBalancesService } from '@/leave/requests/leave-balances.service';
import { LeaveRequestsService } from '@/leave/requests/leave-requests.service';

const REQUEST_ID = 'leave-1';
const REQUESTER_ID = 'dev-1';
const LEAVE_TYPE_ID = 'annual';
const ACTOR_ID = 'admin-1';

function pendingRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: REQUEST_ID,
    userId: REQUESTER_ID,
    leaveTypeId: LEAVE_TYPE_ID,
    status: 'PENDING',
    days: 3,
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-06-03'),
    ...overrides,
  };
}

describe('LeaveRequestsService: balance arithmetic on review', () => {
  let service: LeaveRequestsService;
  let prisma: {
    leaveRequest: { findUnique: jest.Mock; update: jest.Mock };
    user: { findUniqueOrThrow: jest.Mock };
    projectMember: { findMany: jest.Mock };
  };
  let leaveBalances: { incrementUsedDays: jest.Mock };
  let auditLog: { log: jest.Mock };
  let notifications: {
    notify: jest.Mock;
    resolveManagingPmAndAdminIds: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        findUnique: jest.fn().mockResolvedValue(pendingRequest()),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ ...pendingRequest(), ...data }),
          ),
      },
      // A CLIENT-free staff role keeps the PM fan out branch out of the way
      // unless a test opts into it.
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: REQUESTER_ID, role: Role.PROJECT_MANAGER }),
      },
      projectMember: { findMany: jest.fn().mockResolvedValue([]) },
    };
    leaveBalances = {
      incrementUsedDays: jest.fn().mockResolvedValue(undefined),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    notifications = {
      notify: jest.fn().mockResolvedValue(undefined),
      resolveManagingPmAndAdminIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: LeaveBalancesService, useValue: leaveBalances },
        { provide: NotificationsService, useValue: notifications },
        // The real one: it is a pure lookup over ROLE_PERMISSIONS with no
        // dependencies, and mocking it would let the capability flags below
        // assert against a fiction rather than against the permission map.
        PermissionsService,
      ],
    }).compile();

    service = module.get(LeaveRequestsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('approve', () => {
    it('increments usedDays by exactly the requested days', async () => {
      await service.approve(REQUEST_ID, ACTOR_ID);
      expect(leaveBalances.incrementUsedDays).toHaveBeenCalledTimes(1);
      expect(leaveBalances.incrementUsedDays).toHaveBeenCalledWith(
        REQUESTER_ID,
        LEAVE_TYPE_ID,
        2026,
        3,
      );
    });

    it('attributes the balance to the year the leave STARTS in', async () => {
      // A request spanning a year boundary counts against the starting year.
      // Splitting it across two balances is not what the service does, and a
      // test that assumed otherwise would mask a real change here.
      prisma.leaveRequest.findUnique.mockResolvedValue(
        pendingRequest({
          startDate: new Date('2026-12-30'),
          endDate: new Date('2027-01-02'),
          days: 4,
        }),
      );
      await service.approve(REQUEST_ID, ACTOR_ID);
      expect(leaveBalances.incrementUsedDays).toHaveBeenCalledWith(
        REQUESTER_ID,
        LEAVE_TYPE_ID,
        2026,
        4,
      );
    });

    it('marks the request APPROVED and records who reviewed it', async () => {
      await service.approve(REQUEST_ID, ACTOR_ID);
      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: REQUEST_ID },
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewedById: ACTOR_ID,
          }),
        }),
      );
    });

    it('writes a leave.approved audit row', async () => {
      await service.approve(REQUEST_ID, ACTOR_ID);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'leave.approved',
          targetId: REQUEST_ID,
        }),
      );
    });

    it('notifies the requester', async () => {
      await service.approve(REQUEST_ID, ACTOR_ID);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: REQUESTER_ID }),
      );
    });

    it('approves a request that exceeds the remaining balance', async () => {
      // Balance is never checked at creation OR at approval. It is a record,
      // not a gate. Adding a check here would be a product change.
      prisma.leaveRequest.findUnique.mockResolvedValue(
        pendingRequest({ days: 999 }),
      );
      await expect(
        service.approve(REQUEST_ID, ACTOR_ID),
      ).resolves.toBeDefined();
      expect(leaveBalances.incrementUsedDays).toHaveBeenCalledWith(
        REQUESTER_ID,
        LEAVE_TYPE_ID,
        2026,
        999,
      );
    });
  });

  describe('reject', () => {
    it('does NOT touch the balance', async () => {
      // The whole point of the invariant. A rejected request consumed nothing.
      await service.reject(REQUEST_ID, {}, ACTOR_ID);
      expect(leaveBalances.incrementUsedDays).not.toHaveBeenCalled();
    });

    it('marks the request REJECTED and records who reviewed it', async () => {
      await service.reject(REQUEST_ID, {}, ACTOR_ID);
      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: REQUEST_ID },
          data: expect.objectContaining({
            status: 'REJECTED',
            reviewedById: ACTOR_ID,
          }),
        }),
      );
    });

    it('writes a leave.rejected audit row, carrying the reason when given', async () => {
      await service.reject(
        REQUEST_ID,
        { reason: 'Team is short staffed' },
        ACTOR_ID,
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'leave.rejected',
          metadata: { reason: 'Team is short staffed' },
        }),
      );
    });

    it('omits metadata entirely when no reason was given', async () => {
      await service.reject(REQUEST_ID, {}, ACTOR_ID);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: undefined }),
      );
    });

    it('notifies the requester and nobody else', async () => {
      // A rejection changes nothing about availability, so no PM is told.
      await service.reject(REQUEST_ID, {}, ACTOR_ID);
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: REQUESTER_ID }),
      );
    });
  });

  describe('reviewing a request that is not PENDING', () => {
    it('refuses to approve, and leaves the balance untouched', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(
        pendingRequest({ status: 'APPROVED' }),
      );
      await expect(service.approve(REQUEST_ID, ACTOR_ID)).rejects.toThrow();
      expect(leaveBalances.incrementUsedDays).not.toHaveBeenCalled();
    });

    it('refuses to approve a request that does not exist', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(service.approve(REQUEST_ID, ACTOR_ID)).rejects.toThrow();
      expect(leaveBalances.incrementUsedDays).not.toHaveBeenCalled();
    });

    it('refuses to reject a request that is already CANCELLED', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(
        pendingRequest({ status: 'CANCELLED' }),
      );
      await expect(service.reject(REQUEST_ID, {}, ACTOR_ID)).rejects.toThrow();
    });
  });
});

describe('LeaveRequestsService.findAll capability flags', () => {
  let service: LeaveRequestsService;
  let prisma: {
    leaveRequest: { findMany: jest.Mock; count: jest.Mock };
  };

  const listed = {
    ...pendingRequest(),
    leaveType: { id: LEAVE_TYPE_ID, name: 'Annual' },
    user: {
      id: REQUESTER_ID,
      name: 'Dev One',
      email: 'dev@pixelvega.com',
      role: Role.DEVELOPER,
    },
    reviewedBy: null,
  };

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        findMany: jest.fn().mockResolvedValue([listed]),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        {
          provide: LeaveBalancesService,
          useValue: { incrementUsedDays: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn(),
            resolveManagingPmAndAdminIds: jest.fn().mockResolvedValue([]),
          },
        },
        PermissionsService,
      ],
    }).compile();

    service = module.get(LeaveRequestsService);
  });

  it.each([
    [Role.SYSTEM_ADMIN, true],
    [Role.ADMIN, true],
    // The bug this pins. PROJECT_MANAGER holds VIEW_LEAVE_REQUESTS, which is
    // what reaches this listing, but NOT REVIEW_LEAVE_REQUEST, which is what
    // gates PATCH /approve and /reject. The context used to be hardcoded
    // `canReviewLeave: true`, so a project manager was shown an Approve button
    // on every pending request and the route answered 403.
    [Role.PROJECT_MANAGER, false],
  ])('canApprove/canReject for %s is %s', async (role, expected) => {
    const result = await service.findAll(role, {}, 'caller-1');

    expect(result.items[0].capabilities.canApprove).toBe(expected);
    expect(result.items[0].capabilities.canReject).toBe(expected);
  });

  it('still refuses self review, whatever the permission says', async () => {
    // An ADMIN who submitted the request cannot approve their own.
    const result = await service.findAll(Role.ADMIN, {}, REQUESTER_ID);

    expect(result.items[0].capabilities.canApprove).toBe(false);
    expect(result.items[0].capabilities.canReject).toBe(false);
  });
});

describe('LeaveRequestsService.findAll status filtering', () => {
  /**
   * The `status` query param NARROWS what a role may see. It must never widen
   * it.
   *
   * A PROJECT_MANAGER is restricted to PENDING and APPROVED: they can approve
   * leave but must not learn that somebody's was turned down, which is the
   * requester's business and the admin's. The restriction and the filter both
   * write `status`, so spreading the filter after the role clause silently
   * overwrites it and `?status=REJECTED` becomes a privilege escalation with a
   * query string for a key.
   *
   * These cases assert the WHERE clause the service builds, because that is
   * where the rule lives. Asserting the returned rows would pass against a
   * mock that ignores the clause entirely.
   */
  let service: LeaveRequestsService;
  let prisma: { leaveRequest: { findMany: jest.Mock; count: jest.Mock } };

  const whereFrom = () =>
    (prisma.leaveRequest.findMany.mock.calls[0][0] as { where: unknown }).where;

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        {
          provide: LeaveBalancesService,
          useValue: { incrementUsedDays: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn(),
            resolveManagingPmAndAdminIds: jest.fn().mockResolvedValue([]),
          },
        },
        PermissionsService,
      ],
    }).compile();

    service = module.get(LeaveRequestsService);
  });

  it('keeps a project manager to pending and approved when no status is asked for', async () => {
    await service.findAll(Role.PROJECT_MANAGER, {}, 'pm-1');

    expect(whereFrom()).toMatchObject({
      status: { in: ['PENDING', 'APPROVED'] },
    });
  });

  it('lets a project manager narrow to pending', async () => {
    await service.findAll(Role.PROJECT_MANAGER, { status: 'PENDING' }, 'pm-1');

    expect(whereFrom()).toMatchObject({ status: { in: ['PENDING'] } });
  });

  it('MATCHES NOTHING when a project manager asks for rejected', async () => {
    // The escalation this exists to stop. An overwriting spread would produce
    // `{ status: 'REJECTED' }` here and hand over exactly the withheld rows.
    await service.findAll(Role.PROJECT_MANAGER, { status: 'REJECTED' }, 'pm-1');

    expect(whereFrom()).toMatchObject({ status: { in: [] } });
  });

  it('lets an admin filter to rejected, because nothing is withheld from them', async () => {
    await service.findAll(Role.ADMIN, { status: 'REJECTED' }, 'a-1');

    expect(whereFrom()).toMatchObject({ status: 'REJECTED' });
  });

  it('places no status clause at all for an admin who asked for none', async () => {
    await service.findAll(Role.ADMIN, {}, 'a-1');

    expect('status' in (whereFrom() as object)).toBe(false);
  });

  it('combines the user and leave type filters with the status rule', async () => {
    await service.findAll(
      Role.PROJECT_MANAGER,
      { userId: 'dev-9', leaveTypeId: 'annual', status: 'APPROVED' },
      'pm-1',
    );

    expect(whereFrom()).toEqual({
      status: { in: ['APPROVED'] },
      userId: 'dev-9',
      leaveTypeId: 'annual',
    });
  });
});
