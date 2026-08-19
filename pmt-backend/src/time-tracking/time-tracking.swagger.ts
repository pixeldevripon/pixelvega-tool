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
  ActiveTimeEntryResponseDto,
  CombinedDailySummaryResponseDto,
  DailySummaryResponseDto,
  MeetingTimeEntryResponseDto,
  PaginatedMeetingTimeEntriesResponseDto,
  PaginatedTimeEntriesResponseDto,
  TimeEntryResponseDto,
  UserProjectSummaryResponseDto,
} from '@/time-tracking/dto/time-entry.dto';

/**
 * Documentation for both controllers TimeTrackingModule owns.
 *
 * The rule underneath all of it: a TimeEntry row is one running, paused or
 * stopped SEGMENT, not a whole session. Pausing closes a segment and resuming
 * inserts a new one carrying the same sessionId forward, so the history is
 * append only and a segment is never mutated back into a startable state.
 *
 * Only ONE timer of any kind may run per person at a time, and that rule is
 * global: across every project, and across both the project and meeting tables.
 */

const projectIdParam = ApiParam({
  name: 'projectId',
  description: 'The project id',
});
const entryIdParam = ApiParam({ name: 'id', description: 'The time entry id' });

const dateRangeQuery = [
  ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-08-01',
    description: 'Inclusive.',
  }),
  ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-08-19',
    description: 'Inclusive: the end day itself counts.',
  }),
];

/** Every start, pause, resume and stop can hit the one-timer rule or the cap. */
const timerErrors = [
  ...gatedErrors,
  notFound('Time entry not found'),
  conflict(
    'Another timer of some kind is already running, the entry was auto stopped after ' +
      'exceeding the nine hour cap or the end of the day it started on, or it is locked ' +
      'because that day has passed',
  ),
];

// ── Project time entries ─────────────────────────────────────────────────────

export const ApiListProjectTimeEntriesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's time entries",
      description:
        "Any active member of the project sees the whole team's entries by default, " +
        'deliberately not self scoped, matching the visibility documents and activities ' +
        'already have. Pass userId to narrow to one person. The response carries ' +
        'totalMinutes and totalHours summed over the same filters, not just the current ' +
        'page. This endpoint never triggers the lazy auto stop, so a forgotten timer can ' +
        'still read as RUNNING here until a write touches it.',
    }),
    projectIdParam,
    ApiQuery({ name: 'userId', required: false }),
    ...dateRangeQuery,
    ApiResponse({
      status: 200,
      description: 'Paginated entries plus totals',
      type: PaginatedTimeEntriesResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiProjectDailySummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Daily hours breakdown for a project',
      description:
        'Answers which developer worked how many hours on which day. Grouped by the ' +
        'calendar day each segment STARTED on: a segment straddling midnight is ' +
        'attributed entirely to its start day, a deliberate simplification.',
    }),
    projectIdParam,
    ...dateRangeQuery,
    ApiResponse({
      status: 200,
      description: 'Minutes per day',
      type: DailySummaryResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiStartProjectTimerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Start a timer on this project',
      description:
        'Rejected with 409 if the caller already has ANY timer running, on any project ' +
        'or in a meeting. A PROJECT_MANAGER is deliberately excluded from project time ' +
        'tracking. If an existing running timer has already passed its cutoff it is auto ' +
        'stopped here rather than blocking the new start.',
    }),
    projectIdParam,
    ApiResponse({
      status: 201,
      description: 'The running segment',
      type: TimeEntryResponseDto,
    }),
    ...timerErrors,
  );

export const ApiPauseProjectTimerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Pause a running timer',
      description:
        'Closes the segment and recalculates the project actualHours, on pause as well ' +
        "as on stop, since a paused segment's elapsed time is already real. Ownership " +
        'is absolute: only the person the entry belongs to may pause it, and unlike ' +
        'role gating elsewhere an admin does not bypass that.',
    }),
    projectIdParam,
    entryIdParam,
    ApiResponse({
      status: 200,
      description: 'The paused segment',
      type: TimeEntryResponseDto,
    }),
    ...timerErrors,
  );

