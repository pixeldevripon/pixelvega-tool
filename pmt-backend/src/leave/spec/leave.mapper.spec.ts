import { LeaveStatus, Role } from '@prisma/client';

import {
  LeaveRequestWithRelations,
  toHolidayResponse,
  toLeaveRequestResponse,
} from '@/leave/leave.mapper';

const REQUESTER = 'u1';
const REVIEWER = 'u2';
const AT = new Date('2026-08-01T09:00:00.000Z');

function request(
  overrides: Partial<LeaveRequestWithRelations> = {},
): LeaveRequestWithRelations {
  return {
    id: 'l1',
    userId: REQUESTER,
    leaveTypeId: 'lt1',
    startDate: new Date('2026-08-10T00:00:00.000Z'),
    endDate: new Date('2026-08-12T00:00:00.000Z'),
    days: 3,
    reason: 'Family event',
    status: LeaveStatus.PENDING,
    reviewedById: null,
    reviewedAt: null,
    createdAt: AT,
    updatedAt: AT,
    leaveType: {
      id: 'lt1',
      name: 'Annual Leave',
      defaultDaysPerYear: 15,
      createdAt: AT,
      updatedAt: AT,
    },
    reviewedBy: null,
    ...overrides,
  };
}

const AS_REVIEWER = { callerId: REVIEWER, canReviewLeave: true };
const AS_REQUESTER = { callerId: REQUESTER, canReviewLeave: false };

describe('toLeaveRequestResponse', () => {
  it('renders both dates as calendar days', () => {
    const result = toLeaveRequestResponse(request(), AS_REVIEWER);
    expect(result.startDate).toBe('2026-08-10');
    expect(result.endDate).toBe('2026-08-12');
  });

  it('returns status as a display object', () => {
    expect(toLeaveRequestResponse(request(), AS_REVIEWER).status).toEqual({
      value: 'PENDING',
      label: 'Pending',
      tone: 'warning',
    });
  });

  describe('capabilities', () => {
    it('lets a reviewer approve or reject a pending request', () => {
      expect(
        toLeaveRequestResponse(request(), AS_REVIEWER).capabilities,
      ).toEqual({
        canApprove: true,
        canReject: true,
        canCancel: false,
      });
    });

    it('lets the requester cancel their own, and nothing else', () => {
      expect(
        toLeaveRequestResponse(request(), AS_REQUESTER).capabilities,
      ).toEqual({
        canApprove: false,
        canReject: false,
        canCancel: true,
      });
    });

    it('refuses to let a reviewer approve their own leave', () => {
      // Holding the permission is not the same as being allowed to use it on
      // yourself.
      const own = request({ userId: REVIEWER });
      expect(toLeaveRequestResponse(own, AS_REVIEWER).capabilities).toEqual({
        canApprove: false,
        canReject: false,
        canCancel: true,
      });
    });

    it('closes every action once a decision has been made', () => {
      for (const status of [
        LeaveStatus.APPROVED,
        LeaveStatus.REJECTED,
        LeaveStatus.CANCELLED,
      ]) {
        const decided = toLeaveRequestResponse(
          request({ status }),
          AS_REVIEWER,
        );
        expect(decided.capabilities).toEqual({
          canApprove: false,
          canReject: false,
          canCancel: false,
        });
        expect(decided.isPending).toBe(false);
      }
    });

    it('withholds review from someone without the permission', () => {
      const result = toLeaveRequestResponse(request(), {
        callerId: REVIEWER,
        canReviewLeave: false,
      });
      expect(result.capabilities.canApprove).toBe(false);
    });
  });
});

