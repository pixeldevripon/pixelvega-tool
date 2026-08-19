import {
  Holiday,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  Role,
  User,
} from '@prisma/client';

import { daysBetweenInclusive } from '@/common/utils/date.util';
import {
  LEAVE_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

import { HolidayResponseDto, LeaveRequestResponseDto } from './dto/leave.dto';

type LeaveUser = Pick<User, 'id' | 'name' | 'email'>;

export type LeaveRequestWithRelations = LeaveRequest & {
  user?: LeaveUser;
  leaveType: LeaveType;
  reviewedBy?: LeaveUser | null;
};

export type LeaveContext = {
  callerId: string;
  /** May this caller review leave at all? From the permission set. */
  canReviewLeave: boolean;
};

/** A leave date is a calendar day and must not be rendered in a timezone. */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toLeaveRequestResponse(
  request: LeaveRequestWithRelations,
  context: LeaveContext,
): LeaveRequestResponseDto {
  const isPending = request.status === LeaveStatus.PENDING;
  const isRequester = request.userId === context.callerId;

  return {
    id: request.id,
    userId: request.userId,
    ...(request.user && { user: request.user }),
    leaveType: request.leaveType,
    startDate: toDateOnlyString(request.startDate),
    endDate: toDateOnlyString(request.endDate),
    days: request.days,
    reason: request.reason,
    status: toEnumDisplay(LEAVE_STATUS_DISPLAY, request.status),
    reviewedBy: request.reviewedBy ?? null,
    reviewedAt: request.reviewedAt,
    isPending,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    capabilities: {
      // A decision is only available while there is one to make, and nobody
      // reviews their own leave.
      canApprove: isPending && context.canReviewLeave && !isRequester,
      canReject: isPending && context.canReviewLeave && !isRequester,
      // Cancelling is the requester's alone, and that survives admin on
      // purpose: an admin who wants a request gone rejects it, which leaves a
      // reviewer on the record.
      canCancel: isPending && isRequester,
    },
  };
}

export function toHolidayResponse(
  holiday: Holiday,
  now: Date = new Date(),
): HolidayResponseDto {
  return {
    id: holiday.id,
    name: holiday.name,
    startDate: toDateOnlyString(holiday.startDate),
    endDate: toDateOnlyString(holiday.endDate),
    // The existing tested util, not a second implementation: it already
    // covers the leap day and the DST shift.
    days: daysBetweenInclusive(holiday.startDate, holiday.endDate),
    isUpcoming: holiday.startDate.getTime() > now.getTime(),
    createdAt: holiday.createdAt,
    updatedAt: holiday.updatedAt,
  };
}
