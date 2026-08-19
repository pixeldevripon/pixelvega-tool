import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DailyWorkReportService } from '@/projects/daily-work-reports/daily-work-report.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { ApiListProjectWorkReportsDocs } from '@/projects/daily-work-reports/daily-work-reports.swagger';
import { QueryProjectDailyEntriesDto } from '@/projects/daily-work-reports/dto/daily-work-report.dto';

// Deliberately a separate controller from DailyWorkReportController. This
// route is nested under a project (projects/:projectId/daily-work-reports),
// unlike the routes there that are scoped to the caller themselves. It
// reuses DailyWorkReportService rather than a second service.

@ApiTags('Daily Work Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/daily-work-reports')
export class ProjectDailyWorkReportsController {
  constructor(
    private readonly dailyWorkReportService: DailyWorkReportService,
  ) {}

  @ApiListProjectWorkReportsDocs()
  @RequirePermissions(Permission.VIEW_WORK_REPORTS)
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