describe('toHolidayResponse', () => {
  const holiday = {
    id: 'h1',
    name: 'Eid-ul-Fitr',
    startDate: new Date('2026-03-19T00:00:00.000Z'),
    endDate: new Date('2026-03-21T00:00:00.000Z'),
    createdAt: AT,
    updatedAt: AT,
  };

  it('counts days inclusively, so a three day holiday is 3', () => {
    expect(toHolidayResponse(holiday, AT).days).toBe(3);
  });

  it('counts a single day holiday as 1, not 0', () => {
    const single = {
      ...holiday,
      endDate: new Date('2026-03-19T00:00:00.000Z'),
    };
    expect(toHolidayResponse(single, AT).days).toBe(1);
  });

  it('answers isUpcoming against the given moment', () => {
    expect(
      toHolidayResponse(holiday, new Date('2026-01-01T00:00:00.000Z'))
        .isUpcoming,
    ).toBe(true);
    expect(
      toHolidayResponse(holiday, new Date('2026-06-01T00:00:00.000Z'))
        .isUpcoming,
    ).toBe(false);
  });

  it('renders the dates as calendar days', () => {
    const result = toHolidayResponse(holiday, AT);
    expect(result.startDate).toBe('2026-03-19');
    expect(result.endDate).toBe('2026-03-21');
  });
});

describe('the person on a leave request', () => {
  /**
   * The mapper used to spread the raw row: `...(request.user && { user:
   * request.user })`. That shipped an undeclared `role` as the bare string
   * "DEVELOPER" for as long as the query happened to select it, and a screen
   * reading `.label` off it rendered nothing. Response DTOs are not validated at
   * runtime, so only a case like this catches it.
   */
  const base = {
    id: 'lr1',
    userId: 'u1',
    leaveTypeId: 'lt1',
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-09-03T00:00:00.000Z'),
    reason: null,
    status: LeaveStatus.PENDING,
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    leaveType: {
      id: 'lt1',
      name: 'Annual Leave',
      defaultDaysPerYear: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as unknown as LeaveRequestWithRelations;

  const context = { callerId: 'someone-else', canReviewLeave: true };

  it('renders the requester role as a display object, never a bare enum', () => {
    const response = toLeaveRequestResponse(
      {
        ...base,
        user: {
          id: 'u1',
          name: 'Sharmin Miller',
          email: 'sharmin@pixelvega.com',
          role: Role.DEVELOPER,
        },
      },
      context,
    );

    expect(response.user?.role).toEqual({
      value: 'DEVELOPER',
      label: expect.any(String),
      tone: expect.any(String),
    });
    // The label is what a screen prints, so it must not be the raw value.
    expect(response.user?.role?.label).not.toBe('DEVELOPER');
  });

  it('omits the role entirely when the query did not select one', () => {
    // Absent means "not asked for", never "has no role". Emitting a display
    // object built from undefined would print an empty badge instead.
    const response = toLeaveRequestResponse(
      {
        ...base,
        user: { id: 'u1', name: 'Sharmin Miller', email: 's@x.com' },
      },
      context,
    );

    expect(response.user).toEqual({
      id: 'u1',
      name: 'Sharmin Miller',
      email: 's@x.com',
    });
    expect('role' in (response.user as object)).toBe(false);
  });

  it('emits no field the DTO does not declare', () => {
    // The defect this whole block exists for. A spread mapper cannot say what
    // it returns, so an extra column in the select becomes an extra field in
    // the response.
    const response = toLeaveRequestResponse(
      {
        ...base,
        user: {
          id: 'u1',
          name: 'Sharmin Miller',
          email: 's@x.com',
          role: Role.DEVELOPER,
          password: 'a-real-bcrypt-hash',
          slackUserId: 'U123',
        },
      } as unknown as LeaveRequestWithRelations,
      context,
    );

    expect(Object.keys(response.user as object).sort()).toEqual([
      'email',
      'id',
      'name',
      'role',
    ]);
  });

  it('maps the reviewer the same way as the requester', () => {
    const response = toLeaveRequestResponse(
      {
        ...base,
        status: LeaveStatus.APPROVED,
        reviewedBy: {
          id: 'admin1',
          name: 'Ada Admin',
          email: 'ada@pixelvega.com',
          role: Role.ADMIN,
        },
      },
      context,
    );

    expect(response.reviewedBy?.role?.value).toBe('ADMIN');
    expect(Object.keys(response.reviewedBy as object).sort()).toEqual([
      'email',
      'id',
      'name',
      'role',
    ]);
  });
});
