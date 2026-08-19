import { LeaveStatus } from '@prisma/client';

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
