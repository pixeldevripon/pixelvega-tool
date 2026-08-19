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
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ProjectTimeEntriesService } from './project-time-entries.service';
import { TimeEntryNoteDto } from './dto/time-entry-note.dto';
import { QueryTimeEntriesDto } from './dto/query-time-entries.dto';

// Only Developer/Designer track their own time. PROJECT_MANAGER is
// deliberately excluded from start/pause/resume/stop (ADMIN/SYSTEM_ADMIN are
// still reachable, unioned in automatically by Roles(), same as every other
// route).
const TIME_TRACKING_ROLES = [Role.DEVELOPER, Role.DESIGNER];

@ApiTags('Time Tracking')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/time-entries')
export class ProjectTimeEntriesController {
  constructor(
    private readonly projectTimeEntriesService: ProjectTimeEntriesService,
  ) {}

  @ApiOperation({
    summary: "List a project's time entries",
    description:
      "Any active member of this project — PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN, or a DEVELOPER/DESIGNER staffed on it — sees everyone's entries by default, same visibility as documents/activities elsewhere in this module. Optionally filter to one person with userId (anyone can filter to themselves or a teammate). Filter to a day or range with startDate/endDate (e.g. both set to yesterday's date to answer 'how many hours did I work yesterday'). Response includes totalMinutes/totalHours summed over the same filters — not just the current page.",
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated time entries, plus totalMinutes/totalHours',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @Roles([Role.PROJECT_MANAGER, Role.DEVELOPER, Role.DESIGNER])
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryTimeEntriesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectTimeEntriesService.findAll(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Daily hours breakdown for a project',
    description:
      "Same scoping as the list endpoint — any active member of this project can pass userId for one team member, or omit it to see the whole team's combined daily total. Filter with startDate/endDate. Grouped by the calendar day each segment started, oldest first, each day (and the grand total) reporting totalMinutes/totalHours. Only finalized segments count — a currently RUNNING one's elapsed-so-far time isn't included until paused or stopped.",
  })
  @ApiResponse({
    status: 200,
    description: 'Per-day totals plus a grand total, oldest day first',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @Roles([Role.PROJECT_MANAGER, Role.DEVELOPER, Role.DESIGNER])
  @Get('daily-summary')
  findDailySummary(
    @Param('projectId') projectId: string,
    @Query() query: QueryTimeEntriesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectTimeEntriesService.findDailySummary(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Start a new timer on this project',
    description:
      "Rejected with 409 if the caller already has a RUNNING timer anywhere (one active timer per person, across all projects, not just this one) — unless that existing timer already exceeded the 9-hour continuous session cap, in which case it's auto-stopped and this start proceeds normally.",
  })
  @ApiResponse({ status: 201, description: 'Timer started, status RUNNING' })
  @ApiResponse({
    status: 403,
    description: 'Not an active member of this project',
  })
  @ApiResponse({
    status: 409,
    description: 'Caller already has a timer running elsewhere',
  })
  @Roles(TIME_TRACKING_ROLES)
  @Post('start')
  start(
    @Param('projectId') projectId: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectTimeEntriesService.start(
      projectId,
      dto,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Pause a running timer',
    description:
      "Closes the current segment (durationMinutes recorded) without finalizing the session — resume() continues it later. Only the entry's own owner may pause it. A single continuous RUNNING stretch is capped at 9 hours — if this entry already exceeded that (e.g. forgotten overnight), it's auto-finalized as STOPPED and this call fails with 409 instead of pausing it.",
  })
  @ApiResponse({ status: 200, description: 'Timer paused, status PAUSED' })
  @ApiResponse({ status: 400, description: 'Timer is not currently RUNNING' })
  @ApiResponse({ status: 403, description: "Not this entry's owner" })
  @ApiResponse({ status: 404, description: 'Project or time entry not found' })
  @ApiResponse({
    status: 409,
    description:
      'Entry already exceeded the 9-hour continuous session cap and was auto-stopped instead of paused',
  })
  @Roles(TIME_TRACKING_ROLES)
  @Patch(':id/pause')
  pause(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.projectTimeEntriesService.pause(projectId, id, dto, user.id);
  }

  @ApiOperation({
    summary: 'Resume a paused timer',
    description:
      'Creates a new TimeEntry segment carrying the same sessionId forward — the paused row itself is never mutated. Rejected if a later segment already resumed this session, or if the caller already has a timer running elsewhere.',
  })
  @ApiResponse({
    status: 201,
    description: 'New segment created, status RUNNING',
  })
  @ApiResponse({ status: 400, description: 'Timer is not currently PAUSED' })
  @ApiResponse({ status: 403, description: "Not this entry's owner" })
  @ApiResponse({ status: 404, description: 'Project or time entry not found' })
  @ApiResponse({
    status: 409,
    description:
      'This segment was already superseded by a later resume, or caller has a timer running elsewhere',
  })
  @Roles(TIME_TRACKING_ROLES)
  @Patch(':id/resume')
  resume(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.projectTimeEntriesService.resume(projectId, id, dto, user.id);
  }

  @ApiOperation({
    summary: 'Stop a timer for good',
    description:
      "Valid on a RUNNING or PAUSED entry — finalizes it as STOPPED. Recalculates the project's actualHours afterward.",
  })
  @ApiResponse({ status: 200, description: 'Timer stopped, status STOPPED' })
  @ApiResponse({
    status: 400,
    description: 'Timer has already been stopped',
  })
  @ApiResponse({ status: 403, description: "Not this entry's owner" })
  @ApiResponse({ status: 404, description: 'Project or time entry not found' })
  @Roles(TIME_TRACKING_ROLES)
  @Patch(':id/stop')
  stop(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.projectTimeEntriesService.stop(projectId, id, dto, user.id);
  }
}