export const ApiResumeProjectTimerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resume a paused timer',
      description:
        'Inserts a NEW segment carrying the same sessionId, rather than reopening the ' +
        'paused one. Rejected if a later resume has already superseded this segment, or ' +
        'if any other timer is running.',
    }),
    projectIdParam,
    entryIdParam,
    ApiResponse({
      status: 200,
      description: 'The new running segment',
      type: TimeEntryResponseDto,
    }),
    ...timerErrors,
  );

export const ApiStopProjectTimerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Stop a timer for good',
      description:
        'Closes the segment and recalculates the project actualHours.',
    }),
    projectIdParam,
    entryIdParam,
    ApiResponse({
      status: 200,
      description: 'The stopped segment',
      type: TimeEntryResponseDto,
    }),
    ...timerErrors,
  );

// ── Cross project and meeting entries ────────────────────────────────────────

export const ApiGetActiveTimerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Do I have a timer running right now, and of which kind',
      description:
        'Deliberately not nested under a project, because the one-timer rule is global ' +
        'and the answer is needed without knowing a project id up front. Returns ' +
        '{ active, kind: PROJECT | MEETING | null, entry }. Also runs the lazy auto stop ' +
        'check on whatever it finds, so calling this is itself a cleanup trigger.',
    }),
    ApiQuery({
      name: 'userId',
      required: false,
      description: 'Staff only: check someone else.',
    }),
    ApiResponse({
      status: 200,
      description: 'The active timer, or none',
      type: ActiveTimeEntryResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiProjectHoursSummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "A person's hours broken down by project",
      description:
        'Across every project they touched, most hours first. Self view is unrestricted; ' +
        'staff may pass userId for someone else.',
    }),
    ApiQuery({ name: 'userId', required: false }),
    ...dateRangeQuery,
    ApiResponse({
      status: 200,
      description: 'Hours per project',
      type: UserProjectSummaryResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiCombinedDailySummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Project hours next to meeting hours, day by day',
      description:
        'Meeting time is its own number and is NEVER folded into project actualHours or ' +
        'any project report. This endpoint is where the two are shown together.',
    }),
    ApiQuery({ name: 'userId', required: false }),
    ...dateRangeQuery,
    ApiResponse({
      status: 200,
      description: 'Project and meeting minutes per day, plus totals',
      type: CombinedDailySummaryResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiListMeetingEntriesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List the caller's meeting entries, or anyone's for staff",
    }),
    ApiQuery({ name: 'userId', required: false }),
    ...dateRangeQuery,
    ApiResponse({
      status: 200,
      description: 'Paginated meeting entries',
      type: PaginatedMeetingTimeEntriesResponseDto,
    }),
    ...gatedErrors,
  );

export const ApiStartMeetingTimerDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Start a meeting timer',
      description:
        'Time not attached to any project. Rejected with 409 if any timer is already ' +
        'running, including a project one. A PROJECT_MANAGER may track meeting time even ' +
        'though they may not track project time: sitting in planning is the job.',
    }),
    ApiResponse({
      status: 201,
      description: 'The running meeting segment',
      type: MeetingTimeEntryResponseDto,
    }),
    ...timerErrors,
  );

export const ApiPauseMeetingTimerDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Pause a running meeting timer' }),
    entryIdParam,
    ApiResponse({
      status: 200,
      description: 'The paused segment',
      type: MeetingTimeEntryResponseDto,
    }),
    ...timerErrors,
  );

export const ApiResumeMeetingTimerDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Resume a paused meeting timer' }),
    entryIdParam,
    ApiResponse({
      status: 200,
      description: 'The new running segment',
      type: MeetingTimeEntryResponseDto,
    }),
    ...timerErrors,
  );

export const ApiStopMeetingTimerDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Stop a meeting timer for good' }),
    entryIdParam,
    ApiResponse({
      status: 200,
      description: 'The stopped segment',
      type: MeetingTimeEntryResponseDto,
    }),
    ...timerErrors,
  );
