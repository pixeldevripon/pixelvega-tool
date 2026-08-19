import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectReportService } from './project-report.service';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ApiGetProjectReportDocs } from './project-reports.swagger';
import { QueryProjectReportDto } from '@/project-reports/dto/project-report.dto';

@ApiTags('Project Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/reports')
export class ProjectReportsController {
  constructor(private readonly projectReportService: ProjectReportService) {}

  @ApiGetProjectReportDocs()
  @RequirePermissions(Permission.VIEW_PROJECT_REPORTS)
  @Get()
  getReport(
    @Param('projectId') projectId: string,
    @Query() query: QueryProjectReportDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectReportService.getProjectReport(
      projectId,
      user.id,
      user.role,
      query,
    );
  }
}
