import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  commonErrors,
  conflict,
  gatedErrors,
  notFound,
  projectScopedErrors,
} from '@/common/swagger/error-sets';
import {
  DailyProjectEntryResponseDto,
  DailyWorkReportResponseDto,
  PaginatedDailyWorkReportsResponseDto,
  PaginatedProjectDailyEntriesResponseDto,
} from '@/projects/daily-work-reports/dto/daily-work-report.dto';

/**
 * Documentation for both controllers DailyWorkReportsModule owns.
 *
 * Two controllers on purpose: a report spans several projects at once so it
 * cannot be nested under a project, while the PM view of one project's entries
 * must be.
 */

const reportIdParam = ApiParam({
  name: 'reportId',
  description: 'The daily work report id',
});

export const ApiSubmitPlanDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Submit today's plan",
      description:
        'One report per person per day, spanning however many projects they touch, each ' +
        'as its own entry. The day is the UTC calendar day, not local: in UTC+6 that ' +
        'means the day rolls over at 6am local, so submitting between midnight and 6am ' +
        'is dated the previous day.',
    }),
    ApiResponse({
      status: 201,
      description: 'The report, now PLAN_SUBMITTED',
      type: DailyWorkReportResponseDto,
    }),
    ...gatedErrors,
    conflict('A report already exists for today'),
  );

export const ApiUpdatePlanDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update the plan',
      description:
        'Editable with NO time limit, but only while the report is still ' +
        'PLAN_SUBMITTED. Submitting the wrap up locks it. This window is entirely ' +
        'separate from the wrap up window below.',
    }),
    reportIdParam,
    ApiResponse({
      status: 200,
      description: 'The updated report',
      type: DailyWorkReportResponseDto,
    }),
    ...commonErrors,
    notFound('Report not found'),
    conflict('Locked, because the wrap up has been submitted'),
  );

export const ApiGetTodayReportDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Get the caller's report for today",
      description:
        'Answers whether a plan is already in, and what state it is in.',
    }),
    ApiResponse({
      status: 200,
      description: "Today's report, or null",
      type: DailyWorkReportResponseDto,
    }),
    ...commonErrors,
  );

export const ApiListWorkReportsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List daily work reports across projects',
      description:
        'Answers "show me this person\'s reports". Self scoped for a DEVELOPER or ' +
        'DESIGNER, who get a 403 asking for someone else; a PM or admin may pass any ' +
        'userId. Filter with type=PLAN or type=WRAP_UP for entries that have only one ' +
        'or the other.',
    }),
    ApiQuery({ name: 'type', required: false, enum: ['PLAN', 'WRAP_UP'] }),
    ApiResponse({
      status: 200,
      description: 'Paginated reports',
      type: PaginatedDailyWorkReportsResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiSubmitWrapUpDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Submit the wrap up',
      description:
        'A plan is mandatory first: wrapping up a day that was never planned is a 409. ' +
        'The wrap up MAY include a project that was not in the morning plan, for ' +
        'unplanned or urgent work; such an entry simply has a null plan.',
    }),
    reportIdParam,
    ApiResponse({
      status: 201,
      description: 'The report, now COMPLETED',
      type: DailyWorkReportResponseDto,
    }),
    ...commonErrors,
    notFound('Report not found'),
    conflict('The plan has not been submitted yet'),
  );

export const ApiUpdateWrapUpDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update the wrap up',
      description:
        'Editable for two hours after submission, then locked for audit. Time based, ' +
        'unlike the plan window, which is state based and has no clock.',
    }),
    reportIdParam,
    ApiResponse({
      status: 200,
      description: 'The updated report',
      type: DailyWorkReportResponseDto,
    }),
    ...commonErrors,
    notFound('Report not found'),
    conflict('The two hour edit window has closed'),
  );

export const ApiReviewWorkReportEntryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Review one project entry's wrap up",
      description:
        "Scoped to a PM actively staffed on THAT entry's project, and only once the " +
        'report is COMPLETED. A review touches that single entry, never the rest of the ' +
        'report.',
    }),
    ApiParam({ name: 'reportId', description: 'The daily work report id' }),
    ApiParam({
      name: 'entryId',
      description: 'The project entry id within it',
    }),
    ApiResponse({
      status: 200,
      description: 'The reviewed entry',
      type: DailyProjectEntryResponseDto,
    }),
    ...gatedErrors,
    notFound('Report or entry not found'),
    conflict('The report is not complete yet'),
  );

export const ApiListProjectWorkReportsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's daily plan and wrap up entries",
      description:
        'Answers "who reported what on this project", the counterpart to the cross ' +
        'project list.',
    }),
    ApiParam({ name: 'projectId', description: 'The project id' }),
    ApiResponse({
      status: 200,
      description: 'Paginated entries',
      type: PaginatedProjectDailyEntriesResponseDto,
    }),
    ...projectScopedErrors,
  );
