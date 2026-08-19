import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectTimeEntriesService } from './project-time-entries.service';
import { MeetingTimeEntriesService } from './meeting-time-entries.service';
import { QueryActiveTimeEntryDto } from '@/time-tracking/dto/query-active-time-entry.dto';
import { QueryProjectSummaryDto } from '@/time-tracking/dto/query-project-summary.dto';
import { QueryMeetingTimeEntriesDto } from '@/time-tracking/dto/query-meeting-time-entries.dto';
import { QueryDailySummaryDto } from '@/time-tracking/dto/query-daily-summary.dto';
import { TimeEntryNoteDto } from '@/time-tracking/dto/time-entry-note.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// PROJECT_MANAGER is excluded from project time tracking (see
// ProjectTimeEntriesController) but is included here, sitting in standups
// and planning is part of the job even though billable project work isn't.
// ADMIN is listed explicitly, same as elsewhere in this module, even though
// Roles() would union it in anyway, this is a deliberate decision that
// admins track their own meeting time the same way staff do. SYSTEM_ADMIN
// is unioned in automatically, same as always.

// Deliberately not nested under projects/:projectId. The rule that only one
// timer of any kind (project or meeting) can be active is global, not
// scoped to a project, so checking it can't require a project id up front.
// Reuses ProjectTimeEntriesService/MeetingTimeEntriesService rather than
// duplicating either's logic in a third service.
@ApiTags('Time Tracking')
@ApiCookieAuth('better-auth.session_token')
@Controller('time-entries')
export class TimeEntriesController {
  constructor(
    private readonly projectTimeEntriesService: ProjectTimeEntriesService,
    private readonly meetingTimeEntriesService: MeetingTimeEntriesService,
  ) {}

  @ApiOperation({
    summary:
      "Check the caller's currently active timer, across all projects and meetings",
    description:
      "Tells you whether a RUNNING timer already exists, and whether it's a project timer or a meeting timer, without needing to know the project id first. PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can pass userId to check a specific team member instead of themselves; DEVELOPER/DESIGNER can only check their own. If the found timer already exceeded its cutoff (9-hour continuous session cap, or the day it started on has ended), it's auto-stopped here too and this reports active: false.",
  })
  @ApiResponse({
    status: 200,
    description:
      '{ active: boolean, kind: "PROJECT" | "MEETING" | null, entry: TimeEntry & { project: {id, name} } | MeetingTimeEntry | null }',
  })
  @ApiResponse({
    status: 403,
    description: 'DEVELOPER/DESIGNER tried to check someone else',
  })
  @RequirePermissions(Permission.VIEW_TIME_ENTRIES)
  @Get('active')
  findActive(
    @Query() query: QueryActiveTimeEntryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectTimeEntriesService.findActiveForUser(
      user.id,
      user.role,
      query.userId,
    );
  }

