import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectTimeEntriesService } from '@/projects/time-entries/project/project-time-entries.service';
import { MeetingTimeEntriesService } from '@/projects/time-entries/meetings/meeting-time-entries.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiCombinedDailySummaryDocs,
  ApiGetActiveTimerDocs,
  ApiProjectHoursSummaryDocs,
} from '@/projects/time-entries/time-entries.swagger';
import {
  QueryActiveTimeEntryDto,
  QueryDailySummaryDto,
  QueryProjectSummaryDto,
} from '@/projects/time-entries/dto/time-entry.dto';

/**
 * Time entries across every project: the caller's active timer and their
 * summaries.
 *
 * Deliberately NOT nested under `projects/:projectId`. The rule that only one
 * timer of any kind can be active is GLOBAL, across projects and across both
 * the project and meeting tables, so checking it cannot require a project id up
 * front. Starting and stopping a project timer lives at
 * `/projects/:projectId/time-entries`; meetings live at
 * `/time-entries/meetings`.
 *
 * This file used to hold the meeting routes too, from a folder called
 * `meeting/`, so three of its endpoints had nothing to do with meetings and the
 * folder named none of what it served.
 */
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
}
