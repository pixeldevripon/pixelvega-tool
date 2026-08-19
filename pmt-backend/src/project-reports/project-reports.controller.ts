import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ProjectReportService } from './project-report.service';
import { QueryProjectReportDto } from '@/project-reports/dto/query-project-report.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

@ApiTags('Project Reports')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/reports')
export class ProjectReportsController {
  constructor(private readonly projectReportService: ProjectReportService) {}

  @ApiOperation({
    summary: 'Get a calculated activity report for a project',
    description:
      'Plain aggregated numbers over a date range: hours by member, blockers, additional requirements, internal review and client feedback outcomes, and daily work report compliance. No AI involved, this is the calculated counterpart to the AI status report. Project Manager, Admin, and System Admin can view any project; Developer and Designer only a project they are an active member of; Client is excluded.',
  })
  @ApiResponse({
    status: 200,
    description: 'The calculated project report for the given range.',
  })
  @ApiResponse({
    status: 403,
    description: 'Not an active member of this project.',
  })
  @ApiResponse({ status: 404, description: 'Project not found.' })
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
