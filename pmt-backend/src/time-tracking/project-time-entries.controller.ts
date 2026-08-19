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
import { ProjectTimeEntriesService } from './project-time-entries.service';
import { TimeEntryNoteDto } from '@/time-tracking/dto/time-entry-note.dto';
import { QueryTimeEntriesDto } from '@/time-tracking/dto/query-time-entries.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  ApiListProjectTimeEntriesDocs,
  ApiPauseProjectTimerDocs,
  ApiProjectDailySummaryDocs,
  ApiResumeProjectTimerDocs,
  ApiStartProjectTimerDocs,
  ApiStopProjectTimerDocs,
} from '@/time-tracking/time-tracking.swagger';

// Only Developer/Designer track their own time. PROJECT_MANAGER is
// deliberately excluded from start/pause/resume/stop (ADMIN/SYSTEM_ADMIN are
// still reachable, unioned in automatically by Roles(), same as every other
// route).

@ApiTags('Time Tracking')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/time-entries')
export class ProjectTimeEntriesController {
  constructor(
    private readonly projectTimeEntriesService: ProjectTimeEntriesService,
  ) {}

  @ApiListProjectTimeEntriesDocs()
  @RequirePermissions(Permission.VIEW_TIME_ENTRIES)
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

  @ApiProjectDailySummaryDocs()
  @RequirePermissions(Permission.VIEW_TIME_ENTRIES)
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

  @ApiStartProjectTimerDocs()
  @RequirePermissions(Permission.TRACK_PROJECT_TIME)
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

  @ApiPauseProjectTimerDocs()
  @RequirePermissions(Permission.TRACK_PROJECT_TIME)
  @Patch(':id/pause')
  pause(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.projectTimeEntriesService.pause(projectId, id, dto, user.id);
  }

  @ApiResumeProjectTimerDocs()
  @RequirePermissions(Permission.TRACK_PROJECT_TIME)
  @Patch(':id/resume')
  resume(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: TimeEntryNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.projectTimeEntriesService.resume(projectId, id, dto, user.id);
  }

  @ApiStopProjectTimerDocs()
  @RequirePermissions(Permission.TRACK_PROJECT_TIME)
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
