import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DailyWorkReportService } from './daily-work-report.service';
import { QueryProjectDailyEntriesDto } from '@/work-reports/dto/query-project-daily-entries.dto';

// Deliberately a separate controller from DailyWorkReportController. This
// route is nested under a project (projects/:projectId/daily-work-reports),
// unlike the routes there that are scoped to the caller themselves. It
// reuses DailyWorkReportService rather than a second service.
const READ_ROLES = [Role.PROJECT_MANAGER, Role.DEVELOPER, Role.DESIGNER];

@ApiTags('Daily Work Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/daily-work-reports')
export class ProjectDailyWorkReportsController {
  constructor(
    private readonly dailyWorkReportService: DailyWorkReportService,
  ) {}

  @ApiOperation({
    summary: "List a project's daily plan/wrap-up entries",
    description:
      "All of one project's daily entries across every developer and every day. PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN see everything; DEVELOPER/DESIGNER must be an active member of this project. Filter to one team member with userId, or narrow to a date range with startDate/endDate (both inclusive).",
  })
  @ApiResponse({ status: 200, description: 'Paginated project daily entries' })
  @ApiResponse({
    status: 403,
    description: 'Not an active member of this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @Roles(READ_ROLES)
  @Get()
  findByProject(
    @Param('projectId') projectId: string,
    @Query() query: QueryProjectDailyEntriesDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.dailyWorkReportService.findByProject(
      projectId,
      query,
      user.id,
      user.role,
    );
  }
}
