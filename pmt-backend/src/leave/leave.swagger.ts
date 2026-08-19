import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import {
  commonErrors,
  conflict,
  gatedErrors,
  notFound,
} from '@/common/swagger/error-sets';
import {
  HolidayResponseDto,
  LeaveBalanceResponseDto,
  LeaveRequestResponseDto,
  LeaveSummaryResponseDto,
  LeaveTypeResponseDto,
  PaginatedLeaveRequestsResponseDto,
} from '@/leave/dto/leave.dto';
import { MessageResponseDto } from '@/users/dto/user.dto';

/**
 * Documentation for all three controllers LeaveModule owns: leave requests,
 * leave types and holidays. One file per module, matching the module boundary
 * rather than the controller count.
 */

const idParam = (name: string, description: string) =>
  ApiParam({ name, description });

// ── Leave requests ───────────────────────────────────────────────────────────

export const ApiRequestLeaveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request leave',
      description:
        'Always created PENDING, even when it exceeds the remaining balance. Balance ' +
        'is a record rather than a gate, and is only touched at approval time. days is ' +
        'computed inclusive of both endpoints, so a single day request is one day.',
    }),
    ApiResponse({
      status: 201,
      description: 'The pending request',
      type: LeaveRequestResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiListOwnLeaveDocs = () =>
  applyDecorators(
    ApiOperation({ summary: "List the caller's own leave requests" }),
    ApiResponse({
      status: 200,
      description: 'Paginated, newest first',
      type: [LeaveRequestResponseDto],
    }),
    ...commonErrors,
  );

export const ApiGetOwnLeaveBalanceDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get the caller's own leave balance for the current year",
      description:
        'Balance rows are lazy get-or-create per (user, leave type, year), seeded from ' +
        "the leave type's default. There is no year end carry forward: a new year " +
        'starts fresh.',
    }),
    ApiResponse({
      status: 200,
      description: 'Balance per leave type',
      type: [LeaveBalanceResponseDto],
    }),
    ...commonErrors,
  );

export const ApiGetUserLeaveBalanceDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get another user's leave balance for the current year",
    }),
    idParam('userId', 'The user id'),
    ApiResponse({
      status: 200,
      description: 'Balance per leave type',
      type: [LeaveBalanceResponseDto],
    }),
    ...gatedErrors,
    notFound('User not found'),
  );

export const ApiCancelOwnLeaveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Cancel your own pending leave request',
      description:
        'Ownership and status are both checked in the service, not only at the route. ' +
        'Only the requester may cancel, and only while it is still PENDING.',
    }),
    idParam('id', 'The leave request id'),
    ApiResponse({
      status: 200,
      description: 'The cancelled request',
      type: LeaveRequestResponseDto,
    }),
    ...gatedErrors,
    notFound('Leave request not found'),
    conflict('Already reviewed, so it can no longer be cancelled'),
  );

export const ApiListLeaveRequestsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List leave requests',
      description:
        'Scope differs by role. An ADMIN sees every request whatever its status; a ' +
        'PROJECT_MANAGER is filtered server side to PENDING and APPROVED only, via an ' +
        'allowlist rather than a denylist, so any status added to the enum later is ' +
        'excluded by default rather than leaking.',
    }),
    ApiResponse({
      status: 200,
      description: 'Paginated, newest first',
      type: PaginatedLeaveRequestsResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiLeaveSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Leave summary report',
      description:
        'Aggregated days taken per user and leave type over a range.',
    }),
    ApiResponse({
      status: 200,
      description: 'The summary',
      type: LeaveSummaryResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiLeaveSummaryCsvDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Leave summary report as a CSV file',
      description:
        'The same numbers as the JSON summary, served as a download with a ' +
        'Content-Disposition filename.',
    }),
    ApiProduces('text/csv'),
    ApiResponse({
      status: 200,
      description: 'A CSV file',
      // Not a DTO: this route sets text/csv and streams a string. Declaring a
      // schema here would tell a client to parse JSON out of a spreadsheet.
      content: {
        'text/csv': { schema: { type: 'string', format: 'binary' } },
      },
    }),
    ...gatedErrors,
  );

