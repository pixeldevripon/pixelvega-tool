import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectTimeEntriesService } from '@/projects/time-entries/project/project-time-entries.service';
import { MeetingTimeEntriesService } from '@/projects/time-entries/meeting/meeting-time-entries.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiCombinedDailySummaryDocs,
  ApiGetActiveTimerDocs,
  ApiListMeetingEntriesDocs,
  ApiPauseMeetingTimerDocs,
  ApiProjectHoursSummaryDocs,
  ApiResumeMeetingTimerDocs,
  ApiStartMeetingTimerDocs,
  ApiStopMeetingTimerDocs,
} from '@/projects/time-entries/time-tracking.swagger';
import {
  QueryActiveTimeEntryDto,
  QueryDailySummaryDto,
  QueryMeetingTimeEntriesDto,
  QueryProjectSummaryDto,
  TimeEntryNoteDto,
} from '@/projects/time-entries/dto/time-entry.dto';

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

  @ApiGetActiveTimerDocs()
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

  @ApiProjectHoursSummaryDocs()
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

  @ApiCombinedDailySummaryDocs()
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

  @ApiListMeetingEntriesDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Get('meetings')
  findMeetings(
    @Query() query: QueryMeetingTimeEntriesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.meetingTimeEntriesService.findAll(query, user.id, user.role);
  }

  @ApiStartMeetingTimerDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Post('meetings/start')
  startMeeting(
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.start(dto, user.id);
  }

  @ApiPauseMeetingTimerDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch('meetings/:id/pause')
  pauseMeeting(
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.pause(id, dto, user.id);
  }

  @ApiResumeMeetingTimerDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch('meetings/:id/resume')
  resumeMeeting(
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.resume(id, dto, user.id);
  }

  @ApiStopMeetingTimerDocs()
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