  @ApiOperation({
    summary: "A developer's hours broken down by project",
    description:
      'Cross-project — shows how many hours the target user logged on each project they\'ve worked on (e.g. "Jabed: tool-internal 24.6h, target-board 5h"), sorted most-hours-first. Anyone can view their own; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN can pass userId to view a specific developer/designer instead. Filter with startDate/endDate (e.g. both set to today to answer "how many hours did they log today, by project"). Only finalized segments count, same as the rest of this module.',
  })
  @ApiResponse({
    status: 200,
    description: 'Per-project totals plus a grand total, most hours first',
  })
  @ApiResponse({
    status: 403,
    description: "Non-staff tried to view someone else's summary",
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @RequirePermissions(Permission.VIEW_TIME_ENTRIES)
  @Get('project-summary')
  findProjectSummary(
    @Query() query: QueryProjectSummaryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectTimeEntriesService.findProjectSummaryForUser(
      user.id,
      user.role,
      query.userId,
      query.startDate,
      query.endDate,
    );
  }

  @ApiOperation({
    summary: 'Project hours next to meeting hours, day by day',
    description:
      'Answers the gap between "hours tracked on projects" and "hours actually worked": for each UTC calendar day in range, shows projectMinutes (summed across every project that day), meetingMinutes, and their total, plus grand totals across the whole range. Self scoped for DEVELOPER/DESIGNER; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may pass userId to view anyone. Omit startDate/endDate for all time, or set a range (both inclusive). Only finalized segments count, same as the rest of this module.',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ userId, days: [{ date, projectMinutes, meetingMinutes, totalMinutes }], totalProjectMinutes, totalMeetingMinutes, totalMinutes }',
  })
  @ApiResponse({
    status: 403,
    description: "Non-staff tried to view someone else's summary",
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Get('daily-summary')
  findDailySummary(
    @Query() query: QueryDailySummaryDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.meetingTimeEntriesService.findDailySummaryForUser(
      user.id,
      user.role,
      query.userId,
      query.startDate,
      query.endDate,
    );
  }

  @ApiOperation({
    summary: "List the caller's (or, for staff, anyone's) meeting entries",
    description:
      'Self scoped for DEVELOPER/DESIGNER; PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN may pass userId to view a specific team member instead. Filter with status/startDate/endDate, same conventions as the project scoped time entries list. Response includes totalMinutes/totalHours summed over the same filters, not just the current page.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated meeting entries, plus totalMinutes/totalHours',
  })
  @ApiResponse({
    status: 403,
    description: "Non-staff tried to list someone else's meeting entries",
  })
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Get('meetings')
  findMeetings(
    @Query() query: QueryMeetingTimeEntriesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.meetingTimeEntriesService.findAll(query, user.id, user.role);
  }

  @ApiOperation({
    summary: 'Start a new meeting timer',
    description:
      "Rejected with 409 if the caller already has a RUNNING timer of any kind, a project timer or another meeting timer, anywhere, unless that existing timer already exceeded its cutoff, in which case it's auto-stopped and this start proceeds normally. Meeting time is never attached to a project and never touches Project.actualHours.",
  })
  @ApiResponse({ status: 201, description: 'Timer started, status RUNNING' })
  @ApiResponse({
    status: 409,
    description: 'Caller already has a timer running elsewhere',
  })
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Post('meetings/start')
  startMeeting(
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.start(dto, user.id);
  }

  @ApiOperation({
    summary: 'Pause a running meeting timer',
    description:
      "Closes the current segment (durationMinutes recorded) without finalizing the session, resume() continues it later. Only the entry's own owner may pause it. A single continuous RUNNING stretch is capped at 9 hours, and every segment must finish the same UTC day it started, if either cutoff already passed, it's auto-finalized as STOPPED and this call fails with 409 instead of pausing it.",
  })
  @ApiResponse({ status: 200, description: 'Timer paused, status PAUSED' })
  @ApiResponse({ status: 400, description: 'Timer is not currently RUNNING' })
  @ApiResponse({ status: 403, description: "Not this entry's owner" })
  @ApiResponse({ status: 404, description: 'Meeting time entry not found' })
  @ApiResponse({
    status: 409,
    description:
      'Entry already exceeded a cutoff and was auto-stopped instead of paused, or is from a previous day and locked',
  })
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch('meetings/:id/pause')
  pauseMeeting(
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.pause(id, dto, user.id);
  }

  @ApiOperation({
    summary: 'Resume a paused meeting timer',
    description:
      'Creates a new segment carrying the same sessionId forward, the paused row itself is never mutated. Rejected if a later segment already resumed this session, if the caller already has a timer running elsewhere, or if this entry started on a previous day (locked, no longer resumable).',
  })
  @ApiResponse({
    status: 201,
    description: 'New segment created, status RUNNING',
  })
  @ApiResponse({ status: 400, description: 'Timer is not currently PAUSED' })
  @ApiResponse({ status: 403, description: "Not this entry's owner" })
  @ApiResponse({ status: 404, description: 'Meeting time entry not found' })
  @ApiResponse({
    status: 409,
    description:
      'Already superseded by a later resume, locked from a previous day, or caller has a timer running elsewhere',
  })
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch('meetings/:id/resume')
  resumeMeeting(
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.resume(id, dto, user.id);
  }

  @ApiOperation({
    summary: 'Stop a meeting timer for good',
    description:
      'Valid on a RUNNING or PAUSED entry, finalizes it as STOPPED. Unlike project time entries, there is no actualHours to recalculate.',
  })
  @ApiResponse({ status: 200, description: 'Timer stopped, status STOPPED' })
  @ApiResponse({
    status: 400,
    description: 'Timer has already been stopped',
  })
  @ApiResponse({ status: 403, description: "Not this entry's owner" })
  @ApiResponse({ status: 404, description: 'Meeting time entry not found' })
  @ApiResponse({
    status: 409,
    description: 'Entry is from a previous day and locked',
  })
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch('meetings/:id/stop')
  stopMeeting(
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.stop(id, dto, user.id);
  }
}