export const ApiApproveLeaveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Approve a pending leave request',
      description:
        'The only place a balance is ever incremented. usedDays goes up by exactly the ' +
        "request's days, against the year the leave STARTS in.",
    }),
    idParam('id', 'The leave request id'),
    ApiResponse({
      status: 200,
      description: 'The approved request',
      type: LeaveRequestResponseDto,
    }),
    ...gatedErrors,
    notFound('Leave request not found'),
    conflict('Not pending, so it cannot be reviewed again'),
  );

export const ApiRejectLeaveDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reject a pending leave request',
      description:
        'Leaves the balance completely untouched. Only the requester is notified: a ' +
        'rejection changes nothing about their availability, so no PM is told.',
    }),
    idParam('id', 'The leave request id'),
    ApiResponse({
      status: 200,
      description: 'The rejected request',
      type: LeaveRequestResponseDto,
    }),
    ...gatedErrors,
    notFound('Leave request not found'),
    conflict('Not pending, so it cannot be reviewed again'),
  );

// ── Leave types ──────────────────────────────────────────────────────────────

export const ApiListLeaveTypesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List leave types',
      description:
        'ADMIN managed reference data. Everyone reads it, because requesting leave ' +
        'needs the list. defaultDaysPerYear seeds a new balance row.',
    }),
    ApiResponse({
      status: 200,
      description: 'Every leave type',
      type: [LeaveTypeResponseDto],
    }),
    ...commonErrors,
  );

export const ApiCreateLeaveTypeDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a leave type' }),
    ApiResponse({
      status: 201,
      description: 'The created leave type',
      type: LeaveTypeResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiUpdateLeaveTypeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a leave type',
      description:
        'Changing defaultDaysPerYear affects balance rows created afterwards, not ones ' +
        'that already exist.',
    }),
    idParam('id', 'The leave type id'),
    ApiResponse({
      status: 200,
      description: 'The updated leave type',
      type: LeaveTypeResponseDto,
    }),
    ...gatedErrors,
    notFound('Leave type not found'),
  );

export const ApiDeleteLeaveTypeDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a leave type' }),
    idParam('id', 'The leave type id'),
    ApiResponse({
      status: 200,
      description: 'Deleted',
      type: MessageResponseDto,
    }),
    ...gatedErrors,
    notFound('Leave type not found'),
    conflict('Still referenced by existing leave requests or balances'),
  );

// ── Holidays ─────────────────────────────────────────────────────────────────

export const ApiListHolidaysDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List company holidays',
      description:
        'A holiday models a RANGE, with startDate equal to endDate for a single day, ' +
        'rather than one row per day. days is computed inclusive on the way out.',
    }),
    ApiResponse({
      status: 200,
      description: 'Every holiday',
      type: [HolidayResponseDto],
    }),
    ...commonErrors,
  );

export const ApiCreateHolidayDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a company holiday',
      description:
        'Only startDate is required; an omitted endDate defaults to it.',
    }),
    ApiResponse({
      status: 201,
      description: 'The created holiday',
      type: HolidayResponseDto,
    }),
    ...gatedErrors,
    conflict('A holiday with the same name already starts on that date'),
  );

export const ApiUpdateHolidayDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a company holiday' }),
    idParam('id', 'The holiday id'),
    ApiResponse({
      status: 200,
      description: 'The updated holiday',
      type: HolidayResponseDto,
    }),
    ...gatedErrors,
    notFound('Holiday not found'),
  );

export const ApiDeleteHolidayDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete a company holiday' }),
    idParam('id', 'The holiday id'),
    ApiResponse({
      status: 200,
      description: 'Deleted',
      type: MessageResponseDto,
    }),
    ...gatedErrors,
    notFound('Holiday not found'),
  );
