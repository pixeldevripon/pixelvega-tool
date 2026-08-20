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
import { MeetingTimeEntriesService } from '@/projects/time-entries/meetings/meeting-time-entries.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiListMeetingEntriesDocs,
  ApiPauseMeetingTimerDocs,
  ApiResumeMeetingTimerDocs,
  ApiStartMeetingTimerDocs,
  ApiStopMeetingTimerDocs,
} from '@/projects/time-entries/time-entries.swagger';
import {
  QueryMeetingTimeEntriesDto,
  TimeEntryNoteDto,
} from '@/projects/time-entries/dto/time-entry.dto';

/**
 * Meeting time, which is tracked separately from project work because a
 * meeting is not a deliverable.
 *
 * Not nested under a project: a meeting need not belong to one. PROJECT_MANAGER
 * is excluded from project time tracking but included here, because sitting in
 * standups and planning is the job even where billable project work is not.
 * ADMIN is listed explicitly throughout this module, a deliberate decision that
 * admins track their own meeting time the same way staff do.
 */
@ApiTags('Time Tracking')
@ApiCookieAuth('better-auth.session_token')
@Controller('time-entries/meetings')
export class MeetingTimeEntriesController {
  constructor(
    private readonly meetingTimeEntriesService: MeetingTimeEntriesService,
  ) {}

  @ApiListMeetingEntriesDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Get()
  findMeetings(
    @Query() query: QueryMeetingTimeEntriesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.meetingTimeEntriesService.findAll(query, user.id, user.role);
  }

  @ApiStartMeetingTimerDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Post('start')
  startMeeting(
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.start(dto, user.id);
  }

  @ApiPauseMeetingTimerDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch(':timeEntryId/pause')
  pauseMeeting(
    @Param('timeEntryId') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.pause(id, dto, user.id);
  }

  @ApiResumeMeetingTimerDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch(':timeEntryId/resume')
  resumeMeeting(
    @Param('timeEntryId') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.resume(id, dto, user.id);
  }

  @ApiStopMeetingTimerDocs()
  @RequirePermissions(Permission.TRACK_MEETING_TIME)
  @Patch(':timeEntryId/stop')
  stopMeeting(
    @Param('timeEntryId') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.meetingTimeEntriesService.stop(id, dto, user.id);
  }
}
